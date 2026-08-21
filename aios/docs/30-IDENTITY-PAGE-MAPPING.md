# 30 — Identity & Page Mapping
## AIOS — Academic Intelligence Operating System (v2)

> **STATUS: PROPOSED — PART OF V2 PACK.** Depends on `23-DOCUMENT-PROCESSING-ARCHITECTURE.md`. This is the highest-correctness-risk stage in the entire v2 pipeline — a misidentified booklet assigns one student's marks to another.

---

## 1. Purpose
Specify exactly how a scanned `Document` is matched to a `studentProfileId`/`Attempt`, and how page sequence is validated, with the conservatism the risk warrants.

## 2. `IdentityResolution` Entity
| Field | Notes |
|---|---|
| id | |
| documentId | FK, unique |
| method | `BARCODE` / `ROLL_NUMBER_OCR` / `QR_CODE` / `MANUAL_ADMIN_MATCH` |
| candidateStudentProfileId | the system's best guess (nullable if none found) |
| confidence | float 0.0–1.0 |
| resolvedStudentProfileId | FK, nullable until confirmed |
| resolvedByUserId | FK, nullable — null if auto-resolved above the auto-accept threshold, populated if a human confirmed/corrected |
| status | `PENDING` / `AUTO_RESOLVED` / `MANUALLY_CONFIRMED` / `MANUALLY_CORRECTED` / `UNRESOLVED` |
| createdAt / resolvedAt | |

## 3. Resolution Methods

### 3.1 `BARCODE` / `QR_CODE` (highest confidence, preferred)
If the institute's booklet template includes a pre-printed barcode/QR code encoding the student's roll number (assigned before the exam, e.g., printed on booklet covers distributed to specific students), scanning it yields near-certain identity — confidence effectively 1.0 minus scan-read failure risk. **This is the recommended method for institutes adopting the digital-copy workflow**, and should be steered toward in onboarding guidance (`28-DIGITAL-COPY-UX-SPECIFICATION.md`/product education), since it eliminates the OCR-based identity risk entirely.

### 3.2 `ROLL_NUMBER_OCR`
If no barcode exists, the roll-number field (a `PageRegion` of `regionType = ROLL_NUMBER_FIELD`) is OCR'd using the same handwriting-recognition pipeline as `24-OCR-HANDWRITING-ARCHITECTURE.md`, then matched against the batch's enrolled `StudentProfile.rollNumber` list. Confidence here is capped lower than barcode methods by design (default ceiling 0.9, configurable) to reflect genuine handwriting-recognition uncertainty on a field where an error has serious consequences.

### 3.3 `MANUAL_ADMIN_MATCH`
Fallback when auto-resolution confidence is below the auto-accept threshold, or roll number is illegible/missing. An operator manually selects the correct student from the batch roster while viewing the page image directly.

## 4. Auto-Accept Threshold Policy
- **Default: no fully-automatic resolution below 0.95 confidence.** Below this threshold, `IdentityResolution.status` remains `PENDING` and the document surfaces in `TeacherDocumentQueue` (`28` §3) for mandatory human confirmation before any `Attempt` linkage is finalized.
- Even at/above 0.95, the *first* resolution of a given confidence tier for a new institute is recommended to go through human confirmation during onboarding (a soft product-education nudge, not a hard rule) to validate the OCR pipeline is performing well on that institute's actual booklet templates/handwriting patterns before trusting it more.
- This threshold is configurable per institute (`Institute` config, extended) but the **default is conservative on purpose** — a false-positive auto-match (wrong student) is a materially worse failure than a delayed manual-confirmation step, so the system biases toward the latter.

## 5. Duplicate & Conflict Handling
- Two `Document`s resolving to the same `studentProfileId` for the same `AssessmentDelivery` → the second is flagged `CONFLICT`, held in `PENDING`, never auto-linked — mirrors v1's `DUPLICATE` AnswerSheet handling philosophy (`18-EDGE-CASES.md` v1) exactly, extended to the document domain.
- A `Document` whose best-candidate match doesn't correspond to any student enrolled in the target batch → flagged for manual resolution with a note, never silently linked to a plausible-but-wrong out-of-batch student.

## 6. Page Sequence Validation
- If the booklet template specifies an `expectedPageCount`, a `Document` with fewer/more detected pages than expected is flagged (`Document.status = FAILED` at the `PAGE_ORDER` stage, per `23` §4) for manual review — could indicate a missed page during scanning or a misfeed producing a duplicate scan.
- Page-number OCR (if pages are pre-printed with sequence numbers) is used to auto-detect out-of-order scans; absent that, operators confirm sequence manually during the `PAGE_ORDER` checkpoint.

## 7. Audit Trail
Every `IdentityResolution` — auto or manual — is itself audit-logged (`AuditLog`, unchanged v1 entity) with the resolution method, confidence, and resolving actor, since a wrong-student-linkage dispute is a serious, must-be-traceable event, at the same severity tier as v1's exam-unlock audit requirements (`07-SECURITY-SPECIFICATION.md` v1 §13).

## 8. Acceptance Criteria
- [ ] No `Document` is linked to an `Attempt` fully automatically below the configured confidence threshold (default 0.95).
- [ ] Conflicting/duplicate identity matches are always flagged, never silently auto-resolved to either candidate.
- [ ] Every identity resolution, auto or manual, is audit-logged with method, confidence, and actor.
- [ ] Page-count/sequence mismatches are always surfaced for human review, never silently accepted as-is.
