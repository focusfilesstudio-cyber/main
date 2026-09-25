# AssetVault OS

A local, single-file-stack workspace for turning knowledge into a product.
Four connected screens over one shared store. No backend, no accounts, no network.

## Run it

Either way, no install:

1. **Double-click `index.html`**, or
2. `python3 -m http.server 3000` in this folder, then open http://localhost:3000

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
