FROM node:22-slim
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts
COPY server.js ./
ENV NODE_ENV=production BUZZ_IN_ENV=staging PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]
