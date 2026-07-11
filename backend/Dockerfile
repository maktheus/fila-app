FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY server.js ./
RUN mkdir -p /app/data && chown -R node:node /app/data

EXPOSE 3000

USER node

CMD ["node", "server.js"]
