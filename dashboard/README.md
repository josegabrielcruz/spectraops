# SpectraOps Dashboard

React + Vite + Tailwind CSS web UI for SpectraOps. Provides error management, project/API-key administration, and user authentication.

## Tech Stack

- **React 18** with TypeScript
- **Vite 6** (dev server + production build)
- **Tailwind CSS 3** for styling

## Features

- **Login / Register** — email + password authentication with password policy (8+ chars, uppercase, lowercase, digit)
- **Error list** — paginated, severity-coloured badges, expandable stack traces, environment tags
- **Project management** — create / delete projects, copy / rotate API keys
- **Error boundary** — graceful crash recovery with reload button
- **401 interception** — automatic redirect to login on session expiry

## Getting Started

```bash
pnpm install
pnpm dev:dashboard    # starts at http://localhost:5173
```

In dev mode, the Vite dev proxy forwards `/api` requests to `http://localhost:3000` (the Core Engine API). No `VITE_API_URL` is needed locally.

## Production Build

```bash
VITE_API_URL=https://api.your-domain.com pnpm --filter dashboard build
```

The output goes to `dashboard/dist/` — serve it with any static file server (nginx, Caddy, Cloudflare Pages, etc.).
