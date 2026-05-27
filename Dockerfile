# --- build ---
FROM node:22-alpine AS build
WORKDIR /app

# Install deps with the full dev set so SvelteKit can build.
COPY package.json ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json svelte.config.js vite.config.ts ./
COPY src ./src
COPY static ./static
RUN npm run build

# Prune to production deps for the runtime image.
RUN npm prune --omit=dev

# --- runtime ---
FROM node:22-alpine AS runtime
WORKDIR /app

# BODY_SIZE_LIMIT must clear the chat attachment cap: 5 files × 5 MB of raw
# image becomes ~33 MB once base64-encoded into the JSON body. 40 MiB leaves
# headroom for the surrounding payload.
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    BODY_SIZE_LIMIT=41943040

# Copy build artifacts + runtime deps + migration assets.
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY migrations ./migrations
COPY scripts ./scripts
COPY docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "build"]
