FROM node:24-alpine AS builder
RUN npm install -g pnpm@9.15.9
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc package.json turbo.json tsconfig.base.json ./
COPY packages/shared-types/package.json packages/shared-types/tsconfig.json packages/shared-types/
COPY packages/avatar-core/package.json packages/avatar-core/tsconfig.json packages/avatar-core/
COPY apps/web/package.json apps/web/tsconfig.json apps/web/vite.config.ts apps/web/postcss.config.cjs apps/web/

RUN pnpm install --no-frozen-lockfile

COPY packages/shared-types/src packages/shared-types/src/
COPY packages/avatar-core/src packages/avatar-core/src/
COPY apps/web/index.html apps/web/
COPY apps/web/src apps/web/src/

RUN pnpm --filter @iomtea/shared-types build && pnpm --filter @iomtea/avatar-core build && cd apps/web && pnpm exec vite build

FROM nginx:alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
