# ───────────── Stage 1: build the TypeScript into JavaScript ─────────────
FROM node:24-alpine AS build
WORKDIR /app

# Install dependencies first (cached unless package files change)
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ───────────── Stage 2: small production image ─────────────
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app

# Production dependencies only: no TypeScript, Jest, etc.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# Never run as root inside the container
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1/health || exit 1

# On every start: apply new migrations -> seed (idempotent) -> start the API
CMD ["sh", "-c", "node node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js && node dist/database/seeds/seed.js && node dist/main.js"]