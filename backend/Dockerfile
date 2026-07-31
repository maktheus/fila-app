FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copia a árvore inteira do backend. Listar arquivo por arquivo quebrou o build
# duas vezes, e `COPY *.js` ignorava subdiretórios (chat/) — .dockerignore é
# quem tira node_modules, testes e o resto.
COPY . .
RUN mkdir -p /app/data && chown -R node:node /app/data

EXPOSE 3000

USER node

CMD ["node", "server.js"]
