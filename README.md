# SpectraOps

**An open-core front-end operations platform for teams that ship web applications.**

SpectraOps gives your front-end teams a single place to track errors, replay user sessions, catch visual regressions, manage feature flags, and automate QA — so bugs get found before your users find them.

---

## Why SpectraOps?

| Problem                                                              | How SpectraOps helps                                                                      |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Errors happen in production and nobody knows until a user complains  | Real-time **error tracking** captures every exception with full stack traces and context  |
| "It works on my machine" — but not in the browser your customer uses | **Session replay** (coming soon) shows exactly what the user saw and did                  |
| A CSS change looks fine locally but breaks another page              | **Visual regression testing** (coming soon) catches pixel-level differences automatically |
| Releasing a risky feature to 100 % of users at once                  | **Feature flags** (coming soon) let you roll out gradually and roll back instantly        |
| Manual QA can't keep up with the pace of releases                    | **QA automation** (coming soon) runs checks on every deploy                               |

## Who is this for?

- **Engineering teams** building and maintaining web applications who want observability without stitching together five different SaaS tools.
- **Engineering managers & leads** who need visibility into front-end health across projects.
- **Non-technical stakeholders** evaluating tooling — SpectraOps is free to self-host, has a clean dashboard, and doesn't require a PhD to set up.

## Open-Core Model

The core platform is **free and open-source** under a permissive license. You can self-host it on your own infrastructure with no limits.

Premium add-ons (hosted cloud, SSO/SAML, advanced analytics, dedicated support) will be available for teams that want a managed experience.

---

## Architecture Overview

SpectraOps is organized as a monorepo with four packages:

```
spectraops/
├── packages/
│   ├── core-engine/       # Express API — ingests errors, stores in Postgres
│   └── error-tracking/    # Lightweight client SDK you add to your app
├── dashboard/             # React + Vite UI for viewing and managing errors
└── cli/                   # CLI tool for project management (coming soon)
```

**How the pieces fit together:**

1. You install the **client SDK** (`@spectraops/error-tracking`) in your web app.
2. When an error occurs, the SDK sends it to the **Core Engine API**.
3. The API validates the payload and stores it in **Postgres**.
4. Your team opens the **Dashboard** to view, search, and triage errors.

## Tech Stack

| Layer           | Technology                             |
| --------------- | -------------------------------------- |
| API server      | Node.js, Express, Zod (validation)     |
| Database        | PostgreSQL                             |
| Dashboard       | React 18, Vite 6, Tailwind CSS         |
| Client SDK      | Vanilla TypeScript (zero dependencies) |
| CLI             | Node.js, Yargs                         |
| Testing         | Vitest                                 |
| Package manager | pnpm (workspaces)                      |

---

## Getting Started

### Prerequisites

- **Node.js** 18 or later — [download](https://nodejs.org)
- **pnpm** 10+ — install with `npm install -g pnpm@latest`
- **PostgreSQL** 14 or later — [download](https://www.postgresql.org/download/) or run via Docker

### 1. Clone & install

```bash
git clone https://github.com/your-org/spectraops.git
cd spectraops
pnpm install
```

### 2. Set up the database

Create a Postgres database and run the schema:

```bash
createdb spectraops
psql spectraops < packages/core-engine/src/data/schema.sql
```

> By default the API connects to `postgres://postgres:postgres@localhost:5432/spectraops`. Set the `DATABASE_URL` environment variable to override this.

### 3. Start the API

```bash
pnpm dev:api
```

The Core Engine API will be running at **http://localhost:3000**. You can verify with:

```bash
curl http://localhost:3000/health
```

### 4. Start the Dashboard

In a separate terminal:

```bash
pnpm dev:dashboard
```

The dashboard will open at **http://localhost:5173**.

### 5. Send a test error

```bash
curl -X POST http://localhost:3000/api/errors \
  -H "Content-Type: application/json" \
  -d '{"message": "Test error from README", "stack": "Error: Test\n    at main (index.js:1:1)"}'
```

Refresh the dashboard — you should see the error appear.

---

## Common Commands

| Command              | What it does                                  |
| -------------------- | --------------------------------------------- |
| `pnpm install`       | Install all dependencies across the monorepo  |
| `pnpm dev:api`       | Start the Core Engine API in development mode |
| `pnpm dev:dashboard` | Start the Dashboard dev server                |
| `pnpm build`         | Build all packages                            |
| `pnpm test`          | Run all test suites                           |

## Using the Client SDK

Add the error-tracking SDK to your front-end application:

```js
import { captureError } from '@spectraops/error-tracking';

try {
  // your application code
} catch (error) {
  captureError(error);
}
```

The SDK will send captured errors to your SpectraOps API instance for storage and display in the dashboard.

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to get involved.

## Roadmap

- [x] Error tracking (ingestion, storage, dashboard)
- [ ] Session replay
- [ ] Visual regression testing
- [ ] Feature flags
- [ ] QA automation
- [ ] Hosted cloud offering

## License

SpectraOps core is open-source. See the [LICENSE](LICENSE) file for details.
