# NestJS API and worker — ONE image, two start commands.
#
#   API:    node dist/main.js       (set RUN_WORKERS=false once a worker runs)
#   Worker: node dist/worker.js
#
# Deliberately one image rather than two: producers and consumers must share a
# single definition of queue names and job payload shapes. Two images drift, and
# a drifted payload fails inside a worker where nobody is watching.
#
# Build from the REPO ROOT, not this directory — the pnpm workspace needs
# packages/db (the Prisma schema) and the root lockfile:
#   docker build -f infra/docker/api.Dockerfile -t aios-api .

FROM node:20-alpine AS base
# No version pinned here on purpose: corepack resolves it from the root
# package.json's "packageManager" field, so the image cannot drift from the pnpm
# that wrote pnpm-lock.yaml. It used to say pnpm@9, which cannot read the security
# overrides in pnpm-workspace.yaml (pnpm >=10 only) and therefore failed every
# build with ERR_PNPM_LOCKFILE_CONFIG_MISMATCH.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# Prisma's query engine is dynamically linked against OpenSSL, and Alpine ships
# neither openssl nor the compat libs by default — without this, generate emits
# "Prisma failed to detect the libssl/openssl version to use" and falls back to an
# openssl-1.1.x engine that this Alpine (OpenSSL 3.x) cannot load at run time. The
# failure is at RUNTIME, on the first query, not at build.
RUN apk add --no-cache openssl  && corepack enable
WORKDIR /repo

# ---- deps: cached until a manifest or the lockfile changes -------------------
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/config/package.json packages/config/
# --frozen-lockfile so a stale lockfile fails the build instead of silently
# resolving different versions than CI tested.
RUN pnpm install --frozen-lockfile --filter @aios/api... --filter @aios/db...

# ---- build ------------------------------------------------------------------
FROM deps AS build
COPY packages/db packages/db
# @aios/config holds tsconfig.base.json, which every app's tsconfig `extends`.
# Without it tsc does not error — it silently falls back to its DEFAULT options
# (target ES3), and the build dies with a wall of TS2802/TS18028 "can only be
# iterated with --downlevelIteration" errors in code that compiles fine locally.
COPY packages/config packages/config
COPY apps/api apps/api
# ONLY the JS client. schema.prisma declares two generators — `client`
# (prisma-client-js) and `client_py` (prisma-client-py) — and an unfiltered
# `prisma generate` runs both, so this step failed here with
# "Generator prisma-client-py failed: prisma-client-py: not found". There is no
# Python in a Node image and there should not be; the Python client is generated
# in python.Dockerfile, which selects the other generator the same way.
RUN pnpm --filter @aios/db exec prisma generate --generator client
RUN pnpm --filter @aios/api build

# ---- runtime ----------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
# Never bake a default that would enable the credential-less mock login. The API
# also refuses to boot if this is ever true under NODE_ENV=production.
ENV ENABLE_DEV_LOGIN=false

COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/apps/api/node_modules apps/api/node_modules
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/api/package.json apps/api/
COPY --from=build /repo/packages/db packages/db

WORKDIR /repo/apps/api
# Non-root: nothing here needs to write to the filesystem at run time.
USER node
EXPOSE 4000

# Overridden to dist/worker.js for the worker deployment.
CMD ["node", "dist/main.js"]
