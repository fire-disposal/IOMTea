FROM node:24-alpine AS base
RUN npm install -g pnpm@9.15.9
WORKDIR /app

FROM base AS builder
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc package.json turbo.json tsconfig.base.json ./
COPY packages/shared-types/package.json packages/shared-types/tsconfig.json packages/shared-types/
COPY apps/server/package.json apps/server/tsconfig.json apps/server/drizzle.config.ts apps/server/

RUN pnpm install --no-frozen-lockfile

COPY packages/shared-types/src packages/shared-types/src/
COPY apps/server/src apps/server/src/
COPY apps/server/drizzle apps/server/drizzle/

RUN npx turbo build --filter=@iomtea/server

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
CMD ["node", "apps/server/dist/src/index.js"]
