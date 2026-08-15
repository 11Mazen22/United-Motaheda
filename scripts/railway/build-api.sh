#!/usr/bin/env bash
set -euo pipefail

ensure_node22() {
  local major node_bin npm_bin
  node_bin="$(command -v node)"
  major="$("$node_bin" -p "process.versions.node.split('.')[0]")"
  if [[ "$major" -ge 22 ]]; then
    return
  fi

  echo "==> [api] Railway supplied Node.js $("$node_bin" --version); installing Node.js 22…"
  if ! command -v apt-get >/dev/null 2>&1 || ! command -v curl >/dev/null 2>&1; then
    echo "ERROR: Node.js 22 is required, but the Railway build image lacks apt-get or curl." >&2
    exit 1
  fi

  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs

  # Railway's original Node installation can appear earlier in PATH than the
  # NodeSource installation. Put /usr/bin first so every subsequent command
  # in this build uses the Node 22 binaries we just installed.
  export PATH="/usr/bin:$PATH"
  hash -r

  node_bin="$(command -v node)"
  npm_bin="$(command -v npm)"
  major="$("$node_bin" -p "process.versions.node.split('.')[0]")"
  if [[ "$major" -lt 22 ]]; then
    echo "ERROR: Failed to switch the API build environment to Node.js 22+." >&2
    echo "node=$(command -v node) version=$(node --version)" >&2
    echo "npm=$(command -v npm) version=$(npm --version)" >&2
    exit 1
  fi

  echo "==> [api] Using Node.js 22 from $node_bin"
  echo "==> [api] Using npm from $npm_bin"
}

ensure_node22
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
