FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libreoffice-impress \
    libreoffice-writer \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN chown node:node /app
USER node

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci

COPY --chown=node:node . .

ENV NODE_ENV=production \
  PORT=3000 \
  DATABASE_URL=file:/app/data/quotation.db \
  TEMPLATE_DIR=/app/templates \
  STORAGE_DIR=/app/storage

RUN mkdir -p /app/data /app/storage && npm run build

EXPOSE 3000

CMD ["sh", "-c", "./node_modules/.bin/prisma db push --skip-generate && npm run templates:scan && npm start"]
