# Собирает cv/v2/index.html из template.html: {{logo:Имя}} и {{svg:Имя}} заменяются логотипами из experience.html.
import re
from pathlib import Path
root = Path(__file__).resolve().parents[2]
src = (root / 'experience.html').read_text(encoding='utf-8')
logos = {}
for m in re.finditer(r'<span class="logo"', src):
    depth = 0
    for t in re.finditer(r'<span\b|</span>', src[m.start():]):
        depth += 1 if t.group() != '</span>' else -1
        if depth == 0:
            sp = src[m.start():m.start() + t.end()]
            break
    lab = re.search(r'aria-label="([^"]+)"', sp[:200])
    wm = re.search(r'<span class="wm">([^<]+)</span>', sp)
    key = lab.group(1) if lab else (wm.group(1).strip() if wm else None)
    if key: logos.setdefault(key, sp)
t = (root / 'scripts/cv-v2/template.html').read_text(encoding='utf-8')
t = re.sub(r'\{\{logo:([^}]+)\}\}', lambda m: logos[m.group(1)], t)
t = re.sub(r'\{\{svg:([^}]+)\}\}', lambda m: re.search(r'<svg.*?</svg>', logos[m.group(1)], re.S).group(0), t)
assert '{{' not in t
(root / 'cv/v2/index.html').write_text(t, encoding='utf-8')
print('OK: cv/v2/index.html')
