#!/bin/zsh
# Собирает cv/Mikhail-Melanin-CV.pdf из cv/index.html (2 страницы A4).
set -e
cd "$(dirname "$0")/.."
TMP=$(mktemp -d)
python3 - "$TMP" <<'PY'
import sys
s = open('cv/index.html', encoding='utf-8').read()
s = s.replace('</style>', '@media print{body{zoom:.96}}\n</style>', 1)
open(sys.argv[1] + '/cv.html', 'w', encoding='utf-8').write(s)
PY
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --no-pdf-header-footer --user-data-dir="$TMP/chrome" \
  --print-to-pdf="$PWD/cv/Mikhail-Melanin-CV.pdf" "file://$TMP/cv.html" 2>/dev/null
rm -rf "$TMP"
echo "OK: cv/Mikhail-Melanin-CV.pdf"
