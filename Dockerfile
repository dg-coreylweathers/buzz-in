FROM node:22-slim

WORKDIR /app

# Install dependencies first so the layer caches independently of source.
# `ws` is a real runtime dependency: it serves both WebSocket paths and opens
# the speech and listening sessions.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY public ./public
COPY scripts ./scripts
COPY test ./test
COPY server.js ./

# Staging only. src/config.js throws if anything points this at production
# without an explicit override, which is deliberately not set here.
ENV NODE_ENV=production BUZZ_IN_ENV=staging PORT=8080

EXPOSE 8080
CMD ["node", "server.js"]
