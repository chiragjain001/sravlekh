# Load tests

[k6](https://k6.io/) scripts for the v1 scenarios in `docs/13-TESTING-STRATEGY.md` §8 and the v2 scenarios
added in Phase 15 (`docs/20-IMPLEMENTATION-PLAN.md`), targeting `docs/10-SCALABILITY-STRATEGY.md`'s
(including its V2 addendum) peak-load numbers.

**Status: partially executed — see `RESULTS-2026-09-11.md`.**

`read-path-baseline.js` has been run against a real API and Postgres and has real
numbers. The five domain scripts below are still unexecuted, because each needs
seeded state a fresh database does not have (a real ANSWER_SHEET_ID on an ONGOING
exam, DELIVERY_IDS with submitted subjective Responses, and so on). Running them
without it produces 404s at speed, which measures nothing — so they stay honestly
unrun rather than green.

The original note, still true of those five: This sandbox has no live Postgres, Redis, or running deployment to run
these against — see `docs/33-GAP-ANALYSIS-AND-BUILD-PLAN.md`'s Phase 6.5 and Phase 15 sections. "Load testing
executed against targets" cannot be honestly claimed done from here; only "scripts exist and are ready to run"
can. Nothing in these files has been validated beyond `k6 lint`-level syntax review — treat the request shapes
as a starting point, not a guarantee they match the live API exactly, once someone runs them for the first time
against a real environment.

## Running

Requires [k6](https://k6.io/docs/get-started/installation/) and a real deployment with seeded test data
(an institute, a batch, approved questions, an ADMIN/TEACHER JWT with real scope).

```bash
export BASE_URL=https://staging.aios.example.com/api/v1
export AUTH_TOKEN=<a real JWT for a seeded test user>
export INSTITUTE_ID=<that user's institute id>

k6 run grading-burst.js
k6 run blueprint-generation-burst.js
k6 run report-generation-burst.js
k6 run ai-evaluation-burst.js
k6 run document-processing-burst.js
```

## Scenarios

| Script | Simulates | Assertion |
|---|---|---|
| `grading-burst.js` | 100 concurrent grading submissions/sec, sustained 10 min | p95 write latency < 300ms, no data loss/duplication |
| `blueprint-generation-burst.js` | 20 concurrent AI blueprint-generation calls | FastAPI queue doesn't starve; no request exceeds the 15s hard timeout without a clean 504 |
| `report-generation-burst.js` | 500 concurrent report-generation requests | Queue absorbs the burst without exceeding job dead-letter thresholds |
| `ai-evaluation-burst.js` | 2,000 concurrent AI-evaluation batch triggers (deliveries entering `EVALUATING`) | Transition call stays fast (p95 < 500ms); queue back-pressure never surfaces as a 5xx |
| `document-processing-burst.js` | 10,000 pages/day peak (sustained page-upload rate) + 500 concurrent identity-resolution confirms | Upload p95 < 2s, confirm p95 < 500ms; never a 5xx from either |

Each script needs real seeded ids (`examId`/`answerSheetId`/`blueprintId`/`deliveryId`/`bundleId`/
`resolutionId`) filled in via the environment variables at the top of the file — the placeholders will 404
against an empty database.
