# Load tests

[k6](https://k6.io/) scripts for the three scenarios in `docs/13-TESTING-STRATEGY.md` §8, targeting
`docs/10-SCALABILITY-STRATEGY.md`'s peak-load numbers.

**Status: written, never executed.** This sandbox has no live Postgres, Redis, or running deployment to run
these against — see `docs/33-GAP-ANALYSIS-AND-BUILD-PLAN.md`'s Phase 6.5 section. "Load testing executed
against targets" cannot be honestly claimed done from here; only "scripts exist and are ready to run" can.
Nothing in these files has been validated beyond `k6 lint`-level syntax review — treat the request shapes as
a starting point, not a guarantee they match the live API exactly, once someone runs them for the first time
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
```

## Scenarios

| Script | Simulates | Assertion |
|---|---|---|
| `grading-burst.js` | 100 concurrent grading submissions/sec, sustained 10 min | p95 write latency < 300ms, no data loss/duplication |
| `blueprint-generation-burst.js` | 20 concurrent AI blueprint-generation calls | FastAPI queue doesn't starve; no request exceeds the 15s hard timeout without a clean 504 |
| `report-generation-burst.js` | 500 concurrent report-generation requests | Queue absorbs the burst without exceeding job dead-letter thresholds |

Each script needs real seeded ids (`examId`/`answerSheetId`/`blueprintId`) filled in via the environment
variables at the top of the file — the placeholders will 404 against an empty database.
