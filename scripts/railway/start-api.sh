#!/usr/bin/env bash
set -eu
# See scripts/railway/build-api.sh for why pipefail is enabled defensively
# rather than unconditionally -- Railway's build/run container's "bash" does
# not actually support it.
(set -o pipefail) 2>/dev/null && set -o pipefail || true

major="$(node -p "process.versions.node.split('.')[0]")"
if [ "$major" -lt 22 ]; then
  echo "ERROR: Pharmacy API requires Node.js 22+. Railway is starting Node.js $(node --version)." >&2
  echo "Redeploy the service from the latest main build so the Node.js 22 build setup is applied." >&2
  exit 1
fi

echo "==> [api] Node runtime: $(node --version)"
exec node apps/api/dist/main.js
