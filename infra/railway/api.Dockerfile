FROM node:22-bookworm-slim AS base
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci
COPY . .
CMD ["npm", "--workspace", "apps/api", "run", "start"]
