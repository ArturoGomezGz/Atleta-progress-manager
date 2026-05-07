FROM node:22-alpine
RUN corepack enable pnpm

WORKDIR /app

# Copy manifests for layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/db/package.json ./packages/db/
COPY apps/api/package.json ./apps/api/

# Install all workspace deps
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/db ./packages/db
COPY apps/api ./apps/api

EXPOSE 3001

CMD ["pnpm", "--filter", "api", "start"]
