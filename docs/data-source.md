# Data source: the `/garden` endpoint

The **mother tree** is fed by a single public, read-only endpoint served by
brotea-requirements-api. (The job tree at `/jobs` has no endpoint at all:
its data is baked from `src/data/jobs.json` at build time — see
[jobs-tree.md](jobs-tree.md).)

```bash
curl https://api.brotea.dev/garden
```

```json
{
  "generated_at": "2026-07-28T10:00:00+00:00",
  "projects": [
    {
      "slug": "carlos-pintura",
      "name": "Carlos Pintura",
      "status": "production",
      "creator": "crbrotea",
      "creator_name": "Cristhian",
      "url": "https://carlos-pintura.brotea.dev",
      "repo_url": "https://github.com/BroteaConnect/carlos-pintura",
      "topic_url": "https://t.me/...",
      "open_features": 0,
      "deployed_features": 2
    }
  ],
  "events": [
    { "id": 123, "event_type": "deployment.completed", "project": "carlos-pintura",
      "created_at": "2026-07-28T09:59:12.113Z" }
  ]
}
```

- `projects[]` — one entry per project; `status` is one of
  `idea | landing | requirements | development | production | archived`
  and decides the fruit's appearance (see
  [tree-language.md](tree-language.md)). `creator` groups projects into
  limbs. `url`, `repo_url` and `topic_url` populate the project card,
  together with `open_features` / `deployed_features`.
- `events[]` — recent factory events, newest first
  (`feature.proposed`, `feature.pr_opened`, `deployment.completed`, …).
  The project is named in **`project`** (a slug, not `project_slug`) —
  that is the key `index.astro` reads, and an event without it is
  skipped. Each event animates as a sap pulse toward its project's fruit;
  `deployment.completed` additionally blooms (petal burst).

## Polling behavior (`src/lib/data.js`)

- Fetches `/garden` every **15 s** with an 8 s timeout.
- **First load:** replays the last ~8 events so the tree never starts
  still.
- **Subsequent polls:** only events with an `id` greater than the last
  seen one are animated (no duplicates).

## Offline fallback

If the API is unreachable or returns a non-2xx response, the tree
renders the baked snapshot in `src/lib/seed.js` and the stats line shows
`stats.offline` in the page's language ("sin conexión con la fábrica" /
"no connection to the factory"). Polling keeps running; the tree switches
back to live data on the first successful response.
