# 38 — SESSION AND REFRESH TOKENS

Status: **implemented and tested**, 2026-09-11. Closes the P1 recorded in
`PRODUCTION-READINESS-AUDIT.md` §1.2 ("Refresh-token rotation — **H** —
`grep -i "refresh.?token"` in `apps/api/src` = **0 hits**") and the related
"Token storage — **B** — XSS → token exfiltration".

Supersedes the session description in `06-AUTH-AUTHORIZATION.md` §1 where the two
disagree; that document predates this work.

---

## 1. What was wrong

The only session credential was a **7-day access JWT in `localStorage`**.

| Problem | Consequence |
| :--- | :--- |
| Readable by page JavaScript | Any XSS exfiltrates a credential valid for a week |
| No per-session revocation | The only lever was `User.tokenVersion`, which logs the user out of **every** device — too blunt to use on one suspicious session, so in practice never used |
| Claims fixed for 7 days | A role change, suspension or force-logout took up to a week to bite (mitigated only by `tokenVersion`'s mid-session check) |

## 2. What it is now

```
 login  ──▶  access JWT   (15 min, localStorage, Authorization header)
        └─▶  refresh token (30 days, httpOnly cookie, never in a response body)

 401 ──▶ client calls POST /auth/refresh with the cookie
      ──▶ server ROTATES: old token marked used, new one issued, same family
      ──▶ new access token minted from a FRESH database read of the user
```

**The session is not shorter than before — it is longer (30 days).** What
shortened is the lifetime of the credential that JavaScript can reach.

| Endpoint | Auth | Purpose |
| :--- | :--- | :--- |
| `POST /auth/refresh` | the cookie itself (`@Public()`) | Rotate + mint a new access token |
| `POST /auth/logout` | the cookie itself (`@Public()`) | End **this** session only |
| `PATCH /users/me/logout-all-devices` | access token | End every session, every device |

Both new endpoints are `@Public()` deliberately: by the time a client needs
either, its access token has usually expired. Requiring a valid access token to
log out would mean the button stops working exactly when it is most needed.

## 3. Design decisions

| Decision | Reasoning |
| :--- | :--- |
| **Only the SHA-256 hash is stored** | A read of `refresh_tokens` — leaked backup, injection, over-broad support query — must not yield usable credentials. Same reasoning as never storing passwords. |
| **SHA-256, not bcrypt/argon2** | Slow hashing exists to survive offline attack on a *low-entropy human-chosen* secret. This is 256 bits of CSPRNG output: no dictionary, nothing to slow down. A slow hash on every lookup would make the refresh endpoint a self-inflicted DoS amplifier. |
| **httpOnly cookie, not a response body** | A body is readable by page JavaScript, and therefore by XSS — the exact exposure this exists to remove. |
| **`sameSite: 'strict'`, `path=/api/v1/auth`** | Strict closes CSRF on the refresh endpoint. Path-scoping keeps the cookie out of the headers of every unrelated API call, where a proxy log or error reporter could capture it. |
| **Rotation on every refresh** | A stolen token stops working the moment the real client next refreshes. Without rotation, theft is permanent and invisible. |
| **Reuse ⇒ revoke the whole family** | An already-rotated token means two copies exist and there is no way to tell which just arrived. Killing the family converts silent indefinite theft into one visible logout. |
| **Revoke by `familyId`, not `userId`** | A stolen phone session must not log out the laptop. |
| **User re-read from the DB on refresh** | The entire point of a short access token. A suspension, role change or force-logout must bite within minutes; copying old claims forward would let a suspended user mint valid tokens for 30 days. |
| **Rotated rows retained ~7 days** | Deleting them immediately would **disable reuse detection** for them: a replayed stolen token would read as "unknown" rather than "reused", and the family would never be revoked. |
| **`revokeAllForUser` on force-logout** | `tokenVersion` alone kills access tokens, but a live refresh token would immediately mint a new one carrying the *new* `tokenVersion` — quietly undoing the force-logout within minutes. |

### 3.1 Concurrent refresh — the subtle part

Two tabs whose access tokens expire together both refresh with the same cookie.
One wins; the other presents a token that is *already rotated* — indistinguishable
from theft. Revoking there would log real users out for having two tabs open.

So there are two defences, and they answer different questions:

1. **`CONCURRENT_REFRESH_GRACE_MS` (30 s).** A token rotated *just now* is a
   benign race: reject with `Please retry.` and revoke **nothing**. The winner's
   `Set-Cookie` has already replaced the cookie, so the client's retry carries the
   new token. Outside the window there is no innocent explanation, and the family
   dies.
2. **A conditional `updateMany` (`rotatedAt: null`) inside the transaction.** Both
   requests read the row as un-rotated, so the *database* — not the application —
   picks the winner. Without it both would "succeed" and mint two live successors
   from one token, silently forking the session.

The client also single-flights: one shared in-flight refresh promise, so a
dashboard firing twenty requests produces one refresh, not twenty.

## 4. A bug found only by testing against a real database

The unit spec mocks Prisma, and its `$transaction` simply calls the callback — so
it cannot see contention. Run against real PostgreSQL, **ten simultaneous
rotations produced one winner, one clean loser, and eight `P2028 — Unable to
start a transaction in the given time`.**

Interactive transactions hold a pooled connection across several round trips, so
a burst exhausts the pool and most requests fail *before they begin*. That burst
is not hypothetical: it is what one user with several tabs generates, and what
every active user generates at once after an API restart.

Unhandled, those surfaced as 500s, which the client reads as "session over" —
**logging people out because the server was briefly busy.** `P2028` (could not
start) and `P2034` (write conflict / deadlock) both mean *nothing was committed*,
so the presented token is still valid and a retry is correct. Both now map to the
retry path; any other Prisma error still propagates rather than being hidden.

## 5. Tests

| Suite | Count | Covers |
| :--- | :--- | :--- |
| `refresh-token.service.spec.ts` | 25 | Hash-only storage, entropy, per-login families, normal refresh, rotation atomicity, expiry, revocation, replay, grace window, transaction-contention mapping, cleanup retention, session listing |
| `refresh-token.integration.spec.ts` | 7 | The same against **real PostgreSQL** — including 10-way concurrent rotation (exactly one winner, exactly one successor row) |
| `users.service.spec.ts` | +3 | Force-logout and logout-all-devices actually revoke refresh sessions |

Integration tests are **skipped unless `TEST_DATABASE_URL` is set**, so the
default suite stays hermetic:

```bash
docker compose -f infra/staging/docker-compose.yml up -d staging-db
TEST_DATABASE_URL="postgresql://aios_staging:staging_local_only@localhost:5433/aios_staging" \
  npx jest src/auth/refresh-token.integration
```

Full suite after this work: **712 passed / 47 suites**, `tsc --noEmit` clean,
eslint 0 errors.

## 6. Deployment coupling — read before shipping

`JWT_EXPIRES_IN` default changed from `7d` to **`15m`**.

**An API on this default, served to a frontend that predates this work, logs
users out every 15 minutes** — that client does not know to call `/auth/refresh`.
Deploy API and web together, or set `JWT_EXPIRES_IN=7d` until the frontend ships.

Existing sessions are unaffected: already-issued tokens keep their original
expiry. Users who log in after the deploy get the new scheme.

## 7. Known gaps

- ~~**`aiClient` does not refresh.**~~ **Closed 2026-09-11.** This entry originally
  called the gap "low impact" on the theory that every AI screen also makes
  `apiClient` calls. That understated it: the Python engine verifies the same JWT
  and returns 401 on expiry, so with a 15-minute token an AI screen used after the
  token lapsed failed outright until some unrelated call happened to refresh. The
  401 handling is now one shared `retryAfterRefresh()` used by both clients, with
  `api-client.test.ts` covering it (verified to fail against the old code).
- ~~**No scheduled cleanup job.**~~ **Closed 2026-09-11.**
  `RefreshTokenCleanupService` runs `cleanupExpired()` hourly
  (`REFRESH_TOKEN_CLEANUP_INTERVAL_MS`), worker-process only, `unref()`d timer.
- **No UI for session listing.** `listActiveSessions()` exists and is tested;
  nothing surfaces it. "Here are your active sessions, revoke one" is the natural
  next feature.
- **The access token is still in `localStorage`.** Moving it to a second httpOnly
  cookie would close the remaining XSS window entirely, at the cost of a CSRF
  token for every mutating request. The 15-minute lifetime is the mitigation for
  now, and it is a real reduction, not a fix.
