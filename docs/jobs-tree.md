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
| `generated_at` | ISO **instant**. The clock the file was written for; the gate replays the offers against it. |
| `companies[].slug` | `^[a-z0-9-]+$`, unique. This is the limb. |
| `companies[].name` | Required, non-empty. Shown as written. |
| `companies[].url` | `https://` or `null`. |
| `companies[].location` | Free text, optional. Used by any offer that carries no `location` of its own. |
| `offers[].id` | `^[a-z0-9-]+$`, unique and **stable**: it seeds the geometry and it is the `#deep-link`. Renaming an id reshuffles the tree and breaks shared links. |
| `offers[].company` | Must match a `companies[].slug`. |
| `offers[].title`, `summary` | An **object keyed by locale** (`{es, en}` — every code in `config.required`), never a bare string. Both languages required; summary ≤ 160 chars each. |
| `offers[].modality` | Required. `remote` \| `hybrid` \| `onsite` |
| `offers[].contract` | Required. `full_time` \| `part_time` \| `internship` \| `freelance` |
| `offers[].seniority` | Optional. `junior` \| `mid` \| `senior` |
| `offers[].location` | Free text, optional. Falls back to the company's. |
| `offers[].url` | `https://`, required — where the candidate applies. |
| `offers[].published_at` | Plain `YYYY-MM-DD`. Drives the "just published" tone. |
| `offers[].expires_at` | Plain `YYYY-MM-DD` or `null`, and later than `published_at`. The offer stays live for the whole of that day. |

**Dates are date-only, and that is a contract, not a style.** The pages pin
a plain date to midday UTC so it never slips a day in the reader's zone; a
full instant would build the string `…ZT12:00:00Z`, `Intl` throws
`RangeError` on it, and the whole site goes red — or a card never opens.
`generated_at` is the one field that *is* an instant.

Two rules apply to the file as a whole, both enforced:

- at least one company and at least one offer — an empty file is a broken
  build, not a state (the empty tree is only ever reached at runtime, when
  everything has expired);
- at least one offer already expired at `generated_at`, so the expiry path
  ships exercised. The seed keeps `verdemar-labs-support-2026-06` for
  exactly that; deleting it turns CI red.

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

The gate checks the *whole* vocabulary, not only the codes in use: every
value of `MODALITIES`, `CONTRACTS` and `SENIORITIES` (`src/lib/jobs.js`)
needs its `jobs.<group>.<code>` key in every required dictionary. Adding a
code is therefore two edits — the enum and both locale files — before any
offer can use it.

## Leaf language

| Leaf | Meaning |
| --- | --- |
| Glowing leaf (`--job-fresh`) | published in the last 7 days |
| Green leaf (`--job-open`) | open |
| Amber leaf (`--job-closing`) | closes within 7 days |

Closing beats fresh: an offer about to shut says that first. The glow is a
breathing halo drawn behind the blade, not a different green.

Colours are aliases of tokens that already exist, declared in
`src/styles/tree-palette.css` — never a new hex, and never in the generated
`theme.css`:

| Token | Alias of | Used for |
| --- | --- | --- |
| `--job-fresh` | `--ok` | just-published leaf, and the list's left border |
| `--job-open` | `--leaf` | open leaf |
| `--job-closing` | `--warn` | closing leaf and border |
| `--job-ink` | `--ink-2` | the label painted over the canvas on hover/focus |

## Two ways to read the same list

The offers are **also rendered as plain HTML at build time**: titles, chips,
dates and apply links are readable, crawlable and clickable with JavaScript
off. The canvas is the second way to read the same list, never the only one.

- Hover a leaf → `title · company`. Click → the offer card, with the apply
  link.
- Clicking a title in the list opens the same card and focuses the leaf.
- `/jobs#<offer-id>` deep-links to a card; opening one rewrites the hash,
  closing it drops the hash again.
- A hash pointing at an offer that has since closed is stripped, instead of
  leaving a link that opens nothing on every reload.
- Apply links open in a new tab (`rel="noopener noreferrer nofollow"`), and
  a non-`https` url is dropped rather than rendered — the button hides.
- The mother tree links here (`nav.jobs`) and this page links back
  (`nav.tree`); both keep the visitor's language.

## Expiry, on a static site

An expired offer is dropped **twice**: at build time, when the page renders
its list, and again in the browser with the visitor's own clock (on load,
and every 15 minutes for a tab left open). Without the second filter a build
from three weeks ago would keep showing offers that closed — the site ages,
the data does not.

The re-filter does the whole job, not only the hiding: the counters and the
stats line are recomputed, the empty state appears when nothing is left, the
**tone decays too** (a leaf that became `closing` re-colours without a
reload, so the legend never lies), and a card left open on an offer that
just expired is closed with its hash.

## Engine notes

`src/lib/tree.js` is shared. What each tree *is* lives in a **species**:

```js
createTree(canvas, { species: JOB_SPECIES, onSelect });
```

The species contract, in full:

```js
const SPECIES = {
  groupOf: (item) => …,   // the limb this item hangs from (a company here)
  keyOf: (item) => …,     // stable identity: seeds geometry, drives select()/pulse()
  maxPerGroup: 4,         // past this, the group grows another limb
  clusters: false,        // decorative (non-interactive) leaf clusters
  radiusOf: (item) => 10, // node radius in px
  labelOf: (item) => …,   // the hover/focus label
  colors: { fresh: '--job-fresh' },  // name → CSS custom property
  drawNode(ctx, item, geom, colors, state) { … },  // the shape at the twig tip
};
```

`createTree` merges the species **over `PROJECT_SPECIES`**, so a new tree
only declares what differs (and a missing key silently inherits the mother
tree's). Inside `drawNode`, `geom` is `{x, y, r, t, now, seed, x0, y0}` —
`seed` is the FNV-1a hash of `keyOf(item)`, which is why a shape is
deterministic per item; `state` is `{focus, reduced, grow}`; `colors` holds
the shared palette (`wood`, `leaf`, `leafSoft`, `fruit`, `bud`, `blossom`,
`ink`, `halo`, `ground`) plus the species' own entries, already read from
CSS. Trunk, limbs, sway, sap pulses, hit-testing, focus ring and label stay
shared — a third tree is a species, not a copy of the engine.

The job tree turns the decorative leaf clusters **off**: with every leaf
being an offer, a leaf that does nothing when clicked would be a trap.

## Limits

The layout fans limbs across the viewport and hit-tests within a flat 24 px
radius, so the data test caps v1 at **8 companies and 24 offers**
(`MAX_COMPANIES` / `MAX_OFFERS` in `src/lib/jobs.js`). Past that the limbs
overlap and leaves stop being clickable — raise the caps together with the
layout, not before.

A company is not one limb but one *group*: with more than **4 open offers**
it grows a second limb beside the first (`maxPerGroup: 4`), the same way a
prolific creator forks the mother tree.
