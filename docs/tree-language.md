# Tree language

Everything on screen means something. One tree = the Brotea factory.

(The site grows a second tree at `/jobs`, with its own vocabulary — a leaf
is a job offer there. See [jobs-tree.md](jobs-tree.md).)

## Anatomy

- **Trunk** — Brotea itself.
- **Main limb** — a creator. Projects are grouped by their `creator`
  field; each limb carries at most **4 fruits**, so a creator with more
  projects gets additional limbs and the tree forks as the team grows.
  With several creators, each person's limbs fan side by side.
- **Fruit** — a project. Hover shows its name and state; click opens the
  project card. `/#<slug>` deep-links straight to a fruit's card.

## Fruit states

The fruit's look mirrors `projects.status` in the factory database:

| Fruit | Status |
| --- | --- |
| Bud | `idea` |
| Blossom | `landing` |
| Green fruit | `requirements` / `development` |
| Glowing ripe fruit | `production` |

## Sap and blooms

Factory events (`feature.proposed`, `feature.pr_opened`,
`deployment.completed`, …) animate as **sap pulses**: a light travels
from the roots up the branches to the fruit the event concerns.
`deployment.completed` ends in a **bloom** — a petal burst on the fruit.

On first load the last ~8 events replay, so the tree is alive from the
first frame even if the factory is quiet.

## Stability and respect

- The tree's shape is **deterministic per slug**: the same projects
  always grow the same branches, across polls and reloads.
- Under `prefers-reduced-motion` the tree renders still — no sap, no
  blooms — while hover and click keep working.
- `prefers-color-scheme` switches day/night themes.
