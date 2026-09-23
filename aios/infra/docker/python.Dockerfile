# FastAPI AI service — evaluation, OCR, mastery, blueprint.
#
# Build from the REPO ROOT: the Prisma Python client is generated from
# packages/db/prisma/schema.prisma by the Node CLI, so both toolchains are
# needed at build time even though only Python runs at the end.
#
#   docker build -f infra/docker/python.Dockerfile -t aios-python .

FROM node:20-alpine AS prisma
# No version pinned here on purpose: corepack resolves it from the root
# package.json's "packageManager" field, so the image cannot drift from the pnpm
# that wrote pnpm-lock.yaml. It used to say pnpm@9, which cannot read the security
# overrides in pnpm-workspace.yaml (pnpm >=10 only) and therefore failed every
# build with ERR_PNPM_LOCKFILE_CONFIG_MISMATCH.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/db/package.json packages/db/
RUN pnpm install --frozen-lockfile --filter @aios/db...
COPY packages/db packages/db

FROM python:3.11-slim AS runtime
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    NODE_ENV=production

WORKDIR /app

# prisma-client-py shells out to the Node CLI to fetch its query engine, so Node
# has to be present in the final image too — not only at build time.
RUN apt-get update \
# fonts-*: the checked-copy PDF embeds real text, so it needs real fonts. Noto
# covers Devanagari and mathematical symbols; DejaVu is the Latin fallback.
# Without them Hindi renders as empty boxes — pdf_fonts.py logs which role is
# missing rather than failing the PDF, so this is easy to miss in a slim image.
 && apt-get install --no-install-recommends -y nodejs npm fonts-noto-core fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/*

COPY apps/api-python/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY --from=prisma /repo/packages/db/prisma/schema.prisma ./prisma/schema.prisma
RUN python -m prisma generate --schema=./prisma/schema.prisma

COPY apps/api-python/src ./src

RUN useradd --create-home --uid 10001 appuser && chown -R appuser /app
USER appuser
EXPOSE 8000

# Single worker: the service is I/O-bound on Postgres and the AI provider, and
# horizontal scaling is the platform's job, not uvicorn's. Concurrency here would
# only add contention against the same downstream limits.
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
