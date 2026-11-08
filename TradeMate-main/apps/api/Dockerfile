# Build from the repository root:
# docker build -f TradeMate-main/apps/api/Dockerfile -t trademate-api:local .
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY TradeMate-main/apps/api/package*.json ./
RUN npm install --include=dev --no-audit --no-fund
COPY TradeMate-main/apps/api/ ./
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY TradeMate-main/apps/api/package*.json ./
RUN npm install --omit=dev --no-audit --no-fund \
    && npm cache clean --force
COPY --from=build /app/dist ./dist
# The migration runner loads SQL files from this directory at runtime.
COPY TradeMate-main/apps/api/scripts ./scripts
COPY TradeMate-main/apps/api/database ./database
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4000) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "dist/main.js"]
