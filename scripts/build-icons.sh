#!/usr/bin/env bash
# Regenera icons/icon-{16,32,48,128}.png a partir de icons/icon.svg.
# Usa Chrome en headless para rasterizar el SVG y sips (macOS) para reescalar.
# No es un build step de la extensión: los PNG se versionan y se cargan tal cual.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ICONS="$ROOT/icons"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

if [ ! -x "$CHROME" ]; then
  echo "No encontré Chrome en $CHROME" >&2
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

"$CHROME" --headless --disable-gpu --hide-scrollbars \
  --default-background-color=00000000 \
  --window-size=128,128 \
  --screenshot="$TMP/icon-128.png" \
  "file://$ICONS/icon.svg" >/dev/null 2>&1

cp "$TMP/icon-128.png" "$ICONS/icon-128.png"
for size in 48 32 16; do
  sips -Z "$size" "$TMP/icon-128.png" --out "$ICONS/icon-$size.png" >/dev/null
done

echo "Iconos generados:"
for size in 16 32 48 128; do
  printf '  icon-%s.png  %s\n' "$size" "$(sips -g pixelWidth -g pixelHeight "$ICONS/icon-$size.png" | awk '/pixel/{printf "%s ", $2}')"
done
