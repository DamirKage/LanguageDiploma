# Build context: repository root (npm workspaces share one lockfile).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --workspace server --include-workspace-root --ignore-scripts
COPY shared shared
COPY server server
RUN npm run build --workspace server

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --workspace server --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/server/dist server/dist
WORKDIR /app/server
RUN mkdir -p uploads && chown -R node:node uploads
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1
CMD ["node", "dist/index.js"]
