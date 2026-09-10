# Next.js frontend.
#
#   docker build -f infra/docker/web.Dockerfile -t aios-web .
#
# Build from the REPO ROOT, not this directory — the pnpm workspace needs
# packages/db (the web app imports @aios/db for its generated types) and the
# root lockfile. Same convention as api.Dockerfile.
#
# This container is not just a static host: next.config.js rewrites /api/v1 to
# the NestJS API and /api/py to the Python engine, so the Next server is a
# load-bearing proxy at run time. Both destinations are read from the
# environment at startup and must be set on the container.

FROM node:20-alpine AS base
# No version pinned here on purpose: corepack resolves it from the root
# package.json's "packageManager" field, so the image cannot drift from the pnpm
# that wrote pnpm-lock.yaml. It used to say pnpm@9, which cannot read the security
# overrides in pnpm-workspace.yaml (pnpm >=10 only) and therefore failed every
# build with ERR_PNPM_LOCKFILE_CONFIG_MISMATCH.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# Prisma's query engine links against OpenSSL, which Alpine does not ship — see
# api.Dockerfile for the runtime failure this prevents.
RUN apk add --no-cache openssl  && corepack enable
WORKDIR /repo

# ---- deps: cached until a manifest or the lockfile changes -------------------
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/config/package.json packages/config/
# --frozen-lockfile so a stale lockfile fails the build instead of silently
# resolving different versions than CI tested.
RUN pnpm install --frozen-lockfile --filter @aios/web... --filter @aios/db...

# ---- build ------------------------------------------------------------------
FROM deps AS build
COPY packages/db packages/db
# @aios/config holds tsconfig.base.json, which every app's tsconfig `extends`.
# Without it tsc does not error — it silently falls back to its DEFAULT options
# (target ES3), and the build dies with a wall of TS2802/TS18028 "can only be
# iterated with --downlevelIteration" errors in code that compiles fine locally.
COPY packages/config packages/config
COPY apps/web apps/web
# @aios/db is imported for its generated Prisma types; the client must exist
# before tsc runs during `next build`. `--generator client` selects the JS client
# only — schema.prisma also declares `client_py` (prisma-client-py), which is not
# installable in a Node image and is generated in python.Dockerfile instead.
RUN pnpm --filter @aios/db exec prisma generate --generator client

# No NEXT_PUBLIC_API_URL build arg, and that absence is the point: both backend
# destinations are now resolved per request by route handlers (see
# src/lib/server/upstream-proxy.ts), not frozen into the build. This image is
# therefore environment-agnostic — the SAME artifact runs in dev, staging and
# production, configured at run time by API_URL and PYTHON_API_URL.
#
# It used to take NEXT_PUBLIC_API_URL as a build arg because next.config.js
# resolved its rewrite destinations at build time. That meant one image per
# environment, and an image promoted from staging to production would have gone
# on quietly calling the staging API.
RUN pnpm --filter @aios/web build

# ---- runtime ----------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production

COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/apps/web/node_modules apps/web/node_modules
COPY --from=build /repo/apps/web/.next apps/web/.next
# (No apps/web/public directory exists — this app serves no static assets from one.
#  Add the COPY back alongside it if that changes.)
COPY --from=build /repo/apps/web/package.json apps/web/
COPY --from=build /repo/apps/web/next.config.js apps/web/
COPY --from=build /repo/packages/db packages/db

WORKDIR /repo/apps/web
# Non-root: nothing here needs to write to the filesystem at run time.
USER node
EXPOSE 3000

# Exec form so `next start` is PID 1 and receives SIGTERM directly. Shell form
# would put /bin/sh at PID 1, which forwards nothing — see main.ts's shutdown
# comment for the measured cost of a signal that never arrives (an 11s hang and
# a SIGKILL on every deploy).
CMD ["node_modules/.bin/next", "start", "-p", "3000"]
