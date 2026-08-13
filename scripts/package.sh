#!/usr/bin/env bash
# Genera dist/mymusicloving-<version>.zip listo para subir a la Chrome Web Store.
# Incluye solo lo que la extensión necesita en runtime: nada de docs, scripts,
# archivos de prueba, .DS_Store ni el .example de config.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VERSION="$(node -p "require('./manifest.json').version")"
OUT="dist/mymusicloving-$VERSION.zip"

# --- Comprobaciones previas ---
fail() { echo "❌ $1" >&2; exit 1; }

[ -f src/lib/config.js ] || fail "Falta src/lib/config.js (cópialo de config.example.js)."

if grep -q "TU_CLIENT_ID_DE_SPOTIFY" src/lib/config.js; then
  fail "src/lib/config.js todavía tiene el Client ID de ejemplo."
fi

node -e "JSON.parse(require('fs').readFileSync('manifest.json'))" \
  || fail "manifest.json no es JSON válido."

for size in 16 32 48 128; do
  [ -f "icons/icon-$size.png" ] || fail "Falta icons/icon-$size.png (corre scripts/build-icons.sh)."
done

HAS_KEY="$(node -p "Boolean(require('./manifest.json').key)")"
if [ "$HAS_KEY" != "true" ]; then
  echo "⚠️  El manifest no tiene \"key\": el ID de la extensión cambiará al publicar"
  echo "   y romperá la redirect URI de Spotify. Ver README (Publicar, paso 2)."
fi

# --- Empaquetado ---
rm -rf dist && mkdir -p dist
find . -name '.DS_Store' -delete

zip -r -q "$OUT" \
  manifest.json \
  icons/icon-16.png icons/icon-32.png icons/icon-48.png icons/icon-128.png \
  src/background src/content src/popup src/lib \
  -x '*.DS_Store' '*.test.html' '*config.example.js' '*/icon.svg'

echo "✅ $OUT ($(du -h "$OUT" | cut -f1 | tr -d ' '))"
echo
echo "Contenido:"
unzip -Z1 "$OUT" | grep -v '/$' | sed 's/^/   /'
