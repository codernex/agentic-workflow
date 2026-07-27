FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
WORKDIR /app

# Copy workspace configuration files and package manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/web/package.json ./apps/web/package.json

# Install dependencies across monorepo workspace
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app

# Copy entire installed node_modules and workspace tree from deps
COPY --from=deps /app ./

# Copy full web application source code
COPY apps/web ./apps/web

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build generated API client and Next.js web application
RUN pnpm --filter @repo/api-client build
RUN pnpm --filter web build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=4000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public ./apps/web/public

# Copy standalone output and static assets
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 4000

CMD ["node", "apps/web/server.js"]
