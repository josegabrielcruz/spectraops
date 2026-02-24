# SpectraOps

**Catch front-end errors in production before your users report them.**

SpectraOps is an error-tracking platform for web applications. Drop a lightweight SDK into your site, and every JavaScript error — crashes, failed promises, edge-case exceptions — is captured automatically, stored securely, and surfaced in a team dashboard where you can see what broke, when, and why.

<!-- TODO: add a screenshot of the dashboard here -->
<!-- ![Dashboard screenshot](docs/assets/dashboard.png) -->

---

## Who is this for?

- **Front-end & full-stack developers** who want instant visibility into production errors instead of waiting for user bug reports.
- **Engineering leads & managers** who need a clear view of application health and error trends across projects.
- **Small teams & startups** looking for an open-source, self-hosted alternative to services like Sentry or Bugsnag.

No deep infrastructure knowledge is required to get started — if you can run `npm install` and open a browser, you can have SpectraOps running in minutes.

---

## How it works

```
Your web app  ──SDK──▶  SpectraOps API  ──▶  PostgreSQL
                                │
                         Dashboard  ◀── your team views errors here
```

1. **Install the SDK** in your web app (one line of code).
2. **Errors are captured automatically** — uncaught exceptions, promise rejections, and anything you flag manually.
3. The SDK **batches and sends errors** to the SpectraOps API in the background.
4. The API **validates, sanitises, and stores** everything in PostgreSQL.
5. Your team opens the **Dashboard** to view errors with stack traces, severity levels, and timestamps.

---

## What you get today (v1)

### For developers

- **Automatic error capture** — browser exceptions, unhandled promise rejections, and manual `captureError()` calls
- **Zero-dependency SDK** — `@spectraops/error-tracking` weighs almost nothing; supports batching, auto-flush on page unload, and full cleanup via `destroy()`
- **Batch ingestion** — the SDK sends errors in a single request, not one-by-one
- **Manual capture** — wrap any try/catch with `captureError(err)` for errors you want to track explicitly

### For your team

- **Dashboard** — see every error at a glance with severity badges, expandable stack traces, and pagination
- **Project management** — create multiple projects, each with its own API key; errors are scoped per project
- **User accounts** — register, log in, log out; each user sees only their own projects
- **Session-aware auth** — the dashboard automatically redirects to login when your session expires

### Security & reliability

- **Dual authentication** — the SDK authenticates with an API key; the dashboard uses session tokens — each channel is isolated
- **Password policy** — minimum 8 characters, must include uppercase, lowercase, and a digit
- **Security headers** — helmet middleware sets CSP, HSTS, X-Frame-Options, and more out of the box
- **XSS protection** — all user-supplied text is stripped of HTML tags on the server before storage
- **Rate limiting** — per-IP request limits with standard `X-RateLimit-*` response headers
- **Payload limits** — 256 KB max request size to prevent memory abuse
- **Request tracing** — every response includes an `X-Request-Id` header for end-to-end debugging

### Infrastructure & operations

- **Structured logging** — JSON logs via Pino, correlated by request ID
- **Graceful shutdown** — drains HTTP connections and closes the database pool on `SIGTERM`/`SIGINT`
- **Data retention** — automatic hourly cleanup of errors older than 90 days (configurable)
- **Database resilience** — connection pooling with error recovery and configurable timeouts
- **Request timeout** — 30-second server timeout prevents slow clients from holding resources
- **Migrations** — database schema managed with `node-pg-migrate`
- **Docker** — multi-stage Dockerfile + docker-compose (PostgreSQL + API) with health checks
- **CI** — GitHub Actions pipeline: lint, test, build — on Node 18 and 20

---

## Quick Start

### Prerequisites

- **Node.js** 18 or later — [download](https://nodejs.org)
- **pnpm** 10 or later — `corepack enable && corepack prepare pnpm@10 --activate`
- **PostgreSQL** 14 or later — [download](https://www.postgresql.org/download/) or use the Docker option below

### 1. Clone and install

```bash
git clone https://github.com/spectraops/spectraops.git
cd spectraops
pnpm install
```

### 2. Start with Docker (easiest)

```bash
pnpm docker:up
```

This starts PostgreSQL and the API together. The database schema is created automatically on first run.

> **What to expect:** after a few seconds you should see log output confirming the server is listening on port 3000.

### 3. Or start locally

```bash
createdb spectraops          # create the database
pnpm migrate:up              # apply the schema
pnpm dev                     # start API + dashboard
```

> **What to expect:**
>
> - API running at **http://localhost:3000** — verify with `curl http://localhost:3000/health` (you should see `{"status":"ok"}`)
> - Dashboard running at **http://localhost:5173** — open in your browser

### 4. Create a user and project

1. Open the dashboard at **http://localhost:5173** and register an account.
2. Go to the **Projects & API Keys** tab, create a project, and copy the API key.

### 5. Send a test error

```bash
curl -X POST http://localhost:3000/api/errors \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"message": "Test error from README", "stack": "Error: Test\\n    at main (index.js:1:1)"}'
```

Refresh the dashboard — you should see the error appear with a severity badge and timestamp.

### 6. Integrate the SDK in your app

```bash
npm install @spectraops/error-tracking
```

```ts
import { init, captureError } from '@spectraops/error-tracking';

init({
  endpoint: 'http://localhost:3000',
  apiKey: 'YOUR_API_KEY',
});

// Errors are now captured automatically.
// You can also capture manually:
try {
  riskyOperation();
} catch (err) {
  captureError(err as Error);
}
```

See the [SDK README](packages/error-tracking/README.md) for the full API reference.

---

## Architecture

```
spectraops/
├── packages/
│   ├── core-engine/       # Express API — ingests errors, auth, project management
│   └── error-tracking/    # Client SDK (@spectraops/error-tracking)
├── dashboard/             # React + Vite + Tailwind dashboard
├── cli/                   # CLI tool (coming soon)
└── docs/                  # Deployment guide, error-tracking reference
```

## Tech Stack

| Layer           | Technology                             |
| --------------- | -------------------------------------- |
| API server      | Node.js, Express 4, Zod, Pino          |
| Database        | PostgreSQL 14+                         |
| Auth            | bcryptjs, DB-backed sessions           |
| Dashboard       | React 18, Vite 6, Tailwind CSS 3       |
| Client SDK      | Vanilla TypeScript (zero dependencies) |
| Testing         | Vitest, Supertest                      |
| Package manager | pnpm 10 (workspaces)                   |
| CI/CD           | GitHub Actions                         |
| Deployment      | Docker, docker-compose                 |

---

## Common Commands

| Command              | What it does                              |
| -------------------- | ----------------------------------------- |
| `pnpm dev`           | Start API + dashboard concurrently        |
| `pnpm dev:api`       | Start the Core Engine API (hot-reload)    |
| `pnpm dev:dashboard` | Start the Dashboard dev server            |
| `pnpm build`         | Build all packages                        |
| `pnpm test`          | Run all test suites                       |
| `pnpm start`         | Start the API in production mode          |
| `pnpm lint`          | Run ESLint across the monorepo            |
| `pnpm format`        | Format code with Prettier                 |
| `pnpm migrate:up`    | Apply pending database migrations         |
| `pnpm migrate:down`  | Roll back the last migration              |
| `pnpm docker:up`     | Start PostgreSQL + API via Docker Compose |
| `pnpm docker:down`   | Stop Docker Compose services              |
| `pnpm docker:build`  | Build the Docker image                    |

---

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the full production deployment guide, including:

- Environment variable reference
- Database setup (Docker or existing PostgreSQL)
- TLS / reverse proxy (nginx) configuration
- SDK publishing to npm
- Monitoring and health checks

---

## Roadmap

- [x] Error tracking — ingestion, storage, dashboard, SDK
- [x] Authentication & project management
- [x] Docker deployment & CI pipeline
- [ ] Dashboard filtering by severity, environment, and date range
- [ ] Error grouping and deduplication (fingerprinting)
- [ ] Alerting — Slack, email, and webhook notifications
- [ ] Node.js SDK variant
- [ ] Source map upload and deobfuscated stack traces

Have an idea? [Open an issue](https://github.com/spectraops/spectraops/issues).

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT — see [LICENSE](LICENSE) for details.
