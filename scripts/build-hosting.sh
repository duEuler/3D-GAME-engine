#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/examples/dist"
OUT="$ROOT/hosting"

mkdir -p "$OUT/iframe" "$OUT/static/assets/fonts" "$OUT/modules"

cp "$DIST/iframe/misc_collect-cubes.html" "$OUT/iframe/"
cp "$DIST/iframe/misc_collect-cubes.example.mjs" "$OUT/iframe/"
cp "$DIST/iframe/misc_collect-cubes.controls.mjs" "$OUT/iframe/"
cp "$DIST/iframe/loader.mjs" "$OUT/iframe/"
cp "$DIST/iframe/context.mjs" "$OUT/iframe/"
cp "$DIST/iframe/runtime.mjs" "$OUT/iframe/"
cp "$DIST/iframe/state.mjs" "$OUT/iframe/"
cp "$DIST/iframe/files.mjs" "$OUT/iframe/"
cp "$DIST/iframe/polyfill.js" "$OUT/iframe/"
cp "$DIST/iframe/ministats.mjs" "$OUT/iframe/"
cp "$DIST/iframe/zoom.mjs" "$OUT/iframe/"
cp "$DIST/iframe/main.css" "$OUT/iframe/"
cp "$DIST/iframe/playcanvas.mjs" "$OUT/iframe/"
cp "$DIST/iframe/playcanvas-observer.mjs" "$OUT/iframe/"

rm -rf "$OUT/static/assets/fonts" "$OUT/modules/fflate"
cp -r "$DIST/static/assets/fonts" "$OUT/static/assets/"
cp -r "$DIST/modules/fflate" "$OUT/modules/"

echo "Hosting bundle ready at $OUT ($(du -sh "$OUT" | awk '{print $1}'))"
