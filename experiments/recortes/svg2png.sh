#!/bin/bash
# Converte SVGs em PNG com o `convert` (ImageMagick). O `convert` delega SVG para o
# `rsvg-convert`; onde ele não existe, o atalho abaixo usa o cairosvg (pip install cairosvg).
# Uso: bash svg2png.sh arquivo.svg [mais.svg ...]   (grava ao lado, com .png)
SHIM_DIR="$(mktemp -d)"
cat > "$SHIM_DIR/rsvg-convert" <<'PY'
#!/usr/bin/env python3
import sys
import cairosvg
a = sys.argv[1:]
out = inp = None
i = 0
while i < len(a):
    if a[i] == '-o':
        out = a[i + 1]
        i += 2
    else:
        inp = a[i]
        i += 1
cairosvg.svg2png(url=inp, write_to=out)
PY
chmod +x "$SHIM_DIR/rsvg-convert"
if command -v rsvg-convert >/dev/null 2>&1; then :; else export PATH="$SHIM_DIR:$PATH"; fi
for f in "$@"; do
  convert "$f" "${f%.svg}.png" && echo "ok ${f%.svg}.png"
done
rm -rf "$SHIM_DIR"
