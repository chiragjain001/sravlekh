# `Exam` / `AnswerSheet` compatibility view — design note (deferred)

`04-DATABASE-SCHEMA.md` (V2 section) §3.3: once `Assessment`/`AssessmentDelivery`
exist, v1's `Exam` table is not dropped — it becomes a compatibility view over
`Assessment` + `AssessmentDelivery` (for the simple single-batch-single-schedule
case) so `GET /exams/:id`'s response shape doesn't change. `AnswerSheet`
similarly becomes a view over `Attempt` for non-document-backed attempts.

**Why this isn't built yet:** creating an actual Postgres `VIEW` (or the
alternative the doc leaves open — a thin table kept in sync via application
logic) is DDL that needs a live database to create and verify against. This
sandbox has never had one. Writing untested view DDL and calling it done would
be indistinguishable from actually verifying it works, which isn't true.

There's also a real design decision the doc explicitly leaves open
("implementation-decision deferred to `20-IMPLEMENTATION-PLAN.md` (V2
section)") that Phase 7 doesn't resolve: **view vs. synced table.**

- A Postgres `VIEW` is simpler and can't drift, but v1's `Exam` table today has
  writes going directly through `ExamsService` (`create`, `updateStatus`,
  `unlock`, etc.) — a `CREATE VIEW exams AS SELECT ... FROM assessment_deliveries
  JOIN assessments ...` makes the old table name resolve to a read path, but
  every existing INSERT/UPDATE against `exams` in `ExamsService` would need to
  be rewritten to write `Assessment`+`AssessmentDelivery` instead (views are
  read-only in Postgres unless backed by `INSTEAD OF` triggers). That rewrite
  is real application code work, not schema work, and touches the same
  `ExamsService` that Phase 6's LOCK/UNLOCK transaction fix and Phase 6.5's
  security hardening both landed in — it needs its own careful pass, not a
  drive-by change bundled into a schema-staging phase.
- A synced table avoids the trigger complexity but reintroduces exactly the
  drift risk the doc is trying to avoid by using a view in the first place.

**What Phase 7 deliberately did instead:** left v1 `Exam`/`AnswerSheet` fully
untouched (still real, writable tables, unchanged behavior) and built
`Assessment`/`AssessmentDelivery`/`Attempt` as genuinely separate, additive
tables with no FK or view relationship to `Exam`/`AnswerSheet` at all. The two
model families coexist independently until whichever future phase builds the
actual Assessment-delivery endpoints — at that point, this compatibility-view
question needs a real decision (view+triggers vs. synced table vs. dropping
the "don't change `GET /exams/:id`'s shape" requirement and doing a real
breaking migration with a version bump) informed by live-database testing this
sandbox can't provide.

**Follow-up needed before this can be built for real:**
1. A live Postgres instance to prototype both approaches against.
2. The `ExamsService` rewrite decision above, made explicitly (not implied by
   schema shape).
3. Confirmation of which v1 API consumers (apps/web's Exam Workflow screen,
   any other integrations) actually depend on `GET /exams/:id`'s exact current
   shape post-migration, to know whether the compatibility requirement is
   still load-bearing by the time this is picked up.
