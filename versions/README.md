# Pokemon (Blob Buddy) — Version Archive

Playable snapshots of the game. Each subdirectory is a self-contained build —
serve any one with `python3 -m http.server` and play it in the browser.

Prompts that drove each version are in [/Users/dereklomas/max/PROMPTS.md](../PROMPTS.md).

## Versions

| ID | Dir | Headline features |
|----|-----|-------------------|
| v6 | `v6-cards-keyboard-mobile/` | Pokemon cards transform you · Arrow keys / WASD + SPACE attack · Mobile D-pad |

Earlier iterations (v1–v5) were built into the same files before the version
archive existed. From v6 on, every major change gets a new snapshot.

## How to play any version locally

```sh
cd versions/v6-cards-keyboard-mobile
python3 -m http.server 8000
# open http://localhost:8000
```

Or deploy any version to its own Vercel URL:

```sh
cd versions/v6-cards-keyboard-mobile
vercel --prod
```
