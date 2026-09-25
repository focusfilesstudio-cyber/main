# AssetVault OS

A local, single-file-stack workspace for turning knowledge into a product.
Four connected screens over one shared store. No backend, no accounts, no network.

## Run it

**Easiest — one file, nothing to install:**
double-click **`AssetVault-OS.html`**. That single file has the CSS and JS
inlined, makes no network requests, and needs no server. Nothing else in this
folder has to be present for it to work.

**Working on the source instead:** edit `index.html` / `styles.css` /
`store.js` / `app.js`, then run `./build.sh` to regenerate the single file.
You can also double-click `index.html` directly, or serve the folder with
`python3 -m http.server 3000` and open http://localhost:3000 — note that a
localhost URL only works on the machine actually running that command.

## How it's connected

Everything reads from one store (`store.js`), so nothing is a static mock:

- Capture an idea on **Content** → the Content count, the Command Center's
  `CONTENT READY`, the linked node's weight in the **Vault** graph and the
  activity stream all move at once.
- Add a note on a **Vault** node → the Vault count and the matching workflow
  row on **Command** move.
- Tick an item on **Deploy** → the pipeline, the status badge, the top-bar
  stage and `Build product` on Command all follow.
- Every node panel lists the content linked to it; clicking through jumps to
  that idea, and the node chip on an idea jumps back to the graph.

State is written to `localStorage`, so it survives a reload. If storage is
blocked (Safari does this on `file://`) it runs in memory for the session and
the sidebar says `SESSION ONLY` instead of `SAVED LOCALLY`.

## Keys

| Key | Action |
| --- | --- |
| `1` `2` `3` `4` | Command · Content · Vault · Deploy |
| `⌘K` / `Ctrl+K` | Command palette — search nodes, ideas, pages, actions |
| `N` | New idea |
| `Esc` | Close palette, composer or node panel |

Number keys and `N` are ignored while you're typing in a field.

## Notes

- Nothing here reports revenue, customers or sales. Counts are of your own
  notes, ideas and checklist items.
- `localStorage.clear()` in the console resets to the seeded vault.
