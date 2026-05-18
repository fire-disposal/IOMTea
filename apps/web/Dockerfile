FROM node:22-alpine AS builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared-types/package.json packages/shared-types/tsconfig.json packages/shared-types/
COPY apps/web/package.json apps/web/tsconfig.json apps/web/vite.config.ts apps/web/postcss.config.cjs apps/web/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY tsconfig.base.json ./
COPY packages/shared-types/src packages/shared-types/src/
COPY apps/web/index.html apps/web/
COPY apps/web/src apps/web/src/
COPY apps/server/src/core/trpc/routers/_app.ts apps/server/src/core/trpc/routers/_app.ts
RUN pnpm --filter @iomtea/web build

FROM nginx:alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
