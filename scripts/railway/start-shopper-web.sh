#!/usr/bin/env bash
set -eu
# See scripts/railway/build-api.sh for why pipefail is enabled defensively.
(set -o pipefail) 2>/dev/null && set -o pipefail || true
npm install -g serve --no-audit --no-fund --silent
# -s (single-page-app mode) rewrites any request that doesn't match a real
# file to index.html, so React Router's client-side routes resolve on a
# direct/refresh navigation -- not just when reached by an in-app link click.
# Without it, `serve` does a literal file lookup and 404s on every route
# except "/", which is exactly what broke every password-reset and
# email-confirmation link (both point at a specific path like
# /reset-password, and an email client always does a direct navigation).
exec serve apps/shopper-web/dist -s -l "${PORT:-3000}" --no-clipboard
