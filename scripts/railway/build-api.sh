#!/usr/bin/env bash
set -euo pipefail

# Railway must provision the runtime from .nvmrc / NODE_VERSION. Do not
# install another Node distribution inside the build container because that
# can leave Railpack's original binary earlier in PATH.
node_major="$(node -p "process.versions.node.split('.')[0]")"
if [[ "$node_major" -lt 24 ]]; then
  echo "ERROR: Pharmacy API requires Node.js 24+." >&2
  echo "Detected: $(node --version) at $(command -v node)" >&2
  echo "Railway must use the repository .nvmrc (24) or NODE_VERSION=24." >&2
  exit 1
fi

echo "==> [api] Node runtime: $(node --version)"
echo "==> [api] npm runtime: $(npm --version)"

echo "==> [api] Installing contracts…"
(cd packages/contracts && npm install --no-audit --no-fund --ignore-scripts)

echo "==> [api] Installing api dependencies…"
cd apps/api
npm install --legacy-peer-deps --include=dev --no-audit --no-fund

echo "==> [api] Generating Prisma client…"
npx prisma generate --schema=prisma/schema.prisma

echo "==> [api] Building NestJS…"
npx nest build

echo "==> [api] Build complete."
