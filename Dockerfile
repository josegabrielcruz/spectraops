# ── Stage 1: Build ────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

# Copy workspace root config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy only the core-engine package (the only one we need at runtime)
COPY packages/core-engine/ packages/core-engine/

RUN pnpm install --frozen-lockfile --filter core-engine...
RUN pnpm --filter core-engine build

# ── Stage 2: Production ──────────────────────
FROM node:20-alpine AS production

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/core-engine/package.json packages/core-engine/
COPY --from=builder /app/packages/core-engine/dist/ packages/core-engine/dist/
COPY --from=builder /app/packages/core-engine/migrations/ packages/core-engine/migrations/

RUN pnpm install --frozen-lockfile --filter core-engine --prod

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "packages/core-engine/dist/server.js"]
