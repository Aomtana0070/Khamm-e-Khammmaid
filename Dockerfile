FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma7.config.ts tsconfig.json ./
ENV DATABASE_URL=file:/tmp/prisma-build.db
RUN npx prisma generate

COPY src ./src
COPY assets ./assets
RUN npm run build

ENV NODE_ENV=production
CMD ["sh", "-c", "npm run db:push && npm start"]
