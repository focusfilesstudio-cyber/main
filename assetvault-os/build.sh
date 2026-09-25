#!/bin/sh
# Inline the three assets into one standalone file.
# The only sequence that can close a <script> early is "</script"; nothing else
# in the JS needs escaping, but we neutralise it defensively anyway.
set -e
cd "$(dirname "$0")"
OUT=AssetVault-OS.html

python3 - "$OUT" <<'PY'
import sys, re
out = sys.argv[1]
html  = open('index.html').read()
css   = open('styles.css').read()
store = open('store.js').read()
app   = open('app.js').read()

guard = lambda s: re.sub(r'</(script)', r'<\\/\1', s, flags=re.I)

html = html.replace('<link rel="stylesheet" href="styles.css" />',
                    '<style>\n' + css + '\n</style>')
html = html.replace('<script src="store.js"></script>\n<script src="app.js"></script>',
                    '<script>\n' + guard(store) + '\n</script>\n<script>\n' + guard(app) + '\n</script>')

assert 'href="styles.css"' not in html, 'stylesheet link was not replaced'
assert 'src="store.js"'   not in html, 'store script was not replaced'
assert 'src="app.js"'     not in html, 'app script was not replaced'

open(out, 'w').write(html)
print(f'{out}  {len(html)/1024:.0f} KB  — no external files')
PY
