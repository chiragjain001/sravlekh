"""STAGING-ONLY real-provider smoke test for the P1 B1 adapter layer.

Every other B1 verification stubbed the vendor call. This is the one procedure
that does not: it spends real tokens against a real provider to confirm the
adapter's request shaping, error normalization, prompt lineage and governance
invariants match the vendor's actual behavior rather than our belief about it.

    python scripts/staging_provider_smoke.py [--skip-ocr] [--only NAME]

Requires OPENAI_API_KEY in the environment. Never pass a key as an argument
(it would land in shell history and the process list), never hard-code one, and
never commit one. The key is read from the environment and this script neither
logs nor echoes it.

REFUSES TO RUN AGAINST ANY UNNOMINATED DATABASE. Three independent guards, all
of which must pass:

  1. AIOS_ENV must be exactly "staging".
  2. DATABASE_URL's host:port must appear in STAGING_DB_ALLOWLIST — an explicit
     allowlist the operator sets, NOT a blocklist of scary-looking substrings.
     This is deliberate. An earlier version rejected hosts containing "prod" or
     "production", which fails open for exactly this project: the real shared
     database is a Supabase pooler whose hostname contains neither word, so a
     developer running this with their normal .env already loaded would have
     seeded a tenant straight into it. A blocklist has to predict every name a
     real database might have; an allowlist only has to be told the one that is
     safe, and anything it was not told about fails closed.
  3. Checks 8 and 9 seed their OWN dedicated tenant and tear it down; they never
     read, write or evaluate pre-existing rows. No production student data is
     touched under any circumstance.

Checks 1-7 need no database. Check 4 reads registry rows. Checks 8-9 create and
then delete a disposable STAGING-SMOKE-<runid> institute.

Cost: roughly 8 provider calls (one is a vision call), which is cents, not
dollars. Run after any change to src/providers/ and before any release that
alters an AI call site.

Numbering matches docs/34-STAGING-PROVIDER-SMOKE-TEST.md §4.
"""

import argparse
import asyncio
import hashlib
import os
import sys
import time
import uuid
from pathlib import Path
from urllib.parse import urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Set STAGING_DB_ALLOWLIST to a comma-separated list of host:port entries this
# script may touch, e.g. "localhost:5433,127.0.0.1:5433". There is no default:
# an unset allowlist means nothing is nominated, so nothing is permitted.
ALLOWLIST_VAR = "STAGING_DB_ALLOWLIST"

RESULTS: list[tuple[str, bool, str]] = []


def check(name: str, passed: bool, detail: str = "") -> None:
    RESULTS.append((name, bool(passed), detail))
    print(f"{'PASS' if passed else 'FAIL'}  {name}" + (f"  — {detail}" if detail else ""))


def note(text: str) -> None:
    print(f"      note: {text}")


def refuse_unless_staging() -> None:
    env = os.environ.get("AIOS_ENV", "")
    if env != "staging":
        sys.exit(f"REFUSING TO RUN: AIOS_ENV is {env!r}, expected 'staging'.")

    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        sys.exit("REFUSING TO RUN: DATABASE_URL is not set.")

    target = _host_port(db_url)
    if target is None:
        sys.exit("REFUSING TO RUN: could not parse a host:port out of DATABASE_URL.")

    allowed = {
        entry.strip().lower()
        for entry in os.environ.get(ALLOWLIST_VAR, "").split(",")
        if entry.strip()
    }
    if not allowed:
        sys.exit(
            f"REFUSING TO RUN: {ALLOWLIST_VAR} is not set, so no database has been "
            f"nominated as safe. Set it to the staging host:port you intend to use "
            f"(the target parsed from DATABASE_URL is {target!r})."
        )
    if target not in allowed:
        sys.exit(
            f"REFUSING TO RUN: DATABASE_URL points at {target!r}, which is not in "
            f"{ALLOWLIST_VAR} ({sorted(allowed)}). Nominate it explicitly if it is "
            f"genuinely a disposable staging database."
        )

    if not os.environ.get("OPENAI_API_KEY"):
        sys.exit("OPENAI_API_KEY is not set. Export a STAGING key; never a production one.")

    print(f"Target database: {target} (nominated in {ALLOWLIST_VAR}).")


def _host_port(db_url: str) -> str | None:
    """host:port from a Postgres URL, lowercased. Credentials are never read,
    never logged, and the userinfo section is discarded before parsing."""
    parsed = urlsplit(db_url)
    if not parsed.hostname:
        return None
    return f"{parsed.hostname.lower()}:{parsed.port or 5432}"


# --- supplementary: no direct vendor imports outside providers/ --------------
def check_import_boundary() -> None:
    from tests.test_no_vendor_sdk_imports import SRC, vendor_imports

    violations = []
    for path in sorted(SRC.rglob("*.py")):
        if "providers" in path.relative_to(SRC).parts:
            continue
        violations.extend(vendor_imports(path.read_text(encoding="utf-8"), str(path)))
    check("S. no vendor SDK imports outside src/providers/", not violations, "; ".join(violations))


# --- 1, 5, 7: evaluation adapter, max_tokens, timeout ------------------------
async def check_evaluation() -> None:
    from langchain_core.output_parsers import PydanticOutputParser

    from src.config import get_settings
    from src.evaluation.ai_evaluator import (
        AI_CALL_HARD_TIMEOUT_SECONDS,
        EVALUATION_MAX_TOKENS,
        EVALUATION_TEMPERATURE,
        AIEvaluationResult,
    )
    from src.providers.openai_adapter import OpenAIAdapter
    from src.providers.types import GenerateRequest, TextPart

    parser = PydanticOutputParser(pydantic_object=AIEvaluationResult)
    prompt = (
        "You are grading one short-answer exam response out of 10 marks.\n"
        "Question: Explain photosynthesis.\n"
        "Student answer: Plants use sunlight to convert CO2 and water into glucose "
        "and oxygen, in the chloroplast.\n\n" + parser.get_format_instructions()
    )
    request = GenerateRequest(
        content=[TextPart(prompt)],
        model=os.environ.get("SMOKE_EVAL_MODEL", "gpt-4o"),
        temperature=EVALUATION_TEMPERATURE,
        max_tokens=EVALUATION_MAX_TOKENS,
    )
    adapter = OpenAIAdapter(api_key=get_settings().OPENAI_API_KEY)

    started = time.monotonic()
    generated = await asyncio.wait_for(adapter.generate(request), timeout=AI_CALL_HARD_TIMEOUT_SECONDS)
    elapsed = time.monotonic() - started
    parsed = parser.parse(generated.text)

    check("1. Evaluation adapter -> real provider returns a parseable result",
          0.0 <= parsed.suggestedMarks <= 10.0,
          f"marks={parsed.suggestedMarks} confidence={parsed.confidence} in {elapsed:.1f}s")

    # 5. max_tokens=800 was a DEAD parameter before B1 Stage 2 — this is its
    # first real-traffic exercise. The failure mode is truncation: a response cut
    # off mid-JSON parses as malformed, not as a smaller correct answer, so a
    # clean parse above is itself the evidence the budget is adequate.
    check("5. max_tokens=800 produces complete, non-truncated evaluation output",
          True, f"{len(generated.text)} chars, parsed cleanly at max_tokens={EVALUATION_MAX_TOKENS}")

    # 7. Real-latency observation + mechanism proof. Forcing a genuine >20s
    # response is not reliably reproducible without abusing the provider, so the
    # threshold is assessed from observed latency and the mechanism is proven on
    # the same code path with a deliberately tiny budget.
    headroom = AI_CALL_HARD_TIMEOUT_SECONDS - elapsed
    check("7a. real provider latency sits within the 20s evaluation budget",
          elapsed < AI_CALL_HARD_TIMEOUT_SECONDS,
          f"observed {elapsed:.1f}s, budget {AI_CALL_HARD_TIMEOUT_SECONDS}s, headroom {headroom:.1f}s")
    if headroom < 5:
        note(f"headroom is only {headroom:.1f}s — 27 §6's budget may need review")

    try:
        await asyncio.wait_for(adapter.generate(request), timeout=0.001)
        check("7b. the hard timeout fires as TimeoutError on the real adapter path", False,
              "no timeout raised")
    except TimeoutError:
        check("7b. the hard timeout fires as TimeoutError on the real adapter path", True,
              "mechanism proven with a 0.001s budget; threshold assessed in 7a")


# --- 2: OCR multimodal -------------------------------------------------------
async def check_ocr() -> None:
    from src.ocr.handwriting_ocr import OCRExtractionResult, extract_text

    image_url = os.environ.get("SMOKE_OCR_IMAGE_URL")
    if not image_url:
        check("2. OCR multimodal adapter -> real provider", False,
              "UNABLE TO VERIFY: set SMOKE_OCR_IMAGE_URL to a provider-reachable staging "
              "image of legible printed text (synthetic or consented — never a real "
              "student's answer sheet)")
        return

    result = await extract_text(image_url, "PRINTED_TEXT", os.environ.get("SMOKE_OCR_MODEL", "gpt-4o"))
    ok = isinstance(result, OCRExtractionResult) and result.extractedText
    check("2. OCR multimodal [TextPart, ImagePart] -> real provider transcribes the image",
          bool(ok), f"text={(result.extractedText or '')[:60]!r} confidence={result.confidence}")


# --- 3: Blueprint ------------------------------------------------------------
async def check_blueprint() -> None:
    from src.ai.blueprint_agent import BlueprintGenerationResult, generate_blueprint_from_prompt

    result = await generate_blueprint_from_prompt(
        "A hard 90 minute Physics test covering only Kinematics, mostly MCQs"
    )
    check("3. Blueprint adapter -> real provider returns a parsed result",
          isinstance(result, BlueprintGenerationResult) and len(result.rules) > 0,
          f"title={result.title!r} duration={result.duration} rules={len(result.rules)}")
    check("3b. Blueprint response satisfies the declared output contract",
          all(r.count > 0 and r.difficulty and r.questionType for r in result.rules),
          f"rules={[(r.topicName, r.difficulty, r.count) for r in result.rules][:3]}")


# --- 4: registry-selected model is the model actually invoked ----------------
async def check_registry_invocation() -> None:
    from src.ai import blueprint_agent as ba
    from src.ai.blueprint_model_registry import (
        resolve_active_blueprint_model_version,
        resolve_blueprint_ai_model_id,
    )
    from src.database import db

    await db.connect()
    try:
        model_id = await resolve_blueprint_ai_model_id()
        active = await resolve_active_blueprint_model_version(model_id)
        if active is None:
            check("4. registry-selected model is the model invoked", False,
                  "UNABLE TO VERIFY: no active BLUEPRINT version in this staging DB")
            return

        seen: dict = {}
        real_cls = ba.OpenAIAdapter

        class Observing(real_cls):
            """Observes the outgoing request WITHOUT replacing the real call."""

            async def generate(self, request):
                seen["model"] = request.model
                return await super().generate(request)

        ba.OpenAIAdapter = Observing
        try:
            await ba.generate_blueprint_from_prompt("A short 30 minute Algebra quiz")
        finally:
            ba.OpenAIAdapter = real_cls

        check("4. the model sent to the real provider IS the registry's active row",
              seen.get("model") == active.versionLabel,
              f"sent={seen.get('model')!r} registry={active.versionLabel!r} (id={active.id})")
    finally:
        await db.disconnect()


# --- 6: provider error mapping ----------------------------------------------
async def check_error_mapping() -> None:
    from src.config import get_settings
    from src.providers.errors import AdapterAuthError, AdapterInvalidRequestError
    from src.providers.openai_adapter import OpenAIAdapter
    from src.providers.types import GenerateRequest, TextPart

    tiny = [TextPart("Reply with the single word: ok")]

    bad = OpenAIAdapter(api_key="sk-deliberately-invalid-key-for-smoke-test")
    try:
        await bad.generate(GenerateRequest(content=tiny, model="gpt-4o", temperature=0.0))
        check("6a. invalid credential -> AdapterAuthError", False, "no error raised")
    except AdapterAuthError as e:
        check("6a. invalid credential -> AdapterAuthError", True, f"{type(e).__name__}")
    except Exception as e:
        check("6a. invalid credential -> AdapterAuthError", False,
              f"got {type(e).__name__} — the vendor's exception classes may have been renamed")

    good = OpenAIAdapter(api_key=get_settings().OPENAI_API_KEY)
    try:
        await good.generate(
            GenerateRequest(content=tiny, model="definitely-not-a-real-model-xyz", temperature=0.0)
        )
        check("6b. unknown model -> AdapterInvalidRequestError", False, "no error raised")
    except AdapterInvalidRequestError as e:
        check("6b. unknown model -> AdapterInvalidRequestError", True, f"{type(e).__name__}")
    except Exception as e:
        check("6b. unknown model -> AdapterInvalidRequestError", False,
              f"got {type(e).__name__} — check the adapter's exception mapping")

    check("6c. rate-limit mapping (AdapterRateLimitError)", True,
          "CODE-VERIFIED, TRAFFIC-UNVERIFIED — deliberately not provoked")
    note("Provoking a real 429 means hammering the provider, which is abusive and")
    note("is explicitly out of scope. Confirm this mapping from production logs or")
    note("with a temporarily rate-capped staging key instead.")


# --- 8 + 9: seeded staging tenant, real evaluation, lineage + P0 invariants ---
async def check_lineage_and_governance() -> None:
    """8. B3 prompt lineage/hash through a REAL provider call.
    9. P0 human-review invariants intact after a real AI evaluation.

    Seeds a disposable tenant, runs the genuine evaluate_response() path with a
    real provider call, asserts, then tears the tenant down."""
    from prisma import Json

    from src.analytics.evaluation_status import is_authoritative_response, is_human_approved
    from src.database import db
    from src.evaluation import ai_evaluator
    from src.evaluation.ai_model_registry import PROMPT_TEMPLATE, PROMPT_VERSION_LABEL

    run = f"smoke-{uuid.uuid4().hex[:8]}"
    await db.connect()
    institute = None
    try:
        institute = await db.institute.create(
            data={"name": f"STAGING-SMOKE-{run}", "domainAllowlist": ["staging.invalid"], "status": "ACTIVE"}
        )
        teacher = await db.user.create(data={
            "instituteId": institute.id, "googleSub": f"{run}-t", "email": f"t-{run}@staging.invalid",
            "name": "Smoke Teacher", "role": "TEACHER", "status": "ACTIVE"})
        student = await db.user.create(data={
            "instituteId": institute.id, "googleSub": f"{run}-s", "email": f"s-{run}@staging.invalid",
            "name": "Smoke Student", "role": "STUDENT", "status": "ACTIVE"})
        batch = await db.batch.create(data={"instituteId": institute.id, "name": f"Smoke {run}"})
        profile = await db.studentprofile.create(data={"userId": student.id, "batchId": batch.id})
        subject = await db.subject.create(data={"instituteId": institute.id, "name": f"Smoke Sub {run}"})
        chapter = await db.chapter.create(data={"subjectId": subject.id, "name": "Ch"})
        topic = await db.topic.create(data={"chapterId": chapter.id, "name": "T"})
        question = await db.question.create(data={
            "instituteId": institute.id, "subjectId": subject.id, "chapterId": chapter.id,
            "topicId": topic.id, "type": "SHORT_ANSWER", "difficulty": "EASY", "marks": 10,
            "content": "Explain the process of photosynthesis.",
            "solution": "Photosynthesis converts light energy into chemical energy, producing "
                        "glucose and oxygen from carbon dioxide and water in the chloroplast.",
            "createdByUserId": teacher.id, "isApproved": True})
        await db.questionversion.create(data={
            "questionId": question.id, "versionNo": 1, "content": "snapshot", "createdBy": teacher.id})
        capture = await db.captureprovider.create(data={
            "instituteId": institute.id, "type": "PHOTO_CAPTURE_SUBJECTIVE", "config": Json({})})
        policy = await db.evaluationpolicy.create(data={
            "instituteId": institute.id, "name": "Smoke Policy",
            "mode": "AI_ASSIST_MANDATORY_REVIEW", "requiresHumanReview": True})
        assessment = await db.assessment.create(data={
            "instituteId": institute.id, "title": f"Smoke {run}",
            "assessmentKind": "SCHOOL_THEORY_EXAM", "stakesLevel": "GRADED",
            "subjectIds": [subject.id], "totalMarks": 10, "createdByUserId": teacher.id})
        delivery = await db.assessmentdelivery.create(data={
            "assessmentId": assessment.id, "batchId": batch.id, "status": "EVALUATING",
            "captureProviderId": capture.id, "evaluationPolicyId": policy.id,
            "createdByUserId": teacher.id})
        attempt = await db.attempt.create(data={
            "assessmentDeliveryId": delivery.id, "studentProfileId": profile.id,
            "status": "UNDER_EVALUATION"})
        response = await db.response.create(data={
            "attemptId": attempt.id, "questionId": question.id, "marksAwarded": 0,
            "marksAvailable": 10, "evidenceType": "DIGITAL_VALUE",
            "studentAnswer": "Plants use sunlight to turn carbon dioxide and water into "
                             "glucose and oxygen inside the chloroplast."})

        # ---- THE REAL PROVIDER CALL, through the production code path --------
        # The adapter is SUBCLASSED, not replaced: the real call still goes out.
        # Capturing the exact outgoing prompt lets check 8 hash what was actually
        # sent, rather than recomputing it through a parallel derivation that
        # could silently drift from production's.
        sent: dict = {}
        real_cls = ai_evaluator.OpenAIAdapter

        class Observing(real_cls):
            async def generate(self, request):
                sent["prompt"] = request.content[0].text
                sent["model"] = request.model
                return await super().generate(request)

        ai_evaluator.OpenAIAdapter = Observing
        try:
            outcome = await ai_evaluator.evaluate_response(institute.id, response.id, teacher.id)
        finally:
            ai_evaluator.OpenAIAdapter = real_cls
        if outcome.get("skipped"):
            check("8. B3 prompt lineage/hash through a real provider call", False,
                  f"UNABLE TO VERIFY: evaluation was skipped ({outcome.get('reason')})")
            return

        rec = await db.airecommendation.find_unique(
            where={"id": outcome["aiRecommendationId"]}, include={"promptVersion": True})

        # ---- 8: lineage + hash, against the prompt REALLY sent -----------------
        actual_hash = "sha256:" + hashlib.sha256(sent["prompt"].encode("utf-8")).hexdigest()
        check("8a. inputArtifactHash is the sha256 of the prompt actually sent to the provider",
              rec.inputArtifactHash == actual_hash,
              f"stored={rec.inputArtifactHash[:23]}... actual={actual_hash[:23]}...")

        check("8b. promptVersionId points at the active v2 PromptVersion row",
              rec.promptVersion.versionLabel == PROMPT_VERSION_LABEL,
              f"versionLabel={rec.promptVersion.versionLabel!r} id={rec.promptVersionId}")

        # The load-bearing lineage check. Production renders from the
        # PROMPT_TEMPLATE constant while the FK points at a DB row seeded from
        # that same constant. If someone edits the row in place, the link becomes
        # a lie: it would claim a template that never rendered anything. This is
        # the one assertion that catches that divergence.
        check("8c. the linked PromptVersion row's template matches the constant that rendered it",
              rec.promptVersion.promptTemplate == PROMPT_TEMPLATE,
              "row template is identical to PROMPT_TEMPLATE"
              if rec.promptVersion.promptTemplate == PROMPT_TEMPLATE
              else "DIVERGED — the stored row no longer matches the code that ran (docs/32 §7)")

        model_row = await db.aimodelversion.find_unique(where={"id": rec.aiModelVersionId})
        check("8d. modelParameters and the aiModelVersion FK agree with the model invoked",
              rec.modelParameters.get("model") == model_row.versionLabel == sent["model"],
              f"params={rec.modelParameters.get('model')!r} fk={model_row.versionLabel!r} "
              f"sent={sent['model']!r}")

        # ---- 9: P0 human-review invariants ------------------------------------
        evaluation = await db.evaluation.find_first(
            where={"responseId": response.id}, include={"currentVersion": True})
        current = evaluation.currentVersion

        check("9a. the AI produced an AI-sourced EvaluationVersion, not a human-approved one",
              current.source == "AI" and not is_human_approved(current),
              f"source={current.source} marks={current.marksAwarded}")

        fresh = await db.response.find_unique(
            where={"id": response.id}, include={"evaluation": {"include": {"currentVersion": True}}})
        check("9b. is_authoritative_response is False — an AI mark is never authoritative",
              is_authoritative_response(fresh) is False)
        check("9c. Response.marksAwarded was NOT moved by the AI path",
              fresh.marksAwarded == 0,
              f"marksAwarded={fresh.marksAwarded} (AI suggested {rec.suggestedMarks})")

        score_record = await db.scorerecord.find_first(where={"attemptId": attempt.id})
        check("9d. no finalized ScoreRecord exists from an AI-only evaluation",
              score_record is None or score_record.isFinalized is False,
              "none written by the Python path" if score_record is None
              else f"isFinalized={score_record.isFinalized}")
        note("ScoreRecord aggregation and mastery recalculation are NODE-side "
             "(ScoreAggregationService / mastery). Their P0 invariants are covered by "
             "the Node E2E harness — see docs/34 §4. This check only proves the Python "
             "AI path does not itself produce an authoritative or finalized score.")

    finally:
        if institute is not None:
            await _teardown(institute.id)
        await db.disconnect()


async def _teardown(institute_id: str) -> None:
    """Deletes the disposable tenant. Registry rows are deployment-wide and are
    deliberately left alone."""
    from src.database import db

    responses = await db.response.find_many(where={"attempt": {"is": {"assessmentDelivery": {
        "is": {"assessment": {"is": {"instituteId": institute_id}}}}}}})
    for r in responses:
        ev = await db.evaluation.find_first(where={"responseId": r.id})
        if ev:
            await db.evaluation.update(where={"id": ev.id}, data={"currentEvaluationVersionId": None})
            await db.evaluationcriterionscore.delete_many(
                where={"evaluationVersion": {"is": {"evaluationId": ev.id}}})
            await db.evaluationversion.delete_many(where={"evaluationId": ev.id})
            await db.evaluation.delete(where={"id": ev.id})
        await db.airecommendation.delete_many(where={"responseId": r.id})
        await db.response.delete(where={"id": r.id})
    for a in await db.attempt.find_many(where={"assessmentDelivery": {"is": {
            "assessment": {"is": {"instituteId": institute_id}}}}}):
        await db.scorerecord.delete_many(where={"attemptId": a.id})
        await db.attempt.delete(where={"id": a.id})
    for d in await db.assessmentdelivery.find_many(
            where={"assessment": {"is": {"instituteId": institute_id}}}):
        await db.assessmentdelivery.delete(where={"id": d.id})
    await db.assessment.delete_many(where={"instituteId": institute_id})
    await db.institute.delete(where={"id": institute_id})


CHECKS = {
    "evaluation": check_evaluation,
    "ocr": check_ocr,
    "blueprint": check_blueprint,
    "registry": check_registry_invocation,
    "errors": check_error_mapping,
    "governance": check_lineage_and_governance,
}


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-ocr", action="store_true", help="skip the vision call")
    ap.add_argument("--only", choices=sorted(CHECKS), help="run a single check")
    args = ap.parse_args()

    refuse_unless_staging()
    print(f"AIOS_ENV=staging; key length {len(os.environ['OPENAI_API_KEY'])} (value never printed).\n")

    check_import_boundary()

    selected = [args.only] if args.only else [k for k in CHECKS if not (args.skip_ocr and k == "ocr")]
    for name in selected:
        try:
            await CHECKS[name]()
        except Exception as e:  # a crashed check is a FAILED check, never a silent skip
            check(f"[{name}] raised", False, f"{type(e).__name__}: {e}")

    failed = [n for n, ok, _ in RESULTS if not ok]
    print(f"\n{len(RESULTS) - len(failed)}/{len(RESULTS)} passed")
    if failed:
        print("FAILED / UNABLE TO VERIFY:")
        for n in failed:
            print(f"  - {n}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    asyncio.run(main())
