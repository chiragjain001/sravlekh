# AGENTS.md — Engineering Rules for AIOS

This file governs any coding agent (or human) working in this repository. It codifies rules from
`docs/15-CODING-STANDARDS.md` §13, the UI/UX preservation constraint for the v2 rebuild, and the working style
established at the start of the v2 build (`docs/33-GAP-ANALYSIS-AND-BUILD-PLAN.md`). Read `docs/00-32` before
making non-trivial changes — this file is a summary of discipline, not a replacement for the specs.

## 1. Read before you touch anything

1. Read `docs/00-DOCUMENTATION-GUIDE.md` first, then `01` through `32` in order, before starting unfamiliar
   work. Files 01–20 are the v1 baseline (each with a V2 Extensions section where relevant); files 21–32 are
   v2-only. `docs/33-GAP-ANALYSIS-AND-BUILD-PLAN.md` tracks what's actually built versus what the specs say —
   check it before assuming a feature does or doesn't exist.
2. Verify by reading the actual code. Do not assume a decorator, guard, or module is wired up just because it
   exists — this repo's history includes a case where `@Roles()`/`RolesGuard` were fully implemented but never
   registered globally, silently disabling authorization for the whole API. Trust but verify.

## 2. Hierarchy of Truth

On conflict between docs, resolve in this order and **report the conflict — never silently pick one**:

1. `07-SECURITY-SPECIFICATION.md`
2. `32-AI-GOVERNANCE-POLICY.md`
3. `01-PRODUCT-REQUIREMENTS.md`
4. `21-DOMAIN-MODEL-V2.md` / `02-SYSTEM-ARCHITECTURE.md`
5. `05-API-SPECIFICATION.md`
6. `04-DATABASE-SCHEMA.md`
7. `15-CODING-STANDARDS.md`
8. UI/UX specs (`03-FEATURE-SPECIFICATIONS.md`, `28-DIGITAL-COPY-UX-SPECIFICATION.md`)
9. `20-IMPLEMENTATION-PLAN.md`

## 3. Preserve the existing UI/UX — non-negotiable

The frontend's visual language (Tailwind tokens in `apps/web/tailwind.config.js`, component patterns in
`apps/web/src/components/ui/foundation.tsx` and `shared/`) is a deliberate product decision, not a placeholder.

- **Do not redesign.** Do not swap the styling approach, color palette, typography, spacing scale, or
  navigation structure because a cleaner pattern seems available elsewhere.
- **Do enhance.** Fix screens that are broken because they're incomplete (missing loading/empty/error states,
  inconsistent spacing) using the existing tokens — never inventing new ones.
- **New screens must look like they belong.** Every new v2 screen (`28-DIGITAL-COPY-UX-SPECIFICATION.md`:
  document evaluation UI, rubric authoring, evaluation work queue, etc.) is built from the same component
  patterns and Tailwind tokens already in `apps/web`, not a new library or new visual system.
- Every feature — including AI-evaluation and document-processing features — must be explainable to a
  non-technical teacher in one sentence and usable without a manual. If a feature needs a tutorial, simplify it
  before shipping.
- If an existing screen is genuinely unusable (not just suboptimal) and needs a structural UX change to
  function at all: implement the minimum functional fix, note the concern, and move on. Structural redesign
  decisions are not unilateral — flag them.

## 4. Discipline rules (from `15-CODING-STANDARDS.md` §13, verbatim)

1. Read `/docs` before modifying code.
2. Never change architecture without documenting the reason (update the relevant doc + note in the PR).
3. Never introduce a new dependency without checking whether an existing one already solves the problem.
4. Never hardcode secrets.
5. Never trust client-side authorization.
6. Every API endpoint must validate input.
7. Every database query must consider tenant isolation.
8. Every mutation must have appropriate error handling.
9. Critical business logic requires tests.
10. Do not modify unrelated files in a PR.
11. Do not rewrite working code unnecessarily.
12. Run lint, typecheck, and tests before finishing any unit of work.
13. Do not mark a task complete if tests fail.
14. Update documentation when architecture changes.
15. Prefer simple, maintainable solutions over clever ones.

## 5. Hard invariants (non-negotiable, from `07-SECURITY-SPECIFICATION.md` / `06-AUTH-AUTHORIZATION.md`)

- Every tenant-owned query filters by `instituteId` derived from the authenticated actor (JWT) — **never** from
  a client-supplied body/query param.
- Every mutating NestJS route is authenticated by default (global `JwtAuthGuard`) unless explicitly `@Public()`,
  and role-checked via `@Roles()` + global `RolesGuard`. Confirm both guards are actually registered as
  `APP_GUARD` providers — do not assume decorators alone are sufficient.
- No AI-generated evaluation (`EvaluationVersion(source=AI)`) is ever the terminal score for any
  `Assessment` where `stakesLevel = GRADED`, regardless of `assessmentKind` — enforced as a state-machine gate,
  not just a UI convention (`32-AI-GOVERNANCE-POLICY.md` §2, `05-API-SPECIFICATION.md`'s
  `SCHOOL_EXAM_LOCK_BLOCKED_UNEVALUATED`).
- `AuditLog` and `EvaluationVersion` rows are insert-only; no code path ever UPDATEs or DELETEs them.
- No vendor AI SDK is ever imported directly in evaluation/OCR business logic — always through the
  `AIProvider → AIModel → AIModelVersion → PromptVersion` registry and its adapter layer.

## 6. Working style — proceed, don't over-ask

- The documentation set (`docs/00-32`) answers nearly every implementation question. Search it before assuming
  you need to ask. Do not batch up clarifying questions before starting — that defeats the purpose of having
  the docs.
- Proceed without asking when: the docs specify the behavior; you're choosing between reasonable
  implementation details the docs don't pin down; you find a small, clearly-unintentional bug or gap and can
  fix it in place.
- Stop and flag (briefly, then keep moving on other work) when: two docs genuinely contradict each other on
  something that matters; an action risks losing or corrupting real data; a change would exceed the UI/UX
  preservation rule in §3; existing behavior seems intentional but contradicts the docs and a fix would be
  user-visible/breaking.
- Build one vertical feature at a time: data model → API → business logic → UI (matching the existing design
  system) → tests → move on. Don't build several features halfway.
- A feature is not done until it passes the Definition of Done in `19-ACCEPTANCE-CRITERIA.md` /
  `20-IMPLEMENTATION-PLAN.md`: implemented per spec, validated, authorized (role + tenant + batch scope), error
  handling per `08-ERROR-HANDLING.md`, all four UI states, tests passing, docs updated if architecture changed,
  typecheck/lint/build green.
