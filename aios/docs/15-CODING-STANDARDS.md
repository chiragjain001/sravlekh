# 15 — Coding Standards
## AIOS — Academic Intelligence Operating System

## 1. Languages & Frameworks
- **TypeScript** (strict mode: `"strict": true`) across `apps/web`, `apps/api`, `packages/*`.
- **Python 3.11+** for `apps/api-python`, typed with Pydantic models and type hints everywhere (`mypy`/`pyright`-checked in CI).

## 2. TypeScript Rules
- `any` is **not allowed** unless explicitly justified with an inline comment explaining why (e.g., interop with an untyped third-party lib) and reviewed in PR.
- No business logic inside UI components (`apps/web`) — components call hooks/services that call the API; domain rules live server-side (NestJS services), never duplicated in the frontend beyond UX-only pre-validation.
- Services (`*.service.ts`) contain business logic; Controllers (`*.controller.ts`) only handle HTTP concerns (parsing, status codes, delegating to services); Repositories/Prisma calls are the only DB access layer — no raw Prisma calls inside controllers.
- DTOs (`class-validator`/`zod` schemas) define every API request/response contract explicitly — no implicit `any`-shaped payloads.

## 3. Python Rules
- Pydantic models for every FastAPI request/response body — no raw `dict` handling at the route boundary.
- Type hints required on all function signatures; `mypy`/`pyright` run in CI with no unchecked modules.
- Business/analytics logic lives in dedicated service modules (`services/mastery_engine.py`, `services/blueprint_agent.py`), not inline in route handlers.

## 4. Naming Conventions
- Files: kebab-case for TS files (`exam-state-machine.service.ts`), snake_case for Python (`mastery_engine.py`).
- Classes/Types: PascalCase (`ExamStateMachineService`, `MasteryScore`).
- Variables/functions: camelCase (TS), snake_case (Python).
- Enums match the Prisma schema's exact casing (e.g., `MistakeTagType.CONCEPT_ERROR`) — never re-stringify or transform enum values between layers.
- Database tables: snake_case, plural (`student_profiles`) — see 04-DATABASE-SCHEMA.md.

## 5. Folder Organization
See 16-FOLDER-STRUCTURE.md for the authoritative layout — this document assumes that structure.

## 6. Functions & Components
- Keep functions small and single-purpose; a service method that both validates, mutates, and sends a notification should be decomposed into three composable steps unless there's a specific transactional reason to inline them.
- React components: functional components with hooks only (no class components); one component per file; co-locate a component's own hook/util only if not reused elsewhere — shared logic moves to `packages/ui` or `apps/web/src/hooks`.
- Prefer composition over inheritance/duplication in both TS and Python service layers.

## 7. Error Handling
- Every service method that can fail in a documented way throws a typed domain exception (e.g., `InvalidStateTransitionException`), caught by a global exception filter that maps it to the standard error envelope (08-ERROR-HANDLING.md) — never return raw `null`/`undefined` to signal failure ambiguously.
- Every `await`ed external call (DB, cache, HTTP to Python service, third-party provider) is wrapped with explicit error handling — no unhandled promise rejections, no bare `except:` in Python (always catch specific exception types).

## 8. Comments & Documentation
- Comments explain **why**, not what (the code should already say what) — e.g., "// mastery threshold is a hard product requirement, see PRD §8" rather than "// check if score < 0.5".
- Every exported service/module has a docstring/JSDoc summarizing its responsibility and, where non-obvious, which document it implements (traceability back to 01/03/04/05).
- No commented-out dead code committed — delete it; git history preserves it if ever needed.

## 9. Dependency Rules
- Do not introduce a new dependency without checking whether an existing one already solves the problem (e.g., don't add a second date library when `date-fns` is already present).
- Every new dependency addition in a PR includes a one-line justification in the PR description.
- No dependency with a known unmaintained status (>2 years no release, no security patches) is added without an explicit documented exception.

## 10. Linting & Formatting
- ESLint (with a shared config in `packages/config`) + Prettier for all TS/JS; CI-enforced, not just editor-integrated.
- `ruff` (or equivalent) + `black`-style formatting for Python; CI-enforced.
- No PR merges with lint errors; lint warnings are tracked but do not block (warnings are reviewed periodically to be promoted to errors or removed).

## 11. Git Conventions
- Conventional Commits style (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`) for commit messages, enabling changelog automation.
- One logical change per PR; PR description references the relevant FR-code(s) from 03-FEATURE-SPECIFICATIONS.md or the relevant doc section being implemented.
- No merge commits into `main`/`develop` from feature branches beyond the standard PR-merge mechanism (squash or rebase merge only, per repo settings).

## 12. Guardrails (MUST / MUST NOT)
```
MUST:
- TypeScript strict mode everywhere in apps/web and apps/api
- PostgreSQL as the only system-of-record database
- REST (JSON over HTTPS) as the API style — no ad-hoc GraphQL/RPC layers introduced without an ADR
- Multi-tenant instituteId scoping on every tenant-owned query
- RBAC guard decorators on every NestJS route
- Automated tests for all critical business logic (13-TESTING-STRATEGY.md)

MUST NOT:
- Use `any` in TypeScript without justification
- Store secrets in frontend code or NEXT_PUBLIC_* env vars
- Put SQL/Prisma calls directly in UI components or controllers
- Duplicate business logic between NestJS and the frontend beyond UX pre-validation
- Use localStorage/sessionStorage for auth tokens
- Add a dependency without justification
- Trust a client-supplied instituteId, role, or userId for authorization decisions
```

## 13. Additional Discipline Rules (apply across all engineering work on this repo)
1. Read `/docs` before modifying code.
2. Never change architecture without documenting the reason (update the relevant doc + note in PR).
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

These rules are also codified verbatim in the repository's `AGENTS.md` (see 20-IMPLEMENTATION-PLAN.md and the execution protocol) so any AI coding agent working on this repo inherits them automatically.
