# EchoGPT Backend

Production-style REST API for the **EchoGPT Chrome extension**: a multi-provider AI chat sidebar with AI-assisted web search.

Built with **NestJS 12**, **PostgreSQL**, **TypeORM** and **Swagger/OpenAPI**, following a modular architecture with security as a first-class concern.

| | |
|---|---|
| **API base URL** | `http://localhost:3000/api/v1` |
| **Swagger docs** | `http://localhost:3000/docs` |
| **OpenAPI JSON** | `http://localhost:3000/docs-json` |
| **Health check** | `http://localhost:3000/api/v1/health` |

---

## Table of contents

1. [Features](#features)
2. [Tech stack](#tech-stack)
3. [Quick start (local)](#quick-start-local)
4. [Quick start (Docker)](#quick-start-docker)
5. [Environment variables](#environment-variables)
6. [Testing](#testing)
7. [API overview](#api-overview)
8. [Architecture](#architecture)
9. [Database design](#database-design)
10. [Security](#security)
11. [Design decisions](#design-decisions)
12. [Future improvements](#future-improvements)

---

## Features

Every required feature from the assignment is implemented, plus **all bonus features** (marked ⭐).

| Area | What is included |
|---|---|
| **Authentication** | Register, login, logout (this device / all devices), JWT access tokens, **refresh token rotation with reuse detection**, bcrypt password hashing, ⭐ **email verification** (SMTP or console mode) |
| **User management** | Profile, update profile, change password (logs out all devices), delete account (password confirmation), roles (ADMIN / USER) |
| **Subscriptions** | FREE and PREMIUM plans, subscription status, upgrade / downgrade with full history, daily usage limits, remaining-requests API, automatic expiry of paid periods |
| **AI providers** | OpenAI, Claude (Anthropic) and Google Gemini through one adapter interface. Add / edit / delete / enable / disable, **AES-256-GCM encrypted API keys**, default provider, per-provider models, premium-only models, health checks, **mock mode** (works without API keys) |
| **Chat** | Send prompt, AI response, provider and model selection, conversation history with context, rename / delete chats, ⭐ **streaming responses (Server-Sent Events)** with cancellation |
| **Web search** | AI-assisted search (results + AI summary with citations), search history, recent searches, suggestions, ⭐ **shared result cache** with TTL and hit counting |
| **Admin panel** | Dashboard statistics, user management (search, suspend, roles, delete), subscription and plan management (limits are data, no redeploy), AI provider management, usage analytics (per day / provider / endpoint), request logs with filters, system health |
| **Quality** | Swagger for every endpoint (params, bodies, response examples, error responses, auth), e2e tests, a Postman collection with 93 automated assertions, Docker setup |

---

## Tech stack

| Concern | Choice |
|---|---|
| Framework | NestJS 12 (TypeScript) |
| Database | PostgreSQL (tested on 18) |
| ORM / migrations | TypeORM 0.3 with a snake_case naming strategy |
| Auth | Passport JWT, bcryptjs |
| Validation | class-validator, class-transformer |
| Docs | @nestjs/swagger (OpenAPI 3) |
| Security | helmet, @nestjs/throttler, Node `crypto` (AES-256-GCM, SHA-256) |
| Email | Nodemailer |
| Tests | Jest + Supertest (e2e), Newman (Postman collection) |
| Containers | Docker (multi-stage), Docker Compose |

---

## Quick start (local)

### Prerequisites

- **Node.js 24+** (Node 22.12+ also works)
- **PostgreSQL 14+** running locally

### 1. Install

```bash
git clone https://github.com/rafitrahad/echogpt-backend.git
cd echogpt-backend
npm install
```

### 2. Configure

Copy the example environment file:

```bash
# macOS / Linux
cp .env.example .env

# Windows (Command Prompt)
copy .env.example .env
```

Then edit `.env`:

1. Set `DATABASE_URL` to your PostgreSQL connection.
2. Generate the secrets (each command prints one value):

```bash
# JWT_ACCESS_SECRET and JWT_REFRESH_SECRET (run twice, use different values)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# ENCRYPTION_KEY (exactly 64 hex characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> The app **refuses to start** if any setting is missing or invalid (for example a secret shorter than 32 characters), and prints exactly what is wrong.

### 3. Create the database, migrate and seed

Create an empty database named `echogpt` (for example in pgAdmin, or `psql -U postgres -c "CREATE DATABASE echogpt;"`), then:

```bash
npm run migration:run   # creates all 14 tables, constraints and indexes
npm run seed            # roles, FREE/PREMIUM plans, first admin (from ADMIN_EMAIL / ADMIN_PASSWORD)
```

The seed is **idempotent**: running it again never creates duplicates.

### 4. Run

```bash
npm run start:dev
```

Open **http://localhost:3000/docs**, log in with `POST /auth/login` using the admin credentials from `.env`, click **Authorize** and paste the `accessToken`.

### 5. Add an AI provider

With `AI_MOCK_MODE=true` (the default in `.env.example`) any API key works and answers are simulated, so everything can be tested for free. As admin:

```json
POST /api/v1/admin/providers
{
  "name": "OpenAI",
  "type": "OPENAI",
  "apiKey": "sk-your-key",
  "models": [
    { "modelKey": "gpt-4o-mini", "displayName": "GPT-4o mini" },
    { "modelKey": "gpt-4o", "displayName": "GPT-4o", "premiumOnly": true }
  ]
}
```

For real answers, set `AI_MOCK_MODE=false`, restart, and add real keys (types: `OPENAI`, `ANTHROPIC`, `GEMINI`). Check each provider's documentation for current model names.

---

## Quick start (Docker)

Requires Docker Desktop. The compose file starts PostgreSQL and the API, then **automatically runs migrations and the seed** on every start.

```bash
cp .env.example .env      # then generate the secrets as described above
docker compose up --build
```

- API and Swagger: http://localhost:3000/docs
- PostgreSQL is exposed on port **5433** (to avoid clashing with a local PostgreSQL on 5432)
- Stop: `docker compose down` (add `-v` to delete the database volume)

The image is a **multi-stage build** (build tools are not shipped), runs as the non-root `node` user and has a Docker `HEALTHCHECK` on `/api/v1/health`.

---

## Environment variables

All variables are validated at startup (`src/config/env.validation.ts`).

| Variable | Required | Example | Purpose |
|---|---|---|---|
| `NODE_ENV` | yes | `development` | `development`, `production` or `test` |
| `PORT` | yes | `3000` | HTTP port |
| `APP_URL` | yes | `http://localhost:3000` | Public URL, used in email links |
| `APP_TIMEZONE` | yes | `Asia/Dhaka` | Daily limits reset at midnight in this zone |
| `CORS_ORIGIN` | yes | `*` | Allowed origins, comma-separated. Use `chrome-extension://<id>` in production |
| `DATABASE_URL` | yes | `postgresql://postgres:password@localhost:5432/echogpt` | PostgreSQL connection |
| `DB_LOGGING` | no | `false` | Print SQL queries |
| `JWT_ACCESS_SECRET` | yes | 128 hex chars | Signs access tokens (min 32 chars) |
| `JWT_ACCESS_EXPIRES_IN` | yes | `15m` | Access token lifetime |
| `JWT_REFRESH_SECRET` | yes | 128 hex chars | Signs refresh tokens (must differ from the access secret) |
| `JWT_REFRESH_EXPIRES_IN` | yes | `7d` | Refresh token lifetime |
| `ENCRYPTION_KEY` | yes | 64 hex chars | AES-256-GCM key for provider API keys |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | for seed | `admin@echogpt.local` | First admin account |
| `THROTTLE_TTL_SECONDS` / `THROTTLE_LIMIT` | yes | `60` / `100` | Global rate limit per client |
| `SEARCH_CACHE_TTL_SECONDS` | yes | `3600` | How long cached search results stay fresh |
| `AI_MOCK_MODE` | no | `true` | Simulated AI answers, no API keys needed |
| `SEARCH_PROVIDER` | no | `wikipedia` | `wikipedia` (free, no key), `tavily` or `mock` |
| `TAVILY_API_KEY` | if tavily | | Tavily search API key |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | no | | Real email. Without `SMTP_HOST`, emails are printed to the console |

---

## Testing

### End-to-end tests (Jest + Supertest)

Starts the real application against the database configured in `.env`:

```bash
npm run test:e2e
```

Checks that the health endpoint is public, protected routes reject requests without a token, and public data is reachable.

> NestJS 12 packages are ES modules, so Jest runs with `--experimental-vm-modules` (already set in the script). The `ExperimentalWarning` it prints is expected.

### Full API test (Postman / Newman)

`postman/EchoGPT.postman_collection.json` walks through **every feature in order** (69 requests, 93 assertions), including security checks: mass assignment, refresh token reuse, IDOR, role checks, premium-only models, masked API keys, cache hits and account suspension. Tokens are saved automatically between requests, and every run uses a fresh user, then cleans up.

```bash
npm run start:dev    # terminal 1 (with AI_MOCK_MODE=true)
npm run test:api     # terminal 2
```

Or import the collection into Postman and use **Run collection**. Login and register are rate-limited to 5 per minute, so wait a minute between two full runs.

### Streaming

Swagger UI cannot display a live stream; use curl:

```bash
curl -N -X POST http://localhost:3000/api/v1/chat/messages/stream \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Tell me about Dhaka"}'
```

Events: `meta` (provider and model), many `token` events (append them), then `done` (the saved chat, same shape as `POST /chat/messages`) or `error`.

---

## API overview

All routes are prefixed with `/api/v1`. 🔓 = public, 🔑 = logged-in user, 👑 = admin only. Full details, request bodies, response examples and error responses are in Swagger.

<details>
<summary><b>Auth</b></summary>

| Method | Path | | Description |
|---|---|---|---|
| POST | `/auth/register` | 🔓 | Create account (FREE plan), returns tokens |
| POST | `/auth/login` | 🔓 | Log in |
| POST | `/auth/refresh` | 🔓 | New token pair (rotation) |
| POST | `/auth/logout` | 🔓 | Revoke this device's refresh token |
| POST | `/auth/logout-all` | 🔑 | Revoke all sessions |
| GET | `/auth/verify-email?token=` | 🔓 | Verify email from the link |
| POST | `/auth/verify-email` | 🔓 | Verify email with the token (for apps) |
| POST | `/auth/resend-verification` | 🔑 | Send a new verification email |

</details>

<details>
<summary><b>Users, subscriptions, usage</b></summary>

| Method | Path | | Description |
|---|---|---|---|
| GET | `/users/me` | 🔑 | My profile |
| PATCH | `/users/me` | 🔑 | Update name / avatar |
| PATCH | `/users/me/password` | 🔑 | Change password |
| DELETE | `/users/me` | 🔑 | Delete account (password required) |
| GET | `/subscriptions/plans` | 🔓 | Available plans |
| GET | `/subscriptions/me` | 🔑 | My subscription status |
| POST | `/subscriptions/me/change` | 🔑 | Upgrade / downgrade (payment simulated) |
| GET | `/usage/me` | 🔑 | Usage today and remaining requests |

</details>

<details>
<summary><b>Chat, web search, providers</b></summary>

| Method | Path | | Description |
|---|---|---|---|
| POST | `/chat/messages` | 🔑 | Send prompt, get AI response |
| POST | `/chat/messages/stream` | 🔑 | Same, streamed as Server-Sent Events |
| GET | `/chat/conversations` | 🔑 | My chats (paginated) |
| GET | `/chat/conversations/:id` | 🔑 | One chat with messages |
| PATCH | `/chat/conversations/:id` | 🔑 | Rename |
| DELETE | `/chat/conversations/:id` | 🔑 | Delete |
| POST | `/search` | 🔑 | AI-assisted web search |
| GET | `/search/history` | 🔑 | Search history (paginated) |
| GET | `/search/history/:id` | 🔑 | One past search |
| DELETE | `/search/history/:id` | 🔑 | Delete one search |
| DELETE | `/search/history` | 🔑 | Clear history |
| GET | `/search/recent` | 🔑 | Recent distinct searches |
| GET | `/search/suggestions?q=` | 🔑 | Suggestions from my own history |
| GET | `/providers` | 🔑 | Enabled providers and models (no secrets) |

</details>

<details>
<summary><b>Admin</b></summary>

| Method | Path | | Description |
|---|---|---|---|
| GET | `/admin/dashboard` | 👑 | Dashboard statistics |
| GET | `/admin/analytics/usage?days=` | 👑 | Usage per day, provider and endpoint |
| GET | `/admin/logs` | 👑 | Request logs with filters |
| GET | `/admin/system/health` | 👑 | Database, providers, memory, recent errors |
| GET | `/admin/users` | 👑 | Search and filter users |
| GET | `/admin/users/:id` | 👑 | User detail, usage and activity |
| PATCH | `/admin/users/:id/status` | 👑 | Suspend / re-activate |
| PATCH | `/admin/users/:id/role` | 👑 | Change role |
| DELETE | `/admin/users/:id` | 👑 | Delete user |
| POST | `/admin/users/:id/subscription` | 👑 | Put a user on a plan |
| GET | `/admin/subscriptions` | 👑 | All subscriptions |
| GET | `/admin/plans` | 👑 | Plans with subscriber counts |
| PATCH | `/admin/plans/:code` | 👑 | Change price, limits, availability |
| GET / POST | `/admin/providers` | 👑 | List / add providers |
| GET / PATCH / DELETE | `/admin/providers/:id` | 👑 | Read / edit (rotate key) / delete |
| PATCH | `/admin/providers/:id/status` | 👑 | Enable / disable |
| POST | `/admin/providers/:id/default` | 👑 | Set default provider |
| POST | `/admin/providers/:id/health-check` | 👑 | Test the provider |
| POST | `/admin/providers/:id/models` | 👑 | Add a model |
| PATCH / DELETE | `/admin/providers/:id/models/:modelId` | 👑 | Edit / delete a model |
| GET | `/health` | 🔓 | Public liveness check |

</details>

![Admin and health endpoints in Swagger](docs/images/swagger-admin-endpoints.png)

### Error format

Every error, from anywhere in the API, has the same shape and never contains stack traces or SQL:

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Conversation not found",
  "path": "/api/v1/chat/conversations/abc",
  "timestamp": "2026-09-27T10:00:00.000Z"
}
```

---

## Architecture

### Project structure

```
src/
├── main.ts                    # bootstrap: prefix, helmet, CORS, validation, Swagger
├── app.module.ts              # wires modules, global guards, logging middleware
├── config/env.validation.ts   # startup validation of every setting
├── database/
│   ├── data-source.ts         # one DB config for the app AND the migration CLI
│   ├── migrations/            # versioned schema changes
│   └── seeds/seed.ts          # idempotent starting data
├── common/                    # cross-cutting building blocks
│   ├── decorators/            # @Public, @Roles, @CurrentUser
│   ├── guards/                # JwtAuthGuard, RolesGuard (global)
│   ├── filters/               # one consistent, safe error format
│   ├── middleware/            # request logging (api_usage_logs)
│   ├── validators/            # reusable @IsSecurePassword
│   └── utils/                 # AES-256-GCM encryption, hashing
└── modules/                   # one folder per feature
    ├── auth/  users/  subscriptions/  usage/
    ├── providers/             # adapters/: OpenAI, Anthropic, Gemini, Mock
    ├── chat/  search/         # search engines/: Wikipedia, Tavily, Mock
    ├── admin/  health/  mail/
```

Each feature module has its own **controller** (HTTP only), **service** (business logic), **DTOs** (validation + Swagger) and **entities**. Controllers never touch the database directly.

### Request pipeline

```mermaid
flowchart LR
    A[Request] --> B[Logging middleware]
    B --> C[helmet / CORS]
    C --> D[ThrottlerGuard<br/>rate limit]
    D --> E[JwtAuthGuard<br/>who are you?]
    E --> F[RolesGuard<br/>are you allowed?]
    F --> G[ValidationPipe<br/>DTO checks]
    G --> H[Controller]
    H --> I[Service]
    I --> J[(PostgreSQL)]
    I --> K[AI / search adapters]
    H --> L[Response]
    H -. error .-> M[Exception filter<br/>safe JSON error]
```

The guards are registered globally, so **every route is protected by default**. Public routes opt out explicitly with `@Public()`.

### Adapter pattern for AI providers

```mermaid
flowchart LR
    Chat[ChatService] --> F[AiAdapterFactory]
    F --> O[OpenAiAdapter]
    F --> An[AnthropicAdapter]
    F --> G[GeminiAdapter]
    F --> M[MockAdapter]
```

Every adapter implements the same `AiAdapter` interface (`chat()` and `stream()`), translating one common request format into each provider's API. The chat service never knows which provider it is talking to. **Adding a provider means one new adapter class and one line in the factory.** Web search uses the same pattern (`SearchEngine`).

---

## Database design

14 normalized tables, created by a versioned migration. Relations use deliberate delete rules: `CASCADE` (a user's data leaves with the user), `SET NULL` (history survives when a provider is deleted) and `RESTRICT` (roles and plans in use cannot be deleted).

```mermaid
erDiagram
    roles ||--o{ users : "has"
    users ||--o{ sessions : "logs in on"
    users ||--o{ email_verification_tokens : "verifies with"
    users ||--o{ subscriptions : "subscribes"
    plans ||--o{ subscriptions : "defines"
    users ||--o{ daily_usage : "counts"
    users ||--o{ conversations : "owns"
    conversations ||--o{ messages : "contains"
    ai_providers ||--o{ ai_models : "offers"
    ai_providers |o--o{ conversations : "answers"
    ai_models |o--o{ conversations : "used by"
    ai_providers |o--o{ messages : "wrote"
    users ||--o{ web_searches : "searches"
    ai_providers |o--o{ web_searches : "summarizes"
    users |o--o{ api_usage_logs : "makes"
    ai_providers |o--o{ api_usage_logs : "serves"
```

`search_cache` stands alone on purpose: it stores **what** was searched, never **who** searched it.

| Table | Purpose | Notable design |
|---|---|---|
| `roles` | ADMIN, USER | lookup table, `RESTRICT` on delete |
| `users` | accounts | `password_hash` excluded from all queries by default |
| `sessions` | one row per logged-in device | stores only the SHA-256 of the refresh token; revoked, not deleted |
| `email_verification_tokens` | email verification | hashed, one-time, 24 h expiry |
| `plans` | FREE / PREMIUM | limits and prices are **data** (`null` = unlimited), money in cents |
| `subscriptions` | plan history per user | **partial unique index**: at most one ACTIVE subscription per user |
| `daily_usage` | per user / day / type counter | unique (user, date, type); race-safe atomic upsert |
| `ai_providers` | OpenAI / Claude / Gemini | AES-256-GCM encrypted key; partial unique index (one default); CHECK (default must be enabled) |
| `ai_models` | models per provider | one default per provider; premium-only flag |
| `conversations`, `messages` | chat history | token counts and latency per answer; model name snapshot |
| `web_searches` | personal search history | results as `jsonb` |
| `search_cache` | shared cache | keyed by SHA-256 of the normalized query, TTL |
| `api_usage_logs` | every request | `bigint` id, append-only, indexed for analytics |

---

## Security

| Threat | Protection |
|---|---|
| Stolen database | Passwords: bcrypt (cost 12). Refresh / verification tokens: SHA-256 hashes only. Provider API keys: AES-256-GCM with a key that lives only in `.env` |
| Brute-force login | 5 attempts / minute on login and register; 100 requests / minute globally |
| User enumeration | Same message for "no such user" and "wrong password", and **constant response time** (bcrypt runs against a dummy hash for unknown emails) |
| Stolen access token | 15-minute lifetime; user status re-checked on every request (suspension is immediate) |
| Stolen refresh token | Rotation on every refresh; **reuse of an old token revokes all sessions** |
| Mass assignment | `whitelist` + `forbidNonWhitelisted`: unknown fields (e.g. `"role": "ADMIN"`) are rejected |
| IDOR | Every user resource is queried with `WHERE id = :id AND user_id = :currentUser`; others' data returns **404** (existence not revealed) |
| Privilege escalation | Global `RolesGuard`; admins cannot suspend, demote or delete themselves; the last admin cannot be removed |
| SQL injection | Parameterized queries everywhere; `LIKE` wildcards escaped |
| Race conditions | Database constraints back every business rule (unique indexes, partial indexes, CHECK); usage counting is a single atomic statement (25 concurrent requests on a limit of 20 let exactly 20 through) |
| Information leaks | Uniform error format without stack traces or SQL; logs never store bodies, headers, tokens or query strings |
| Prompt injection via search results | Search results are passed to the AI as explicitly untrusted data |
| XSS via third-party content | HTML stripped from search snippets; user names escaped in emails |
| Misconfiguration | The app refuses to start with missing or weak settings; `synchronize` is off (schema changes only through migrations) |
| Headers | `helmet` security headers; CORS restricted by configuration |

---

## Design decisions

- **Refresh tokens are hashed with SHA-256, passwords with bcrypt.** bcrypt is deliberately slow to protect guessable passwords, but only reads the first 72 bytes: two different JWTs share their first 72 bytes (the header), so bcrypt would treat them as equal. Random tokens need a fast, full-length hash.
- **UUID primary keys** for user-facing data (not guessable, no business information leaked); `bigint` for the high-volume log table.
- **Usage is refunded when the AI or search provider fails**, and chats are saved only after a complete answer, so users never pay for errors and history never contains half-answers.
- **Lazy subscription expiry.** Paid periods are checked when read, so no background job is needed.
- **Request logging is a middleware, not an interceptor.** Guards run before interceptors, so an interceptor would miss exactly the rejected requests (401 / 403 / 429) that matter most for security.
- **Graceful degradation.** If the AI summary fails, search still returns results; if email sending fails, registration still succeeds.
- **Mock modes** for AI, search and email let the whole system be run and reviewed without any paid API key.

---

## Future improvements

- Move the search cache and rate-limit counters to **Redis** for multi-instance deployments.
- **Retention policy / table partitioning** for `api_usage_logs`.
- Global search suggestions with PostgreSQL `pg_trgm` (currently personal only, for privacy).
- Real payments (e.g. Stripe or SSLCommerz) with webhooks; currently simulated.
- Password reset by email, reusing the verification token design.
- Deliver refresh tokens in `HttpOnly` cookies for browser clients.
- Unit tests per service and CI (GitHub Actions) running e2e and Postman tests on every push.

---

## Scripts

| Command | Description |
|---|---|
| `npm run start:dev` | Start in watch mode |
| `npm run build` / `npm run start:prod` | Compile / run the compiled app |
| `npm run migration:run` | Apply pending migrations |
| `npm run migration:revert` | Undo the last migration |
| `npm run migration:show` | List migrations and their status |
| `npx typeorm-ts-node-commonjs -d src/database/data-source.ts migration:generate src/database/migrations/<Name>` | Generate a migration from entity changes |
| `npm run seed` | Insert roles, plans and the first admin (idempotent) |
| `npm run test:e2e` | End-to-end tests |
| `npm run test:api` | Full API test with Newman (server must be running) |
