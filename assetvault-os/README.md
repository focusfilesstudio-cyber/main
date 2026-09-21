# AssetVault OS

Local-only visual dashboard for recording B-roll. Not a product, not a service —
four static screens that look like an operator console.

## Run it

Either way works, no install:

1. **Double-click `index.html`** — opens straight in your browser.
2. **Or serve it** (nicer URL on camera):
   ```
   cd assetvault-os
   python3 -m http.server 3000
   ```
   Then open http://localhost:3000

## Screens

`1` Command · `2` Content · `3` Vault · `4` Deploy — press the number keys to switch.

No dependencies, no build step, no network calls. Everything animates offline.
