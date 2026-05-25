#!/bin/bash
# Generate medium-resolution (800px max) versions of every v2 mockup layer
# into public/mockups/v2/medium/. Used by the gallery preview path in
# MockupRendererV2 (preview prop) — full 3000×4500 PNGs are only loaded
# when the user clicks into a mockup to tweak it.
#
# Run from repo root: bash scripts/gen-medium-layers.sh
# Re-run when adding/replacing any v2 asset.

set -e

SRC_DIR="public/mockups/v2"
DST_DIR="public/mockups/v2/medium"

if [ ! -d "$SRC_DIR" ]; then
  echo "Error: $SRC_DIR not found. Run from repo root." >&2
  exit 1
fi

mkdir -p "$DST_DIR"

count=0
for f in "$SRC_DIR"/*.png; do
  [ -e "$f" ] || continue
  base=$(basename "$f")
  sips -Z 800 "$f" --out "$DST_DIR/$base" >/dev/null
  count=$((count + 1))
done

total_size=$(du -sh "$DST_DIR" | awk '{print $1}')
echo "Generated $count medium-resolution layers in $DST_DIR ($total_size total)"
