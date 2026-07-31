#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENGINE_ROOT="$(cd "$ROOT/.." && pwd)"
PUBLIC="$ROOT/public"

mkdir -p "$PUBLIC/lib" "$PUBLIC/assets/fonts"

if [[ ! -f "$ENGINE_ROOT/build/playcanvas.mjs" ]]; then
  echo "Building PlayCanvas engine..."
  (cd "$ENGINE_ROOT" && npm run build:rel:esm)
fi

cp "$ENGINE_ROOT/build/playcanvas.mjs" "$PUBLIC/lib/playcanvas.mjs"
cp "$ENGINE_ROOT/hosting/static/assets/fonts/courier.json" "$PUBLIC/assets/fonts/" 2>/dev/null || \
cp "$ENGINE_ROOT/examples/dist/static/assets/fonts/courier.json" "$PUBLIC/assets/fonts/" 2>/dev/null || \
cp "$ENGINE_ROOT/examples/assets/fonts/courier.json" "$PUBLIC/assets/fonts/"

if [[ -f "$ENGINE_ROOT/hosting/static/assets/fonts/courier.png" ]]; then
  cp "$ENGINE_ROOT/hosting/static/assets/fonts/courier.png" "$PUBLIC/assets/fonts/"
elif [[ -f "$ENGINE_ROOT/examples/dist/static/assets/fonts/courier.png" ]]; then
  cp "$ENGINE_ROOT/examples/dist/static/assets/fonts/courier.png" "$PUBLIC/assets/fonts/"
fi

echo "Collect Cubes web bundle ready in $PUBLIC ($(du -sh "$PUBLIC" | awk '{print $1}'))"
