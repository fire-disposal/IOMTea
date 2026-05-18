FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm
WORKDIR /app

FROM base AS builder
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared-types/package.json packages/shared-types/tsconfig.json packages/shared-types/
COPY apps/server/package.json apps/server/tsconfig.json apps/server/drizzle.config.ts apps/server/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY tsconfig.base.json ./
COPY packages/shared-types/src packages/shared-types/src/
COPY apps/server/src apps/server/src/
COPY apps/server/drizzle apps/server/drizzle/
RUN pnpm --filter @iomtea/server build

FROM base AS runner
COPY --from=builder /app/node_modules/.pnpm /app/node_modules/.pnpm
COPY --from=builder /app/packages/shared-types/package.json /app/packages/shared-types/
COPY --from=builder /app/packages/shared-types/dist /app/packages/shared-types/dist
COPY --from=builder /app/apps/server/package.json /app/apps/server/
COPY --from=builder /app/apps/server/dist /app/apps/server/dist
COPY --from=builder /app/apps/server/drizzle /app/apps/server/drizzle
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
EXPOSE 5858
CMD ["node", "apps/server/dist/index.js"]
