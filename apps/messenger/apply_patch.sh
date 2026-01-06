#!/usr/bin/env bash
set -euo pipefail
PATCH_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "Applying Messenger Polish Patch (design-preserving)..."
cp -v "$PATCH_DIR/index.patch.css" ./src/index.patch.css 2>/dev/null || cp -v "$PATCH_DIR/index.patch.css" ./index.patch.css
# Copy any patched TS/TSX files to their original paths
while IFS= read -r rel; do
  [ -f "$PATCH_DIR/$rel" ] || continue
  dest="./$rel"
  mkdir -p "$(dirname "$dest")"
  cp -v "$PATCH_DIR/$rel" "$dest"
done < <(tar -tf "$PATCH_DIR/../messenger-polish-patch.zip" | grep -E '\.(tsx|ts)$' || true)
echo "Done. Remember to import './index.patch.css' once in your app entry if you want the micro-utilities."
