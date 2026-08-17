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
RUN chmod +x docker-entrypoint.sh

EXPOSE 4000

# Runs pending migrations then starts the server. Baked into the image
# (rather than passed as a platform-specific "start command" string) so it
# behaves identically everywhere the image runs — locally, docker-compose,
# or a host like Render/Fly that execs the image directly. docker-compose
# still overrides this with its own migrate+seed+start command for the
# from-scratch demo-data flow; this is what runs everywhere else.
ENTRYPOINT ["./docker-entrypoint.sh"]
