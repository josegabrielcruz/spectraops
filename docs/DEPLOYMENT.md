# Deployment Guide

This document walks through deploying **SpectraOps** from a fresh checkout to a running production instance.

---

## Prerequisites

| Tool              | Version                                                         |
| ----------------- | --------------------------------------------------------------- |
| Node.js           | 18 or 20                                                        |
| pnpm              | 10.x (`corepack enable && corepack prepare pnpm@10 --activate`) |
| PostgreSQL        | 14+                                                             |
| Docker (optional) | 24+ with Compose v2                                             |

---

## 1. Clone & Install

```bash
git clone https://github.com/your-org/spectraops.git
cd spectraops
pnpm install
```

---

## 2. Environment Variables

Copy the example and fill in production values:

```bash
cp .env.example .env
```

| Variable               | Required | Default                                                  | Description                                             |
| ---------------------- | -------- | -------------------------------------------------------- | ------------------------------------------------------- |
| `DATABASE_URL`         | **Yes**  | `postgres://postgres:postgres@localhost:5432/spectraops` | PostgreSQL connection string                            |
| `PORT`                 | No       | `3000`                                                   | API listening port                                      |
| `NODE_ENV`             | No       | `development`                                            | Set to `production` in prod                             |
| `LOG_LEVEL`            | No       | `info`                                                   | `trace` / `debug` / `info` / `warn` / `error` / `fatal` |
| `CORS_ORIGIN`          | No       | `http://localhost:5173`                                  | Comma-separated allowed origins                         |
| `RATE_LIMIT_WINDOW_MS` | No       | `60000`                                                  | Rate limiter window in ms                               |
| `RATE_LIMIT_MAX`       | No       | `100`                                                    | Max requests per window per IP                          |
| `TRUST_PROXY`          | No       | _(unset)_                                                | Set to `true` behind nginx / cloud LB / Docker          |
| `ERROR_RETENTION_DAYS` | No       | `90`                                                     | Auto-purge errors older than N days (hourly check)      |
| `PG_POOL_MAX`          | No       | `20`                                                     | Max PostgreSQL connection pool size                     |
| `VITE_API_URL`         | No       | _(empty — uses Vite proxy in dev)_                       | Dashboard → API URL (build-time only)                   |

---

## 3. Database Setup

### Option A: Docker Compose (recommended)

```bash
pnpm docker:up          # starts PostgreSQL + API
pnpm docker:down        # stops everything
pnpm docker:down -v     # stops + removes data volume
```

The schema is auto-seeded on first start via `schema.sql`.

### Option B: Existing PostgreSQL

Create the database and run migrations:

```bash
createdb spectraops
pnpm migrate:up
```

Or apply the raw schema:

```bash
psql spectraops < packages/core-engine/src/data/schema.sql
```

---

## 4. Build & Start

```bash
# Build all packages
pnpm build

# Start the API server
pnpm start
```

For development with hot-reload:

```bash
pnpm dev            # starts API + dashboard concurrently
pnpm dev:api        # API only
pnpm dev:dashboard  # dashboard only
```

---

## 5. First-Time Setup

### Create a Dashboard User

Register via the dashboard UI at `http://localhost:5173`, or via the API:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@company.com","password":"your-secure-password"}'
```

### Create a Project & Get an API Key

1. Log into the dashboard.
2. Go to the **Projects & API Keys** tab.
3. Click **Create** to generate a new project with an API key.
4. Copy the API key and pass it to the error-tracking SDK.

Or via API:

```bash
# Login first
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@company.com","password":"your-secure-password"}' \
  | jq -r '.token')

# Create project
curl -X POST http://localhost:3000/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"my-app"}'
```

---

## 6. SDK Integration

Install the SDK in your application:

```bash
npm install @spectraops/error-tracking
```

```ts
import { init } from '@spectraops/error-tracking';

init({
  endpoint: 'https://your-spectraops-api.example.com',
  apiKey: 'your-project-api-key',
});
```

See [`packages/error-tracking/README.md`](packages/error-tracking/README.md) for the full SDK reference.

---

## 7. Docker Production Deployment

The included `Dockerfile` builds a multi-stage production image for the API:

```bash
# Build the image
docker compose build

# Start PostgreSQL + API
docker compose up -d

# View logs
docker compose logs -f api

# Health check
curl http://localhost:3000/health
```

### TLS / Reverse Proxy

The API does not terminate TLS. Place it behind a reverse proxy (nginx, Caddy, cloud load balancer) for HTTPS:

```
Client → nginx (TLS) → localhost:3000 (API)
```

Example nginx config:

```nginx
server {
    listen 443 ssl;
    server_name api.spectraops.example.com;

    ssl_certificate     /etc/ssl/spectraops.crt;
    ssl_certificate_key /etc/ssl/spectraops.key;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 8. Migrations

Migrations are managed by `node-pg-migrate`:

```bash
pnpm migrate:up          # apply pending migrations
pnpm migrate:down        # roll back the last migration
pnpm migrate:create      # scaffold a new migration file
```

Migration files live in `packages/core-engine/migrations/`.

---

## 9. Monitoring

- **Health endpoint**: `GET /health` — returns `200 { status: 'ok', db: 'connected' }` or `503` if the database is unreachable.
- **Structured logs**: JSON logs via `pino` with `X-Request-Id` correlation; pipe to your log aggregator.
- **Request IDs**: Every response includes an `X-Request-Id` header. Pass `X-Request-Id` from your client for end-to-end tracing.
- **Docker healthcheck**: Auto-configured in `docker-compose.yml` and `Dockerfile`.

---

## 10. Publishing the SDK

The `@spectraops/error-tracking` SDK is configured for npm publishing.

### Manual Publish

```bash
cd packages/error-tracking

# Bump version
npm version patch   # or minor / major

# Build and publish
pnpm build
npm publish --access public
```

### CI Publish (recommended)

Add a publish job to `.github/workflows/ci.yml` triggered on version tags:

```yaml
publish:
  if: startsWith(github.ref, 'refs/tags/v')
  needs: [test, build]
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        registry-url: https://registry.npmjs.org
    - run: pnpm install --frozen-lockfile
    - run: pnpm --filter @spectraops/error-tracking build
    - run: pnpm --filter @spectraops/error-tracking publish --no-git-checks --access public
      env:
        NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Tag a release with `git tag v0.2.0 && git push --tags` to trigger the publish.

---

## Known Limitations (MVP)

| Area          | Limitation                         | Upgrade Path                                           |
| ------------- | ---------------------------------- | ------------------------------------------------------ |
| Rate limiting | In-memory, single-process only     | Replace with `rate-limit-redis` + `express-rate-limit` |
| Sessions      | Database-backed but no Redis cache | Add Redis session store for sub-ms lookups             |
| CLI           | Stub only (`hello` command)        | Implement project/error management commands            |
