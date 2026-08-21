# 06 — Authentication & Authorization
## AIOS — Academic Intelligence Operating System

---

## 1. Authentication
- **Mechanism:** Google OAuth 2.0 (id_token verification) as the sole production login method. A **mock role token** login path exists only in non-production environments (local/dev/staging) for engineering velocity, gated by `NODE_ENV !== 'production'` — it must be hard-disabled in production builds (see 07-SECURITY-SPECIFICATION.md).
- **Identity binding:** `User.googleSub` is the stable identity anchor (Google's subject claim), not email, since email can theoretically change on some identity providers; email is used only for the AllowList lookup at first login.
- **Session:** Stateless JWT access token. Payload: `{ sub: userId, instituteId, role, iat, exp }`. Expiry: 12 hours. No refresh-token rotation in Phase 1 — re-login required after expiry (refresh tokens are a Phase 2 hardening item, tracked in 20-IMPLEMENTATION-PLAN.md).
- **Token storage (client):** httpOnly, Secure, SameSite=Lax cookie — **never** localStorage (XSS exposure).

## 2. Role Hierarchy
```
FOUNDER   (platform-wide, cross-tenant)
   ↓
ADMIN     (institute-wide, single tenant)
   ↓
TEACHER   (assigned batches/subjects within tenant)
   ↓
STUDENT   (self-scoped within tenant)
```
Roles are **not hierarchical permission inheritance in code** — each role's allowed actions are explicitly enumerated (see matrix below), not derived by "higher role can do everything lower role can." This avoids privilege-creep bugs; e.g. FOUNDER does not automatically get TEACHER's batch-grading UI context, since FOUNDER has no `TeacherProfile`.

## 3. Tenant Boundary Rule
**Absolute rule:** For every request except those under `/founder/*`, the server must verify `actor.instituteId === resource.instituteId` for every resource touched, server-side, using the JWT-derived `instituteId` — **never** an `instituteId` supplied in the request body/query from the client. Client-supplied tenant IDs are always ignored or rejected if they don't match the token.

```
Teacher can:
✓ Create/edit questions in own institute
✓ Create/edit exams for assigned batches only
✓ Grade answer sheets for assigned batches only
✓ View mastery scores for students in assigned batches
✓ Respond to doubt tickets assigned to them

Teacher cannot:
✗ Access another institute's data (structurally blocked by instituteId scope)
✗ Approve their own authored question if not reviewer-flagged
✗ Unlock a LOCKED exam
✗ Modify AllowList entries or user roles
✗ View AuditLog

Admin can:
✓ Everything Teacher can, institute-wide (not just assigned batches)
✓ Manage AllowList, users, batches, curriculum
✓ Approve questions, unlock exams (with reason)
✓ View institute AuditLog

Admin cannot:
✗ Access another institute's data
✗ Modify platform-wide plan/billing (FOUNDER only)
✗ Grant FOUNDER role via AllowList

Founder can:
✓ Cross-tenant read access to institute health/usage metrics
✓ Provision/suspend/archive institutes, change plan tier
✓ Toggle feature flags per institute
✓ View global AuditLog

Founder cannot (by product design, not just missing UI):
✗ Directly edit a tenant's academic data (curriculum, exams, grades) — platform ops stays out of academic content to preserve institute trust boundary; any support access must go through an explicit, audited "impersonation" flow (Phase 2), not silent direct writes.
```

## 4. Full Permission Matrix
| Functional Module | FOUNDER | ADMIN | TEACHER | STUDENT |
|---|:---:|:---:|:---:|:---:|
| Tenant & SaaS Subscription Mgmt | RW | – | – | – |
| Platform System Health & Logs | R | – | – | – |
| User AllowList Management | RW | RW (own tenant) | – | – |
| Batch & Curriculum Setup | RW | RW | R | R |
| Question Bank & Approval | RW | RW | RW (author; approve only if reviewer) | – |
| Blueprint & Paper Generation | RW | RW | RW | – |
| Exam Scheduling & Status Change | RW | RW | RW (up to REVIEW submit) | R |
| Unlock Locked Exam | RW | RW (reason required) | – | – |
| Marks Capture & Evaluation Queue | RW | RW | RW (assigned batch) | – |
| Mistake Tagging & Score Override | RW | RW | RW (assigned batch) | – |
| Mastery Index & Diagnostic View | RW | RW | RW (assigned batch) | R (self only) |
| Remedial / Extra Class Scheduling | RW | RW | RW (assigned batch) | R |
| Doubt Ticket Resolution | RW | RW | RW (assigned only) | Create/Read (own) |
| Homework Assignment Creation | RW | RW | RW | Submit (own) |
| Notice Center Broadcast | RW | RW | RW (own batches) | R |
| Audit Log Access | RW (global) | R (tenant) | – | – |

*Legend: RW = Read & Write, R = Read Only, – = No Access.*

## 5. Enforcement Mechanism (NestJS)
- Every controller route decorated with `@Roles(Role.ADMIN, Role.TEACHER, ...)`.
- `RolesGuard` checks JWT role against the decorator's allowed set — first gate.
- `TenantScopeGuard` (custom) resolves the target resource's `instituteId` (via a lightweight lookup or the route param) and compares to `actor.instituteId`; FOUNDER bypasses this specific guard but is still subject to `@Roles`.
- `BatchScopeGuard` (custom, applied to TEACHER-facing batch-scoped endpoints) additionally verifies the TEACHER has an active `BatchTeacher` row for the target batch — this is what enforces "assigned batch only" beyond simple tenant scope.
- Guards execute in this order: `AuthGuard (JWT) → RolesGuard → TenantScopeGuard → BatchScopeGuard (where applicable)`. A failure at any stage short-circuits with the appropriate 401/403.

## 6. Password / OAuth Rules
- No first-party password storage exists (Google OAuth only) — eliminates password-related attack surface entirely in Phase 1.
- OAuth `state` parameter used for CSRF protection on the login redirect flow.
- `googleSub` uniqueness enforced at the DB level; a `googleSub` can only ever map to one `User` row per institute (a person with accounts across multiple institutes gets one distinct `User` row per institute, all linked to the same `googleSub`, since `[instituteId, email]` and `googleSub` uniqueness are scoped independently — `googleSub` is globally unique but a person can legitimately have separate User rows in separate institutes).

## 7. Admin Privileges — Explicit Boundaries
Admin privileges are **tenant-absolute but platform-relative-zero**: an Admin has full RW over everything inside their `instituteId`, but zero visibility or effect outside it. This is enforced identically whether the Admin is acting through the UI or directly against the API — there is no "trusted client" assumption anywhere (see 07-SECURITY-SPECIFICATION.md: "never trust client-side authorization").

## 8. Session & Token Rules Summary
| Rule | Value |
|---|---|
| Token type | JWT (HS256 or RS256 per environment — RS256 in production) |
| Expiry | 12 hours |
| Refresh | Not implemented Phase 1 — re-auth required |
| Storage | httpOnly Secure cookie |
| Revocation | Founder "force logout" invalidates via a server-side token-version bump stored on `User` (`tokenVersion` column checked on every request) |
| Mock/dev login | Disabled outside `NODE_ENV=development|test` builds, verified by a CI check that fails the build if the mock login route is reachable in a production bundle |


---

# V2 ADDENDUM (merged from the relevant V2 section of that document)

## V2 Extension Notes
Add **Section 9: Role/Permission/Scope Model (v2)**:
- Restate `21-DOMAIN-MODEL-V2.md` §4.10's `User ─< UserRoleAssignment >─ Role → Permission + Scope` model as the authoritative extensibility mechanism.
- Add the `REVIEW_EVALUATION` permission to the permission catalog, explicitly noting it is **not implied by the ADMIN role** by default — it must be explicitly granted, even to an ADMIN account, since evaluation-review authority is treated as a distinct, auditable capability from general tenant administration (per `25-EVALUATION-ENGINE.md` §4.3).
- Add to the Permission Matrix (v1 §4) two new rows:

| Functional Module | FOUNDER | ADMIN | TEACHER | STUDENT | REVIEWER (permission-based) |
|---|:---:|:---:|:---:|:---:|:---:|
| Document Upload & Identity Resolution | RW | RW | RW (assigned batch) | – | – |
| Rubric Authoring | RW | RW | RW (author/assigned) | – | – |
| AI-Suggested Evaluation Review (Teacher decision) | RW | RW | RW (assigned batch) | – | – |
| Evaluation Override (Reviewer) | RW | Requires explicit grant | Requires explicit grant | – | RW |
| Evaluation Quality Analytics | R (global) | R (tenant) | – | – | – |

- Note: this table's REVIEWER column represents a **permission grant**, not a fifth hardcoded role — any User (typically a senior TEACHER or a dedicated Exam Coordinator account) can hold it.

