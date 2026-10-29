<USER_REQUEST>
# AIOS / SARVLEKH — FINAL SIX-AGENT INTEGRATION, LIVE-WEBSITE VALIDATION, ROOT-CAUSE PERFORMANCE AUDIT & PRODUCTION HARDENING

## 1. Your Mission

You are the Principal Engineer, CTO, Performance Engineer, Security Auditor and Release Manager responsible for validating the complete AIOS/SARVLEKH education platform.

Repository:

`E:\sarvlekh\aios`

The project has six specialized engineering workstreams:

1. Examination pipeline, booklet generation and scanning reliability.
2. AI handwriting OCR, answer evaluation and AI governance.
3. Academic analytics, topic mastery and remediation.
4. Teacher experience, frontend UX, responsiveness and performance.
5. Notification reliability and institute operations.
6. Security, infrastructure, automated testing and system reliability.

Your responsibility is to determine whether these six workstreams have been implemented correctly, whether they work together, whether the deployed website actually behaves correctly, and why the application currently feels slow.

Do not assume that any agent has completed its work successfully. Do not assume that a successful build means the platform is production-ready. Do not trust previous audit conclusions without checking the current code, actual test results and available runtime evidence.

**Your goal is to make the existing product measurably faster, more reliable, secure and operationally ready for real educational institutions while preserving all working functionality.**

Be optimistic and solution-oriented. Treat performance problems as engineering problems to investigate systematically, not as reasons to rewrite the entire application or abandon useful existing work.

## 2. Mandatory Project Context and Audit Reports

Read the complete contents of all relevant documents before starting implementation:

- `E:\sarvlekh\aios\deep-research-report.md`
- `E:\sarvlekh\aios\docs\strategy\AIOS_BUSINESS_AND_TECHNICAL_REALITY_CHECK.md`
- `E:\sarvlekh\aios\docs\strategy\AIOS_FEATURE_AUDIT.md`
- `E:\sarvlekh\aios\docs\strategy\COMPETITOR_MATRIX.md`
- `E:\sarvlekh\aios\docs\strategy\UNIT_ECONOMICS.md`
- `E:\sarvlekh\aios\docs\strategy\90_DAY_GROWTH_PLAN.md`

Locate the exact files if their paths have changed. Report files that genuinely cannot be found. Do not silently skip a document.

Use the reports to understand the intended architecture, completed work, identified defects, customer workflows and performance/cost risks. Treat their findings as hypotheses to verify rather than unquestionable facts.

The previous audit reported:

- A 42-feature scorecard with 28 features classified as production-ready.
- Paper blueprinting, serialized booklets, signed QR codes, OMR recognition and bulk PDF ingestion.
- A digital answer-sheet evaluation workspace.
- AI-assisted handwriting transcription and marking suggestions.
- A mandatory human approval gate before subjective exam finalization.
- Topic-level mastery, diagnostic mistake classification and remediation.
- Potential weaknesses in OCR calibration, external communications, billing infrastructure and browser-level testing.

These are previous report claims. Verify the current implementation and do not repeat them as independently proven facts unless the available evidence supports them.

## 3. Absolute Business Scope Restriction: Billing Is Deferred

I explicitly do not need billing implementation in this phase.

Do not implement or introduce:

- Razorpay, Stripe, Cashfree or another payment gateway.
- Payment, invoice or subscription database models.
- Checkout, billing dashboards or customer payment portals.
- Subscription renewals, billing webhooks or payment processing.
- New billing dependencies, migrations or UI screens.

Preserve existing access controls, entitlements and plan limits. Billing-related work must remain out of scope.

The purpose of this engagement is to validate and improve the existing product, reliability, performance, security, testing and operational readiness—not to expand the feature list indiscriminately.

---

# PHASE 1 — Establish the Actual Baseline

Before modifying code, establish exactly what is deployed and what is present locally.

## 4. Repository and Six-Agent Change Verification

Inspect:

- Current Git branch and commit.
- Working-tree status and uncommitted changes.
- Existing commits, branches and Git worktrees for all six agents.
- Agent summaries, generated reports, tests and changed files.
- Deployment configuration and the commit currently deployed.
- Database schema and migrations.
- Existing package scripts, test commands and CI workflows.

Confirm whether each agent's work has actually been integrated into the main application.

For every workstream, identify:

- Intended scope.
- Files modified.
- Features changed.
- Tests added and actually executed.
- Known defects and unresolved dependencies.
- Whether the implementation is present in the running application.
- Whether the deployed website corresponds to the reviewed commit.

Do not assume that code in a separate worktree or branch is live on the website.

Create a change inventory before integrating anything.

### Six-workstream acceptance matrix

| Workstream | Minimum verification |
|---|---|
| Agent 1 — Examination pipeline | Paper generation, booklet integrity, PDF ingestion, segmentation, OMR and identity resolution |
| Agent 2 — AI evaluation | OCR extraction, rubric evaluation, bounded scoring, error handling and mandatory human approval |
| Agent 3 — Academic intelligence | Mastery calculations, mistake tagging, diagnostic reports and remediation |
| Agent 4 — Frontend experience | Responsive screens, evaluation usability, saving states and browser performance |
| Agent 5 — Notifications | Correct delivery states, provider failures, retries and tenant-safe recipient handling |
| Agent 6 — Security/testing | Authorization, tenant isolation, recovery, CI and end-to-end regression coverage |

A file existing in the repository does not count as proof that the feature works.

## 5. Identify the Deployed Website

Discover the configured production and staging URLs from the project's documented deployment configuration, hosting configuration, repository metadata or authorized environment.

Never print secrets or expose private environment variables.

Record:

- Production URL.
- Staging/test URL, if available.
- Deployed commit or release identifier, if obtainable.
- Backend/API endpoint configuration.
- Python service configuration.
- Database and queue infrastructure type, without exposing credentials.

If an address or environment cannot be established, report the exact blocker rather than inventing a URL or pretending a live test was performed.

Do not deploy automatically.

## 6. Record the Initial Performance Baseline

Before performance optimization, run repeatable tests against the current application.

Test the landing/login flow where accessible, dashboard, exam management, paper generation, scanning workflow, evaluation workspace, student performance and diagnostic report pages.

Measure desktop and mobile behavior where supported.

Record:

- Initial page-load time.
- Time to First Byte (TTFB).
- Largest Contentful Paint (LCP).
- Interaction to Next Paint (INP), where actual field measurements are available.
- Cumulative Layout Shift (CLS).
- JavaScript bundle size and large dependencies.
- Number of network requests and total transferred data.
- Number of API requests triggered by each important screen.
- API response-time distribution where observable.
- Failed, duplicated and unexpectedly repeated requests.
- Browser console errors and failed network requests.
- Memory usage and long-running JavaScript tasks where measurable.
- PDF rendering and image-processing latency.

Use repeatable conditions, report the number of runs, distinguish cold loads from warm-cache loads, and retain the results as the baseline.

Use Lighthouse, browser developer tools and other appropriate performance tooling where available.

Do not treat a single Lighthouse score as proof of real-user performance. Distinguish laboratory results from real-user field data.

Do not promise a perfect score at the expense of product functionality, security or usability.

Use Core Web Vitals as performance objectives where applicable: LCP at or below 2.5 seconds, INP at or below 200 milliseconds, and CLS at or below 0.1. Treat these as targets to evaluate, not as guaranteed outcomes for every route and device.

---

# PHASE 2 — Validate the Real Product Workflow

## 7. Execute Safe Live-Website Smoke Tests

Test the actual deployed website through the browser using authorized test credentials and an explicitly designated test institute/account.

If a dedicated test tenant is not available, perform non-destructive smoke tests on production and report which workflows cannot safely be exercised there.

Do not create uncontrolled production records, contact real parents, expose student data or send real SMS/WhatsApp messages merely to complete a test.

Use isolated synthetic fixtures, authorized test data and provider mocks where appropriate.

### A. Authentication and tenant isolation

Verify that:

- Users can authenticate through the intended flow.
- Expired or invalid sessions are handled safely.
- Teachers see only their assigned batches and permitted records.
- Student accounts can access only their own permitted records.
- Documents and reports cannot be accessed by changing an identifier.
- Institute A cannot access Institute B's records.
- Role permissions remain enforced by the backend, not merely by frontend visibility.

### B. Paper generation

Create a test assessment using a valid blueprint.

Verify:

- Total marks and section totals are correct.
- Only approved questions can be selected.
- Question types and difficulty constraints are respected.
- Question-family deduplication works as intended.
- Question sets and option shuffling preserve correctness.
- Generated PDFs open correctly and contain the required content.
- Invalid requests fail with actionable errors.

### C. Physical booklet and scanning workflow

Using authorized synthetic exam booklets:

1. Generate printable answer booklets.
2. Verify that QR signatures are valid.
3. Process a representative combined, multi-page PDF.
4. Verify page segmentation and booklet grouping.
5. Check OMR recognition and roll-number matching.
6. Confirm ambiguous, damaged or low-confidence pages are routed to manual review.
7. Confirm duplicates and invalid signatures cannot silently create incorrect results.
8. Verify that processing failures can be diagnosed and safely retried.

### D. Digital evaluation and AI

Verify:

- Teachers can open the correct scanned answer sheet.
- Student-wise and question-wise allocation works correctly.
- Rubrics and marks validation are enforced.
- AI suggestions are clearly distinguished from teacher-approved marks.
- Teacher corrections are saved correctly.
- AI failures and timeouts fall back to the manual evaluation queue.
- Unsupported diagrams and other non-goal cases are routed appropriately.
- A subjective examination cannot be finalized with unresolved AI-only scores.
- An exam cannot be locked before required evaluations are completed.

### E. Academic analytics and reports

Verify:

- Final marks match the approved evaluation records.
- Topic mastery uses the intended scoring rules.
- Repeated processing does not duplicate scores or interventions.
- Remedial assignments are generated only when valid prerequisites are satisfied.
- Diagnostic reports display correct marks, topics and labels.
- Students cannot access other students' reports.
- Incomplete or unverified evaluation data is not presented as final.

### F. Teacher and student experience

Check:

- Main workflows work on desktop and supported mobile/tablet layouts.
- Buttons, forms, filters and navigation behave correctly.
- Loading, empty, success and failure states are useful.
- Changes are saved or clearly marked unsaved.
- PDF zoom, pan and reading remain responsive.
- Long lists, charts and large reports do not cause avoidable freezes.

### G. Notifications

Verify in-app notification behavior and delivery statuses.

For external communication, use mocked providers or an authorized staging account. Confirm that missing providers are reported honestly and that retries cannot send unintended duplicate messages.

### Acceptance requirement

Do not mark a workflow as verified if you only inspected its UI or tested an isolated API endpoint. Record the complete path actually tested and distinguish live execution, staging execution, automated tests and manual inspection.

---

# PHASE 3 — Investigate Why the Website Feels Slow

## 8. Perform a Root-Cause Performance Investigation

The website feels slow even under apparently light usage. Treat this as a serious engineering concern.

Do not guess that the problem is the database, Python service, AI model, server or frontend. Determine which components actually contribute to the delay.

Investigate all of the following.

### A. Frontend and JavaScript

Inspect:

- Initial JavaScript bundle size and unnecessary dependencies.
- Large PDF, chart, image-processing and visualization libraries.
- Slow hydration and expensive rendering.
- React components that rerender unnecessarily.
- Repeated data fetching caused by unstable dependencies or incorrect query configuration.
- Blocking scripts and long main-thread tasks.
- Excessive synchronous computation.
- Large images, missing responsive variants and inefficient formats.
- Ineffective code splitting or lazy loading.
- Duplicate requests on navigation or component mounting.
- Memory leaks from subscriptions, event handlers or uncleaned resources.
- Expensive canvas rendering, PDF zooming and chart updates.
- Poor cache headers for versioned static assets.

Use browser profiling and the network waterfall to identify specific routes and components.

### B. API and backend

Inspect:

- Request latency and error rates by endpoint.
- Synchronous CPU-heavy work inside request handlers.
- Blocking network requests.
- Unnecessary sequential awaits where independent operations could safely run concurrently.
- Duplicate database reads and write operations.
- N+1 query patterns.
- Unbounded result sets and expensive serialization.
- Large response payloads.
- Request retries and cascading requests.
- Inefficient authentication or authorization checks.
- Event-loop lag, CPU saturation, memory pressure and connection-pool exhaustion.
- Cold starts, serverless runtime limitations and startup costs.

Trace expensive user actions across the frontend, API, database, Python service and worker queues.

### C. Database and connection management

Inspect:

- Slow queries and query plans.
- Missing or inappropriate indexes.
- Sequential scans on high-volume tables.
- N+1 queries.
- Over-fetching and inefficient joins.
- Missing pagination or limits.
- Transaction duration and lock contention.
- Duplicate queries triggered by a single screen.
- Connection-pool settings and exhaustion.
- Excessive connection setup or reconnecting.
- Redis usage, cache hit rates and invalidation behavior, where measurable.
- Large data transfers and inefficient aggregations.

Use available PostgreSQL statistics and query logs where authorized.

Run expensive `EXPLAIN ANALYZE` operations only on safe, representative queries in an appropriate test environment. Do not perform risky or unbounded profiling against production tables.

Recommend indexes based on observed query plans and access patterns. Verify the improvement after changes.

Do not add caching as a blanket solution. Respect tenant boundaries, authorization, data freshness and invalidation requirements.

### D. Python, OpenCV, PDF processing and model loading

Pay particular attention to `apps/api-python`.

Determine whether performance costs come from:

- Heavy imports delaying service startup.
- Model initialization occurring for every request instead of being safely reused.
- PDF decoding or rendering costs.
- Large image processing and unnecessary image-resolution conversions.
- High memory consumption.
- CPU-bound processing inside asynchronous request handlers.
- Blocking HTTP clients.
- Excessive image payload sizes sent to vision models.
- Duplicate OCR and model calls for the same content.
- Inefficient page-by-page processing.
- Worker concurrency that is too high or too low.
- Queue backlog, retry storms or unbounded job execution.
- Memory leaks or worker crashes during large PDFs.
- Unnecessary conversion between image, PDF and text formats.
- Missing timeouts, file-size limits or pixel-count limits.

Profile representative workload steps individually.

Distinguish model cold-start time, OCR time, PDF processing time, AI provider latency and queue waiting time.

Where appropriate, reuse initialized resources, batch compatible operations, reduce unnecessary conversions, apply safe concurrency limits, stream large files and move CPU-bound tasks into controlled workers.

Do not introduce multiprocessing, distributed infrastructure or new heavyweight models without measurable justification.

### E. AI and external API calls

Trace all model calls triggered by one examination and determine:

- How many calls each feature makes.
- Which calls are duplicated.
- Which calls are unnecessary for the result.
- Whether requests use oversized inputs.
- Whether retries can trigger duplicate paid requests.
- Which operations can use deterministic code, local OCR or a cheaper suitable model.
- Whether model fallback increases latency or cost.
- Whether provider throttling affects other user requests.

Do not switch to a cheaper model automatically if doing so harms evaluation quality.

Use measured provider pricing, actual request sizes and representative usage when estimating savings.

Protect sensitive student information and ensure that caching does not expose one tenant's data to another tenant.

### F. Background queues and concurrency

Inspect BullMQ/Redis queues and worker behavior.

Measure queue depth and processing time where observable.

Investigate duplicate jobs, expensive retry loops, worker starvation, blocked workers, excessive concurrency and jobs without bounded timeouts.

Ensure that heavy PDF/OCR processing cannot unexpectedly exhaust resources required by ordinary API requests.

Use backpressure, limits and graceful failure where appropriate.

### G. Hosting and infrastructure

Inspect actual deployment configuration, compute resources, CPU/memory limits, container startup, cold starts, database tier, network latency and service locations.

Do not assume the current server is inadequate without evidence.

Determine whether the bottleneck is resource saturation, unsuitable configuration, excessive service-to-service latency, inefficient code, external API latency or a combination of factors.

Recommend the lowest-cost, technically sound changes first.

---

# PHASE 4 — Implement Evidence-Based Performance Fixes

## 9. Diagnose First, Then Improve

Create a ranked root-cause list before implementing broad changes.

For each issue, record:

- Affected user workflow.
- Observed symptom.
- Root-cause evidence.
- Relevant code or configuration.
- Impact on latency, memory, reliability or cost.
- Proposed fix.
- Regression risk.
- How the improvement will be measured.

Classify issues by priority.

**P0 — Critical:** Cross-tenant access, corrupted marks, data loss, broken core workflows, unsafe AI finalization or severe instability.

**P1 — High:** Major user-visible latency, repeated expensive API requests, database bottlenecks, memory exhaustion, unreliable scan processing or failures affecting ordinary usage.

**P2 — Medium:** Avoidable frontend requests, slow non-critical routes, inefficient PDF rendering, excessive bundle size or non-critical worker inefficiency.

**P3 — Low:** Minor cosmetic performance improvements with little measurable user impact.

### Fix strategy

Implement justified changes within the existing architecture.

Examples of acceptable solutions include:

- Correcting duplicate React Query requests.
- Improving caching and query invalidation.
- Adding a proven database index.
- Introducing appropriate pagination.
- Reusing safe initialized Python resources.
- Replacing blocking calls in asynchronous handlers.
- Optimizing PDF and image processing.
- Reducing repeated AI calls.
- Improving lazy loading and bundle splitting.
- Correcting retry and queue-concurrency behavior.
- Improving timeouts, structured error handling and health checks.

These are investigation candidates, not predetermined causes. Only apply a change after confirming that it addresses a real problem.

Do not redesign the whole system just because one endpoint or component is slow.

## 10. Minimize Load and Protect Multi-User Performance

The system must handle multiple institutes and concurrent users without one heavy operation making the entire website feel slow.

Evaluate:

- Concurrent teachers using the evaluation workspace.
- Multiple institutes processing PDFs simultaneously.
- Several simultaneous OCR or AI-evaluation jobs.
- Concurrent dashboard and report requests.
- Queue delays during high-volume exams.
- Database connection utilization.
- Memory growth during long sessions.
- Fairness and isolation between tenants.

Use realistic synthetic datasets and establish a repeatable baseline.

Perform load and stress testing in isolated staging infrastructure. Never generate uncontrolled production traffic or run destructive load tests against the live database.

Use observed workloads to determine appropriate concurrency and capacity limits.

If the existing architecture cannot support a workload safely, report the minimum justified infrastructure or architectural change rather than overengineering the platform.

---

# PHASE 5 — Controlled Six-Agent Integration

## 11. Integrate All Workstreams Safely

Review each agent's branch or worktree before combining changes.

Do not blindly merge code because an agent claims the task is complete.

For every changed file:

1. Review the diff.
2. Confirm scope and intended behavior.
3. Identify shared interfaces and potential conflicts.
4. Run focused regression tests.
5. Integrate the change.
6. Run cross-service tests after integration.

Preserve working source files and existing user changes.

If an agent introduced a regression, isolate the cause and implement the smallest safe correction.

If a change conflicts with another agent's work, coordinate the interface and resolve the conflict deliberately rather than overwriting either implementation.

Record which changes came from each agent and which additional corrections you made.

---

# PHASE 6 — Regression Testing and Performance Comparison

## 12. Run the Final Integrated Test Suite

After integration, run all applicable checks:

- Backend unit and integration tests.
- Python unit and integration tests.
- Frontend tests.
- Type checks, linting and production builds.
- Database migration validation.
- Tenant isolation and authorization tests.
- Paper-generation and QR-signature tests.
- PDF segmentation and OMR tests.
- AI evaluation and governance tests.
- Analytics, remediation and report-generation tests.
- Notification tests.
- Browser-level end-to-end tests.
- Relevant performance and concurrent-workload tests.

Inspect test output and exit codes.

If a test cannot run because credentials, hardware, a provider account or infrastructure are unavailable, report exactly what is missing. Never claim that the corresponding production behavior has been verified.

## 13. Before-and-After Performance Scorecard

Produce a measured comparison for the important workflows.

| Metric | Baseline | After fixes | Change | Evidence |
|---|---|---|---|---|
| Initial page load | Measure | Measure | Calculate | Browser test |
| LCP / INP / CLS | Measure where possible | Measure | Calculate | Lighthouse/field data |
| Dashboard API latency | Measure | Measure | Calculate | Request trace |
| Exam page API count | Measure | Measure | Calculate | Network waterfall |
| Paper-generation time | Measure | Measure | Calculate | Timed test |
| PDF ingestion/segmentation time | Measure | Measure | Calculate | Processing logs |
| OCR/AI evaluation latency | Measure | Measure | Calculate | Per-stage timings |
| Database query latency | Measure | Measure | Calculate | Query statistics |
| Peak memory/CPU | Measure | Measure | Calculate | Runtime profiling |
| Queue waiting time | Measure | Measure | Calculate | Queue metrics |
| Relevant error rate | Measure | Measure | Calculate | Test/runtime logs |

Do not fabricate baseline values or show percentage improvements without actual measurements. If a metric is unavailable, report it as unavailable and explain how it should be measured.

Test the same workload under comparable conditions before and after optimizations.

## 14. Verify Cost and Stability Improvements

Estimate the operational impact of the verified fixes.

Where data permits, report:

- AI requests per exam and per student.
- Estimated AI cost per examination.
- PDF processing cost or resource use.
- Database and infrastructure utilization.
- Retry-related waste.
- Expected capacity at tested concurrency.
- Infrastructure changes that could reduce cost.
- Infrastructure changes that are necessary to meet observed workload.

Keep estimated savings separate from measured savings.

Do not reduce resource limits or disable safety controls merely to lower the hosting bill.

---

# PHASE 7 — Security, Privacy and Release Safety

## 15. Mandatory Security and Data Integrity Checks

Verify:

- Tenant isolation.
- Authentication and authorization.
- Student document access.
- QR signature validation.
- Safe file upload and processing.
- Input validation.
- Rate limiting and abuse protection.
- Safe background job processing.
- Secret handling and log redaction.
- Backup and restoration evidence.
- Exam-lock and human-approval invariants.
- Correct handling of external provider failures.

Preserve the product's intended privacy and security controls.

Do not expose credentials, student records, personal information or confidential logs in generated reports.

Do not claim full legal compliance based solely on code inspection.

## 16. Deployment Policy

You are authorized to inspect the live website using appropriate safe tests and to implement justified fixes in the working repository.

You are not authorized to deploy to production, run destructive operations on production data, alter production database schemas without approval, or trigger uncontrolled traffic.

After implementing local code fixes, distinguish clearly between:

- Verified behavior on the current live deployment.
- Verified behavior on staging.
- Verified behavior in automated local tests.
- Improvements implemented locally but not yet deployed.
- Remaining production-only verification requirements.

Never state that the live website has been fixed when the fix has not been deployed and verified.

---

# PHASE 8 — Required Deliverables

## 17. Produce the Final Engineering Report

Create:

`E:\sarvlekh\aios\docs\quality\FINAL_PRODUCTION_READINESS_AND_PERFORMANCE_REPORT.md`

Include:

### A. Executive summary

Explain the current state of the platform in plain English. Identify the highest-impact defects, primary performance bottlenecks and most important remaining risks.

### B. Six-agent verification matrix

For each agent, list completed changes, integration status, relevant tests, actual results and unresolved issues.

### C. Live-website test results

List the routes and user workflows tested, the environment used, the date, any blockers and the evidence supporting each conclusion.

### D. Performance root-cause analysis

Identify the actual reason or reasons the website feels slow.

For every major finding, cite the relevant route, query, component, service, trace, benchmark or log. Clearly distinguish proven causes from plausible hypotheses.

### E. Remediation record

For each fix, list files changed, why the change was necessary, regression coverage and measured before-and-after results.

### F. Performance baseline and comparison

Save supporting results where useful in:

`E:\sarvlekh\aios\docs\quality\PERFORMANCE_BENCHMARKS.md`

Include commands, configurations, sample sizes, environment details and relevant limitations so results can be reproduced.

### G. End-to-end acceptance matrix

Document whether all major exam workflows work correctly after integration.

### H. Remaining production risks

List unresolved P0, P1, P2 and P3 issues in priority order, including owner, impact and recommended next step.

### I. Release recommendation

Choose one:

- Ready for controlled pilot.
- Ready for limited production rollout with documented restrictions.
- Not ready until specified critical issues are resolved.

Support the recommendation with test evidence rather than a subjective score.

## 18. Definition of Success

Success means:

- All six workstreams have been checked against their actual implementation.
- Their important workflows work together rather than only in isolation.
- High-impact performance bottlenecks have been identified using evidence.
- Justified fixes have been implemented and regression-tested.
- Concurrent workload limitations are understood.
- No critical feature has been broken by the improvements.
- No billing implementation has been introduced.
- The before-and-after results are measurable and reproducible.
- Remaining limitations are disclosed honestly.
- The final release decision is based on evidence.

**Final instruction:** Approach this as a senior engineering team improving an existing product that deserves a fair, evidence-based path to production. Be ambitious about quality and optimization, conservative about unsupported claims, and disciplined about protecting working features.

Start by reading all audit reports, checking the current repository and agent worktrees, identifying the deployed website, and measuring the existing performance baseline.

Then validate the six workstreams, trace the real causes of slowness, implement safe high-impact fixes, run integrated regression and performance tests, and produce the final report.

Do not stop at recommendations. Implement the safe and justified improvements within scope, and clearly identify anything that requires additional access, infrastructure or approval.
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-10-28T23:08:48+05:30.
</ADDITIONAL_METADATA>
<USER_SETTINGS_CHANGE>
The user changed setting `Model Selection` from None to Gemini 3.8 Flash (High). No need to comment on this change if the user doesn't ask about it. If reporting what model you are, please use a human readable name instead of the exact string.
</USER_SETTINGS_CHANGE>