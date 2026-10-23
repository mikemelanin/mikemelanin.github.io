#!/bin/zsh
# Собирает из cv/v2/index.html два PDF: чистый и с красными сносками-правками.
set -e
cd "$(dirname "$0")/../cv/v2"
TMP=$(mktemp -d)
python3 - <<'PY'
s = open('index.html', encoding='utf-8').read()
open('.print-clean.html', 'w', encoding='utf-8').write(s.replace('<body>', '<body class="clean">', 1))
PY
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for pair in ".print-clean.html:Mikhail-Melanin-CV-v2-clean.pdf" "index.html:Mikhail-Melanin-CV-v2-pravki.pdf"; do
  "$CHROME" --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=8000 \
    --user-data-dir="$TMP/chrome" --print-to-pdf="$PWD/${pair#*:}" "file://$PWD/${pair%%:*}" 2>/dev/null
done
rm -rf "$TMP" .print-clean.html
echo "OK: cv/v2/Mikhail-Melanin-CV-v2-clean.pdf, cv/v2/Mikhail-Melanin-CV-v2-pravki.pdf"
