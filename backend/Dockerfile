FROM node:20-slim
WORKDIR /app

# Prisma's query/schema engine binaries are dynamically linked against
# OpenSSL, which node:20-slim (Debian) doesn't include by default — without
# this, Prisma silently falls back to a guessed OpenSSL version and the
# engine fails to start.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 4000

# docker-compose overrides this with migrate+seed+start; this default is
# for running the image standalone against an already-migrated database.
CMD ["node", "dist/server.js"]
