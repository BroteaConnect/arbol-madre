# El Árbol Madre — arbol-madre

Brotea's living homepage: one tree, one limb per creator, one fruit per
project. The factory's event stream animates it — sap pulses travel from the
roots to the fruit each event concerns, and deploys bloom.

- **Data**: polls `https://api.brotea.dev/garden` every 15 s (public,
  read-only; served by brotea-requirements-api). Falls back to a baked
  snapshot (`src/lib/seed.js`) when the API is unreachable.
- **Engine**: `src/lib/tree.js`, dependency-free canvas 2D. Deterministic
  per-slug randomness keeps the tree's shape stable across polls; layout
  groups projects by creator (max 4 fruits per limb) so the tree forks as
  the team grows.
- **Fruit language**: bud = idea, blossom = landing, green fruit =
  development, glowing ripe fruit = production. Click a fruit for the
  project card (production URL, repo, Telegram topic). Deep link:
  `/#<slug>`.
- **Respect**: `prefers-reduced-motion` renders a still tree;
  `prefers-color-scheme` themes day/night.

Build: `npm ci && npm run build` (static Astro, served by nginx via the
multi-stage Dockerfile). Deployed with Coolify; destination brotea.dev
(first at app.brotea.dev).
