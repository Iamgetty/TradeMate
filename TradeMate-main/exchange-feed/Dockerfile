# Build from the repository root:
# docker build -f TradeMate-main/exchange-feed/Dockerfile -t trademate-exchange-feed:local .
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY TradeMate-main/exchange-feed/package*.json ./
RUN npm install --omit=dev --no-audit --no-fund \
    && npm cache clean --force
COPY TradeMate-main/exchange-feed/ ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "server.js"]
