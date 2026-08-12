# El Árbol Madre — documentation

Brotea's living homepage: one tree is the whole factory. Each main limb
belongs to a creator, each fruit is a project, and the factory's event
stream animates the organism — sap pulses travel from the roots to the
fruit each event concerns, and deploys bloom.

Live at https://app.brotea.dev (destination brotea.dev).

## Pages

- [data-source.md](data-source.md) — the `/garden` API contract, polling
  and the offline fallback.
- [tree-language.md](tree-language.md) — the visual metaphor: limbs,
  fruits, sap pulses, blooms, and how the tree scales.
- [jobs-tree.md](jobs-tree.md) — the second tree at `/jobs`: every leaf a
  job offer, every limb a company. Data contract, how a company publishes
  and the leaf language.

## Architecture

Static Astro site, no runtime dependencies. Everything renders on a
single full-viewport `<canvas>`.

| Piece | Role |
| --- | --- |
| `src/lib/tree.js` | Dependency-free canvas 2D engine: layout, drawing, animation, hit-testing. Parameterised by a **species** — the mother tree and the job tree are two species of the same engine. |
| `src/lib/data.js` | Polls `https://api.brotea.dev/garden` every 15 s; deduplicates events; falls back to the seed. |
| `src/lib/seed.js` | Baked project snapshot shown when the API is unreachable. |
| `src/lib/jobs.js` | Job offers: active-offer filtering, localisation and `JOB_SPECIES` (see [jobs-tree.md](jobs-tree.md)). |
| `src/styles/tree-palette.css` | The botanical palette the canvas reads (`--leaf`, `--wood`, …) plus the shared page shell. **Not** in the generated `theme.css`: a tree page that skips this file draws in black. |

Key engineering properties:

- **Deterministic shape.** Branch geometry is derived from a per-slug
  hash (FNV-1a feeding a small PRNG), so the tree keeps the exact same
  shape across polls and reloads — only fruit state and animations change.
- **Interaction.** Hover highlights a fruit with its name and state;
  click opens the project card (production URL, GitHub repo, Telegram
  topic, open/deployed feature counts). Deep link `/#<slug>` opens that
  card on load, and `hashchange` is handled.
- **Accessibility.** `prefers-reduced-motion: reduce` renders a still
  tree (no pulses, no blooms). `prefers-color-scheme` drives day/night
  themes; colors come from CSS custom properties in the Brotea palette
  (green `#1a7f37` family).
- **Animation correctness.** Sap pulses are staggered; a pulse whose
  start time has not arrived yet (negative progress) is skipped by all
  `pathPoint` consumers instead of being drawn at the roots.

## Build and deploy

```bash
npm ci && npm run build   # what CI runs (GitHub Actions)
```

The static output is served by nginx via the multi-stage `Dockerfile`.
Deployed with Coolify to production.
