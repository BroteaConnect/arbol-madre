# The job tree — `/jobs`

A second tree, grown by the same engine as the mother tree, with a
different botany:

| Mother tree (`/`) | Job tree (`/jobs`) |
| --- | --- |
| Limb = a creator | Limb = **a company** |
| Fruit = a project | **Leaf = a job offer** |
| Data polled from `api.brotea.dev/garden` | Data baked from `src/data/jobs.json` |

Live at `/jobs` (Spanish) and `/en/jobs` (English) — one page file,
`src/pages/[...lang]/jobs.astro`, per the i18n contract.

## How a company publishes

There is no backend and no form: the site is a static build. **The
publication surface is `src/data/jobs.json`, and merging a change to that
file is the act of publishing.** A company sends its offer through the
project's Telegram topic, the factory writes the entry, CI checks it, and
the deploy hangs a new leaf on the tree.

Offers link **out** to the company's own posting — the site never collects
applications.

### The data contract

```json
{
  "generated_at": "2026-08-12T00:00:00Z",
  "companies": [
    { "slug": "acme-studio", "name": "Acme Studio",
      "url": "https://acme.example", "location": "Madrid, ES" }
  ],
  "offers": [
    {
      "id": "acme-studio-frontend-2026-08",
      "company": "acme-studio",
      "title":   { "es": "Desarrolladora frontend", "en": "Frontend developer" },
      "summary": { "es": "…160 chars max…", "en": "…160 chars max…" },
      "modality": "remote",
      "contract": "full_time",
      "seniority": "mid",
      "location": "Madrid, ES",
      "url": "https://acme.example/jobs/frontend",
      "published_at": "2026-08-05",
      "expires_at": "2026-09-05"
    }
  ]
}
```

| Field | Rule |
| --- | --- |
| `companies[].slug` | `^[a-z0-9-]+$`, unique. This is the limb. |
| `companies[].name` | Shown as written. |
| `companies[].url` | `https://` or `null`. |
| `offers[].id` | Unique and **stable**: it seeds the geometry and it is the `#deep-link`. Renaming an id reshuffles the tree and breaks shared links. |
| `offers[].company` | Must match a `companies[].slug`. |
| `offers[].title`, `summary` | `{es, en}`, both required, summary ≤ 160 chars. |
| `offers[].modality` | `remote` \| `hybrid` \| `onsite` |
| `offers[].contract` | `full_time` \| `part_time` \| `internship` \| `freelance` |
| `offers[].seniority` | `junior` \| `mid` \| `senior`, optional |
| `offers[].url` | `https://`, required — where the candidate applies. |
| `offers[].published_at` | ISO date. Drives the "just published" tone. |
| `offers[].expires_at` | ISO date or `null`. The offer stays live for the whole of that day. |

Everything above is enforced by `src/locales/jobs-data.test.mjs`, which
runs in `npm test` and therefore in CI. (It lives next to the locales, not
next to `src/lib/jobs.js`, because the `test` script is a file the fleet
quality sync rewrites — `src/locales/*.test.mjs` is the glob that survives.
The data file itself must **not** move into `src/locales/`.)

### Copy: what is content and what is chrome

The repo bans hardcoded user-facing copy, and this file does not break it:

- **Chrome** — every label, every enumeration, the legend, the buttons:
  keys in `src/locales/*.json`, rendered with `t(locale, key)`. A modality
  is stored as the **code** `remote` and rendered through
  `t(locale, 'jobs.modality.remote')`.
- **Content** — the offer's own title and summary, like a project's name on
  the mother tree, is data. It is carried **bilingually inside the data
  file** so both languages ship together, and the test fails if either is
  missing.

## Leaf language

| Leaf | Meaning |
| --- | --- |
| Glowing leaf (`--job-fresh`) | published in the last 7 days |
| Green leaf (`--job-open`) | open |
| Amber leaf (`--job-closing`) | closes within 7 days |

Closing beats fresh: an offer about to shut says that first. Colours are
aliases of existing theme tokens (`--ok`, `--leaf`, `--warn`) declared in
`src/styles/tree-palette.css`; never a new hex, and never in the generated
`theme.css`.

Hovering a leaf shows `title · company`; clicking opens the offer card with
the apply link. `/jobs#<offer-id>` deep-links to a card.

## Expiry, on a static site

An expired offer is dropped **twice**: at build time, when the page renders
its list, and again in the browser with the visitor's own clock (and every
15 minutes for a tab left open). Without the second filter a build from
three weeks ago would keep showing offers that closed — the site ages, the
data does not.

## Engine notes

`src/lib/tree.js` is shared. What each tree *is* lives in a **species**:

```js
createTree(canvas, { species: JOB_SPECIES, onSelect });
```

A species declares `groupOf` (what makes a limb), `keyOf` (the stable
identity that fixes geometry), `maxPerGroup`, `radiusOf`, `labelOf`,
`clusters` (decorative leaves on or off), the extra CSS custom properties
it paints with, and `drawNode` (the shape at the twig tip). Trunk, limbs,
sway, sap pulses, hit-testing, focus ring and label stay shared — a third
tree is a species, not a copy of the engine.

The job tree turns the decorative leaf clusters **off**: with every leaf
being an offer, a leaf that does nothing when clicked would be a trap.

## Limits

The layout fans limbs across the viewport and hit-tests within 24 px, so the
data test caps v1 at **8 companies and 24 offers**. Past that the limbs
overlap and leaves stop being clickable — raise the caps together with the
layout, not before.
