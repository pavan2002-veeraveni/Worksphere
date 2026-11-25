# ============================================
# Backend Dockerfile - Multi-stage Build
# ============================================

# Stage 1: Base with dependencies
FROM node:20-alpine AS base
WORKDIR /app
RUN addgroup -g 1001 -S worksphere && \
    adduser -S worksphere -u 1001 -G worksphere
COPY package*.json ./
RUN npm ci --only=production && \
    cp -R node_modules /prod_node_modules && \
    npm ci

# Stage 2: Build
FROM base AS build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Stage 3: Development
FROM node:20-alpine AS development
WORKDIR /app
RUN addgroup -g 1001 -S worksphere && \
    adduser -S worksphere -u 1001 -G worksphere
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
USER worksphere
EXPOSE 4000
CMD ["npx", "nodemon", "--exec", "ts-node", "src/server.ts"]

# Stage 4: Production
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S worksphere && \
    adduser -S worksphere -u 1001 -G worksphere
COPY --from=base /prod_node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./
RUN mkdir -p uploads && chown -R worksphere:worksphere /app
USER worksphere
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"

CMD ["node", "dist/server.js"]
