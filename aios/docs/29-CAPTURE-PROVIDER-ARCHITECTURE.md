# 29 — Capture Provider Architecture
## AIOS — Academic Intelligence Operating System (v2)

> **STATUS: PROPOSED — PART OF V2 PACK.** Depends on `21-DOMAIN-MODEL-V2.md` §4.9, `22-ASSESSMENT-ENGINE.md`.

---

## 1. Purpose
Formalize the `CaptureProvider` abstraction so that OMR (v1, preserved unchanged), digital direct-entry (v1, preserved unchanged), and the new document/OCR pipeline (v2) are pluggable implementations of one interface — not three independently-maintained code paths that happen to coexist.

## 2. The Abstraction
```
                 Assessment
                     ↓
              Capture Method
                     ↓
       ┌─────────────┼─────────────┐
       │             │             │
      OMR        Digital        Scanned/
       │           Exam         Photographed
       │             │           Booklet
       └─────────────┼─────────────┘
                     ↓
              Response Evidence
                     ↓
                 Evaluation
```
Every `CaptureProvider` implementation must produce `Response` rows conforming to the evidence-pointer contract in `21` §4.4/`22` §5, regardless of internal mechanism. This is the seam that lets the Evaluation Engine (`25`), Mastery Engine, and downstream analytics remain provider-agnostic.

## 3. Provider Interface (Conceptual — NestJS Implementation)
```typescript
interface CaptureProvider {
  type: CaptureProviderType; // OMR | MANUAL_GRID | CSV_IMPORT | PHOTO_CAPTURE_OBJECTIVE | PHOTO_CAPTURE_SUBJECTIVE
  validateConfig(config: json): ValidationResult;
  ingest(attemptId: string, rawInput: unknown): Promise<IngestResult>; // creates Attempt + Response rows
  requiresDocumentPipeline(): boolean; // true only for PHOTO_CAPTURE_SUBJECTIVE
}
```
- **`OMR`**: wraps the existing v1 OMR engine unchanged. `ingest()` parses the OMR scanner file, matches against the answer key, produces `Response(evidenceType=OMR_MARK, isCorrect=...)` directly — same logic, same performance characteristics as v1, zero rewrite.
- **`MANUAL_GRID`**: wraps v1's tabular web grid entry. `ingest()` receives structured marks input, produces `Response(evidenceType=DIGITAL_VALUE)` — unchanged from v1.
- **`CSV_IMPORT`**: wraps v1's CSV bulk import, unchanged.
- **`PHOTO_CAPTURE_OBJECTIVE`**: the v1 "photographed OMR/MCQ sheet" path — image is processed but only to extract bubble/option marks (a much narrower, more mature problem than full handwriting OCR), producing `Response(evidenceType=OMR_MARK)` equivalently. `requiresDocumentPipeline() = false` — it does not invoke the full Document Processing Architecture (`23`), only a lightweight bubble-detection step.
- **`PHOTO_CAPTURE_SUBJECTIVE`**: the new v2 path. `ingest()` creates the `Document`/`Page` records and hands off to the full pipeline (`23`); `Response` rows are created early (`evidenceType=PAGE_REGION`, evidence pending) and populated as the pipeline progresses. `requiresDocumentPipeline() = true`.

## 4. Provider Selection
`AssessmentDelivery.captureProviderId` is set at scheduling time (mirrors v1's `captureMode` selection at Exam-creation time) but **is not immutable** — unlike v1, v2 explicitly allows a fallback provider override at the individual-`Attempt` level (`22` §3, "cross-mode entry" edge case carried forward from v1's `18-EDGE-CASES.md`): if a delivery's default provider is `OMR` but one student's sheet is damaged and must be manually keyed in, that single `Attempt` can be ingested via `MANUAL_GRID` without changing the delivery's overall configured provider.

## 5. Extensibility
New provider types (e.g., a future direct-integration with a third-party online-exam platform, or a live in-app digital-exam-taking mode) are added by implementing the same interface — no changes required to `Evaluation`, `MasteryScore`, or downstream analytics, since those all operate on `Response`/`Evaluation`, never on provider-specific raw data. This is the direct architectural payoff of the `21-DOMAIN-MODEL-V2.md` refactor.

## 6. Provider Configuration Schema
| Provider | Config fields |
|---|---|
| `OMR` | answerKeyReference, bubbleSheetTemplateId |
| `MANUAL_GRID` | none required |
| `CSV_IMPORT` | expectedColumnMapping |
| `PHOTO_CAPTURE_OBJECTIVE` | bubbleSheetTemplateId, expectedOptionCount |
| `PHOTO_CAPTURE_SUBJECTIVE` | expectedPageCount, bookletTemplateId (optional), identityResolutionMethod (`BARCODE`/`ROLL_NUMBER_OCR`/`MANUAL_ONLY`) |

**Fix #4 addition:** `bookletTemplateId`'s presence/absence is what sets `Document.layoutType` (`TEMPLATE_KNOWN` if present, `FREE_FORM` if absent) at ingest time, per `23-DOCUMENT-PROCESSING-ARCHITECTURE.md` §4.0 — this single config field is the deliberate, sole source of the branch decision, so the two pipeline paths are never selected by inference from unrelated signals (e.g., never guessed from image quality or page count).

## 7. Acceptance Criteria
- [ ] OMR and MANUAL_GRID/CSV_IMPORT providers are verifiably unchanged in behavior and performance from v1 — regression-tested explicitly (see `13-TESTING-STRATEGY.md` v2 addendum).
- [ ] A single `Attempt` can be ingested via a different provider than its delivery's default, without side effects on other attempts in the same delivery.
- [ ] Adding a new provider type requires no changes to Evaluation, Mastery, or Analytics code.
