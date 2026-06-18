# SRE Copilot — Authentication & RBAC Implementation Plan

**Status:** Proposed (awaiting approval)
**Branch:** `CR/auth-rbac` (do **not** merge to `main` until reviewed)
**Owner:** Prakhar Mathur
**Related:** `AUDIT.md` P0 items #1 (auth), #2 (CORS), #3 (secret masking), #5 (RBAC)

---

## 1. Goal

Close the audit's single most damaging blocker — **zero authentication on a surface that exfiltrates secrets, writes `.env`, and deletes pods** — with a **self-contained, in-system identity model** that is secure today and a clean on-ramp to enterprise SSO later.

No external identity provider for v0. We own the user store. But every piece is built **behind a swappable identity interface** so OIDC/SAML can slot in later without rewriting the app (this is the enterprise revenue path).

---

## 2. Decisions locked in

These were agreed during product/strategy review:

1. **Self-contained username + password** — no external IdP in v0; the system manages users itself.
2. **Generated bootstrap admin password, not a known default.** On first startup the system generates a random admin password and prints it **once** to the console/setup log (Jenkins `initialAdminPassword` pattern). Admin is **forced to change it on first login**. No guessable `admin/admin` window ever exists.
3. **Admin invites users.** Admin creates a user with `username` + `role`. The system generates a random temp password. On the user's **first login**, they are **forced to set their own password**.
4. **Forgot password is symmetric.** Admin triggers a reset → system issues a new temp password → user is forced to change on next login. No email dependency.
5. **Role ladder:** Viewer → Responder → Maintainer → Admin → Owner (each inherits the one below).
6. **Destructive ops are cross-cutting privileged capabilities** (pod delete, secret writes, `.env` mutation, prod chaos) — role grants the door; **step-up re-auth** unlocks it each time (step-up lands in Phase 1; the seam is designed in Phase 0).
7. **Non-negotiable security baseline:** password hashing (bcrypt/argon2), server-side sessions in `httpOnly`+`Secure`+`SameSite` cookies, CSRF tokens on mutating routes, login rate-limit + lockout, and an audit log of auth + destructive events.
8. **CORS locked to an explicit allow-list** — this, plus cookie sessions + CSRF, closes the wildcard-CORS-with-credentials hole (`main.py:43-49`).
9. **Machine path is separate.** The Alertmanager webhook authenticates via **HMAC shared secret**, never via the human session path — so alert ingestion is never coupled to dashboard login.

---

## 3. Roles & permission matrix

Least → most privilege. Each role inherits everything below it.

| Capability | Viewer | Responder | Maintainer | Admin | Owner |
|---|:--:|:--:|:--:|:--:|:--:|
| View incidents / post-mortems / dashboards / SSL | ✅ | ✅ | ✅ | ✅ | ✅ |
| View pod list, cluster health | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ack / assign / note / **resolve** incidents | — | ✅ | ✅ | ✅ | ✅ |
| View pod YAML & logs, read-only diagnostics | — | ✅ | ✅ | ✅ | ✅ |
| Trigger runbook **recommendation** | — | ✅ | ✅ | ✅ | ✅ |
| Manage noise rules / maintenance windows / SSL domains | — | — | ✅ | ✅ | ✅ |
| Manage connectors (non-secret config), test connections | — | — | ✅ | ✅ | ✅ |
| **Delete** incidents, **execute** runbooks, chaos (non-prod) | — | — | ✅ | ✅ | ✅ |
| Manage users & role assignments | — | — | — | ✅ | ✅ |
| Read/write **secrets** & LLM keys (write-only) | — | — | — | 🔐 | 🔐 |
| **Destructive infra** (pod delete, prod chaos) | — | — | — | 🔐 | 🔐 |
| Billing / org settings / **ownership transfer** | — | — | — | — | ✅ |
| View audit log | — | — | — | ✅ | ✅ |

🔐 = allowed **but requires step-up re-auth** (Phase 1) + always audited.

> **Owner** is the single accountable principal: cannot be deleted by an Admin, owns ownership-transfer. There is always exactly one Owner (the bootstrap admin is the first Owner).

---

## 4. Data model

New persistent store. The app currently holds **all** state in in-memory singletons (`AUDIT.md` flags this). We introduce a small datastore for the user/session/audit tables.

**v0 recommendation: SQLite** (single file, zero infra, self-contained — matches "maintained within the system"), accessed through a thin repository layer so the **Phase 1 Postgres externalization absorbs it without an interface change**.

### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid / int PK | |
| `username` | text, unique | login identifier |
| `display_name` | text | optional |
| `password_hash` | text | bcrypt/argon2 — **never** plaintext |
| `role` | enum | `viewer\|responder\|maintainer\|admin\|owner` |
| `must_change_password` | bool | `true` for bootstrap admin + every invited/reset user |
| `is_active` | bool | disable without deleting (instant revoke) |
| `failed_login_count` | int | for lockout |
| `locked_until` | timestamp, null | lockout expiry |
| `created_at` / `updated_at` | timestamp | |
| `last_login_at` | timestamp, null | |

### `sessions`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | the session token (random, signed) |
| `user_id` | fk → users | |
| `created_at` | timestamp | |
| `expires_at` | timestamp | sliding or absolute |
| `revoked` | bool | logout / disable-user kills it |

> **Server-side sessions** (not stateless JWT) are chosen deliberately: an SRE tool must be able to **instantly revoke** a compromised or offboarded user. Sessions in the DB survive restarts (no forced re-login on every deploy).

### `audit_log`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `actor_user_id` | fk, null | null for machine/webhook |
| `action` | text | `login`, `login_failed`, `user_created`, `role_changed`, `password_reset`, `pod_deleted`, `secret_written`, … |
| `target` | text | affected resource |
| `metadata` | json | ip, user-agent, scope |
| `created_at` | timestamp | |

---

## 5. Auth architecture (components)

```
┌─────────────────────────────────────────────────────────┐
│ FastAPI app (bot/main.py)                                 │
│  • CORS allow-list (replaces allow_origins=["*"])         │
│  • Session middleware (cookie ↔ sessions table)           │
│  • CSRF protection on mutating routes                     │
│                                                           │
│  Routers:                                                 │
│   /api/v1/auth/*      → auth_router      (login/logout)   │
│   /api/v1/users/*     → users_router     (admin-only)     │
│   /api/v1/alerts/*    → alert_router     (HMAC webhook)   │
│   /api/v1/*           → dashboard_router (Depends guards)  │
└─────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────┐
│ bot/auth/                                                 │
│   identity.py    → IdentityProvider (ABC)  ◀── SSO slots  │
│                    LocalIdentityProvider       in here    │
│   passwords.py   → hash() / verify()  (bcrypt/argon2)     │
│   sessions.py    → create / validate / revoke             │
│   dependencies.py→ get_current_user(), require_role(),    │
│                     require_privileged()  (step-up)       │
│   ratelimit.py   → login attempt throttling + lockout     │
│   audit.py       → write_audit_event()                    │
│   repository.py  → UserRepo/SessionRepo/AuditRepo (SQLite)│
│   bootstrap.py   → first-run admin provisioning           │
└─────────────────────────────────────────────────────────┘
```

**Role enforcement** is a FastAPI dependency factory. Because the entire dashboard surface is one `APIRouter` (`dashboard_router.py:28`), guards attach per-route with one line:

```python
# illustrative — not final code
@router.delete("/pods/{pod}", dependencies=[Depends(require_privileged())])
async def remove_pod(...): ...

@router.post("/rules", dependencies=[Depends(require_role(Role.MAINTAINER))])
async def add_filter(...): ...
```

---

## 6. API surface (new endpoints)

### Auth
| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | none | username+password → sets session cookie; returns `must_change_password` flag |
| `POST` | `/api/v1/auth/logout` | session | revoke current session |
| `POST` | `/api/v1/auth/change-password` | session | set new password (clears `must_change_password`) |
| `GET`  | `/api/v1/auth/me` | session | current user + role + flags (frontend uses for UI gating) |

### User management (Admin/Owner only)
| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/api/v1/users` | list users (no hashes) |
| `POST` | `/api/v1/users` | create user (`username`+`role`) → returns one-time temp password |
| `PATCH`| `/api/v1/users/{id}` | change role / activate / deactivate |
| `POST` | `/api/v1/users/{id}/reset-password` | issue new temp password |
| `DELETE`| `/api/v1/users/{id}` | delete (Owner-protected) |

### Webhook (machine)
- `POST /api/v1/alerts/webhook` (`alert_handler.py:132`) gains **HMAC signature verification** via a shared secret header (e.g. `X-Signature`). Configurable + toggleable so Alertmanager can be reconfigured before enforcement is switched on — **ingestion is never broken on deploy**.

---

## 7. First-run / bootstrap flow

```
$ ./start.sh   (first time, no users table populated)
   │
   ├─ bootstrap.py detects empty users table
   ├─ generates random strong admin password
   └─ prints once to console:
        ┌──────────────────────────────────────────────┐
        │  SRE Copilot — initial admin credentials      │
        │  username: admin                              │
        │  password: 9fK2-xQ7w-... (shown ONCE)         │
        │  You must change this on first login.         │
        └──────────────────────────────────────────────┘

Admin opens UI → login → must_change_password=true → forced change screen
   → sets real password → lands on dashboard (role: owner)

Admin → Settings → Users → "Add user" (username + role)
   → system returns temp password (shown once) → admin shares out-of-band

New user → login with temp password → forced change screen → sets own password
```

---

## 8. Frontend changes

Grounded in `frontend/src/utils/api.js` (hardcoded base URL, `fetch` with no credentials) and the hash-router SPA (`main.js`).

- **Login view + forced-change view** (new screens before the router renders any protected view).
- **Route guard:** on load, call `GET /auth/me`; if unauthenticated → login; if `must_change_password` → forced-change; else render app with the user's role in `state`.
- **Send credentials:** every `fetch` uses `credentials: 'include'` and sends the CSRF token on mutating requests; add a shared fetch wrapper with `res.ok` checks (also fixes the audit's silent-failure gap).
- **Role-gated UI:** hide/disable destructive controls (pod delete, settings/secrets, rule editing) based on role from `/auth/me`. UI gating is convenience; the **server is the source of truth**.
- **Env-driven base URL:** replace hardcoded `http://localhost:8000` (`api.js:6-7`) with `import.meta.env.VITE_*`; derive WS scheme from page protocol (also closes audit P1 #13).

---

## 9. Phased rollout

### Phase 0 — Close the gate (the deliverable for this branch)
**Maps to AUDIT P0 #1, #2, #3, #5.**
- SQLite store + `users`/`sessions`/`audit_log` tables + repository layer.
- `IdentityProvider` interface + `LocalIdentityProvider` (bcrypt hashing).
- Bootstrap admin (generated password, forced change).
- Login / logout / change-password / me endpoints + session cookie middleware.
- Admin user-management endpoints (create/list/reset/role/deactivate).
- The **5-role ladder** with `require_role()` guards on every dashboard route.
- CORS allow-list + CSRF on mutating routes.
- Login rate-limit + lockout.
- HMAC on the webhook (toggleable).
- Audit log on auth + destructive events.
- Frontend login/forced-change/route-guard + role-gated UI + env URLs.
- **Tests** (see §10).

### Phase 1 — Hardening & granularity
- **Step-up re-auth** (MFA/WebAuthn or password re-prompt) on 🔐 capabilities.
- **API tokens / service accounts** (scoped, expiring) for CI/automation.
- WebSocket auth on handshake (`dashboard_router.py:32` `/ws/alerts` is currently open).
- Per-route **scopes** (finer than role) where needed.
- Migrate the auth store onto the **Phase 1 Postgres** externalization (same repository interface).

### Phase 2 — Enterprise / SaaS
- OIDC + SAML behind the existing `IdentityProvider` interface.
- SCIM provisioning, teams/multi-tenancy, custom roles.
- 4-eyes approval workflows, audit-log export. (Enterprise tier gating + SOC 2 enablers.)

---

## 10. Testing plan

Addresses the audit's "essentially zero tests" gap for the exact code that now guards secrets and pod-delete.

- `pytest` + FastAPI `TestClient` (no live server — replaces the assertion-free `tests/test_webhooks.py`).
- **Auth:** login success/failure, forced password change blocks access until done, logout revokes session, deactivated user is denied instantly.
- **RBAC:** each role can reach exactly its allowed routes and is `403` on the rest (table-driven against §3).
- **Lockout:** N failed logins → locked.
- **CORS:** disallowed origin rejected; allowed origin + credentials works.
- **Webhook HMAC:** valid signature accepted, tampered/absent rejected (when enforcement on).
- **Bootstrap:** empty DB provisions exactly one Owner with `must_change_password=true`.

---

## 11. Out of scope for v0

External IdP/SSO, SAML, SCIM, multi-tenancy, custom roles, email-based password reset, billing. All are Phase 2 and intentionally deferred — the `IdentityProvider` interface keeps them cheap to add.

---

## 12. Open decisions (confirm before implementation)

1. **Datastore for v0:** SQLite (recommended — self-contained, zero infra) vs. stand up Postgres now and fold the P1 work forward.
2. **Webhook HMAC enforcement:** ship **off by default** (log-only) so Alertmanager can be reconfigured first, then flip on — vs. on from day one.
3. **Session lifetime:** sliding expiry (e.g. 8h idle) vs. fixed absolute (e.g. 12h) — affects how often operators re-login.
4. **Bootstrap username:** fixed `admin`, or configurable via env at first run.

---

*Plan only — no implementation code is written until this document is approved.*
