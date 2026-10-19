# Build the React client and transpile the Node.js/TypeScript backend.
# `npm ci` is preferred once package-lock.json has been generated and committed.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY tsconfig.json vitest.config.ts ./
COPY frontend ./frontend
COPY backend ./backend
COPY open-source/MCP-Sentinel ./open-source/MCP-Sentinel
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
RUN npm run build

FROM node:22-alpine AS production-deps
WORKDIR /app
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

FROM node:22-alpine AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8000
WORKDIR /app
COPY package.json ./package.json
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/backend/src/db/schema.sql ./backend/src/db/schema.sql
USER node
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/backend/index.js"]
