FROM node:22.23.2-alpine3.24@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS base

# The official native Emscripten SDK requires glibc. Only the 1.4 MB
# generated OpenCV module/WASM leave this stage; compiler/source stay cached.
FROM node:22.23.2-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5 AS ocr-compiler
WORKDIR /opt/beanmap-ocr
RUN apt-get update && apt-get install -y --no-install-recommends python3 cmake make ca-certificates && rm -rf /var/lib/apt/lists/*
COPY scripts/ocr/ ./scripts/ocr/
ENV BEANMAP_OCR_CACHE=/var/cache/beanmap-ocr
ENV BEANMAP_OPENCV_OUTPUT=/opt/beanmap-opencv
ARG TARGETARCH
RUN --mount=type=cache,target=/var/cache/beanmap-ocr,id=beanmap-ocr-compiler-${TARGETARCH} node scripts/ocr/prepare-opencv.mjs

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM deps AS dev
WORKDIR /app
ENV NODE_ENV=development
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    ln -s /tmp/next-env.d.ts /app/next-env.d.ts && \
    chown -h nextjs:nodejs /app/next-env.d.ts
USER nextjs
EXPOSE 3000
CMD ["node_modules/.bin/next", "dev", "-H", "0.0.0.0", "-p", "3000"]

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=ocr-compiler /opt/beanmap-opencv /opt/beanmap-opencv
COPY . .
ENV BEANMAP_OPENCV_BUNDLE=/opt/beanmap-opencv
ENV BEANMAP_OCR_CACHE=/var/cache/beanmap-ocr

# NEXT_PUBLIC_ vars are inlined at build time
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_DEPLOYMENT_ID
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_DEPLOYMENT_ID=$NEXT_DEPLOYMENT_ID

RUN test -n "$NEXT_DEPLOYMENT_ID" || (echo "NEXT_DEPLOYMENT_ID is required for a production image" >&2; exit 1)
RUN --mount=type=cache,target=/var/cache/beanmap-ocr,id=beanmap-ocr-assets npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ARG NEXT_DEPLOYMENT_ID
ENV NEXT_DEPLOYMENT_ID=$NEXT_DEPLOYMENT_ID
LABEL site.beanmap.deployment-id=$NEXT_DEPLOYMENT_ID
RUN apk --no-cache upgrade
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# The standalone server only needs the Node runtime. Remove package managers
# and server source maps from the production image to reduce attack surface.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
    /opt/yarn* /usr/local/bin/yarn /usr/local/bin/yarnpkg && \
    find /app -type f -name '*.map' -delete
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
