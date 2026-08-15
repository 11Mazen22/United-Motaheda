#!/usr/bin/env bash
set -euo pipefail

ensure_node22() {
  local major
  major="$(node -p "process.versions.node.split('.')[0]")"
  if [[ "$major" -ge 22 ]]; then
    return
  fi

  echo "==> [api] Railway supplied Node.js $(node --version); installing Node.js 22…"
  if ! command -v apt-get >/dev/null 2>&1; then
    echo "ERROR: Node.js 22 is required, but apt-get is unavailable in the Railway build image." >&2
    exit 1
  fi
  if ! command -v curl >/dev/null 2>&1; then
    echo "ERROR: Node.js 22 is required, but curl is unavailable in the Railway build image." >&2
    exit 1
  fi

  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
  hash -r

  major="$(node -p "process.versions.node.split('.')[0]")"
  if [[ "$major" -lt 22 ]]; then
    echo "ERROR: Failed to switch the API build environment to Node.js 22+. Found $(node --version)." >&2
    exit 1
  fi
}

ensure_node22
echo "==> [api] Node runtime: $(node --version)"
npm --version

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
