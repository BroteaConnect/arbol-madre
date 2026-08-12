// Job offers — the data side of the second tree (each leaf is an offer,
// each limb a company). Pure and DOM-free on purpose: the page localises,
// the canvas engine only draws, and `src/locales/jobs-data.test.mjs` can
// import this file under plain `node --test`.
//
// It therefore imports JSON and nothing else — never `i18n.ts`, whose
// `import.meta.glob` only exists inside Vite.
import data from '../data/jobs.json' with { type: 'json' };
import config from '../locales/config.json' with { type: 'json' };

const DAY = 86400000;

/** The data contract says `published_at`/`expires_at` are plain dates. The
 *  gate enforces it; this is the seatbelt, because a full instant slipping
 *  through used to become `…ZT12:00:00Z` → `Invalid time value` and take the
 *  whole build down with it. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** A plain date pinned to midday UTC so it never slips a day in the reader's
 *  zone; an instant is already unambiguous and passes through untouched. */
export const instantOf = (iso) => (DATE_ONLY.test(iso) ? `${iso}T12:00:00Z` : iso);

/** Enumerations. Every code here needs a `jobs.<group>.<code>` in every
 *  required dictionary — the data test checks exactly that. */
export const MODALITIES = ['remote', 'hybrid', 'onsite'];
export const CONTRACTS = ['full_time', 'part_time', 'internship', 'freelance'];
export const SENIORITIES = ['junior', 'mid', 'senior'];

/** Soft limits — beyond these the limbs overlap and leaves stop being
 *  clickable (flat 24px hit radius in tree.js). Raise them together with
 *  the layout, not before. */
export const MAX_COMPANIES = 8;
export const MAX_OFFERS = 24;

export const GENERATED_AT = data.generated_at;
export const COMPANIES = data.companies;
export const OFFERS = data.offers;

const BY_SLUG = new Map(COMPANIES.map((c) => [c.slug, c]));

/** The company that published an offer (undefined if the FK is broken —
 *  the data test makes sure that never ships). */
export const companyOf = (offer) => BY_SLUG.get(offer.company);

/** A `{es,en}` content field in `locale`, falling back to the default
 *  language rather than rendering a blank. */
export function localized(field, locale) {
  if (field == null) return '';
  if (typeof field === 'string') return field;
  const pick = (code) => {
    const v = field[code];
    return typeof v === 'string' && v.trim() !== '' ? v : undefined;
  };
  return pick(locale) ?? pick(config.defaultLocale) ?? '';
}

/** The instant an offer stops being valid: `expires_at` is a plain date, so
 *  it is live for the whole of that day. `null` never expires. */
export function expiresAt(offer) {
  if (!offer.expires_at) return Infinity;
  // Only a date-only value owns its whole day; an instant is exact.
  return DATE_ONLY.test(offer.expires_at)
    ? Date.parse(offer.expires_at) + DAY
    : Date.parse(offer.expires_at);
}

/**
 * Offers still open at `now`.
 *
 * Called at build time (the page renders the list) AND at runtime (the
 * client re-filters on load): a static site rebuilt three weeks ago would
 * otherwise hang expired offers on the tree forever.
 */
export const activeOffers = (now = Date.now(), list = OFFERS) =>
  list.filter((o) => expiresAt(o) > now);

/** Leaf tone: closing beats fresh — an offer about to shut is the more
 *  urgent thing to say about it. */
export function toneOf(offer, now = Date.now()) {
  if (expiresAt(offer) - now <= 7 * DAY) return 'closing';
  if (now - Date.parse(offer.published_at) <= 7 * DAY) return 'fresh';
  return 'open';
}

/**
 * The active offers, flattened and localised once, ready for both the SSR
 * list and `tree.setData()`. Localising here keeps the canvas engine free
 * of any notion of language.
 */
export function leafItems(locale, now = Date.now()) {
  return activeOffers(now).map((offer) => {
    const company = companyOf(offer) ?? { slug: offer.company, name: offer.company, url: null };
    return {
      id: offer.id,
      company: offer.company,
      companyName: company.name,
      companyUrl: company.url ?? null,
      title: localized(offer.title, locale),
      summary: localized(offer.summary, locale),
      modality: offer.modality,
      contract: offer.contract,
      seniority: offer.seniority ?? null,
      location: offer.location ?? company.location ?? null,
      // https-only, and never trust the file: an offer link is the one place
      // this page hands a visitor to a third party. The gate rejects anything
      // else, so a null here means the data changed under a stale gate.
      url: /^https:\/\//.test(offer.url) ? offer.url : null,
      published_at: offer.published_at,
      expires_at: offer.expires_at ?? null,
      tone: toneOf(offer, now),
    };
  });
}

/* ---------- how the canvas grows this data ---------- */

/**
 * Species for `createTree(canvas, { species: JOB_SPECIES })`: one limb per
 * company, one interactive LEAF per offer where the mother tree hangs a
 * fruit. Decorative clusters are off — two kinds of leaf, only one of them
 * clickable, is a trap for the visitor.
 */
export const JOB_SPECIES = {
  groupOf: (o) => o.company,
  keyOf: (o) => o.id,
  maxPerGroup: 4,
  clusters: false,
  radiusOf: () => 10,
  // Extra CSS custom properties this species paints with (tree-palette.css).
  colors: {
    fresh: '--job-fresh',
    open: '--job-open',
    closing: '--job-closing',
    label: '--job-ink',
  },
  labelOf: (o) => `${o.title} · ${o.companyName}`,

  drawNode(ctx, item, geom, colors, state) {
    const { x, y, r, t, seed } = geom;
    const still = state.reduced;
    const fill = colors[item.tone] || colors.open;
    // Deterministic tilt per offer id, with a slow breath unless the
    // visitor asked for stillness.
    const base = 0.45 + ((seed % 1000) / 1000) * 1.7;
    const angle = base + (still ? 0 : Math.sin(t * 0.6 + (seed % 13)) * 0.07);
    const rx = r * 1.55;
    const ry = r * 0.78;
    // tips of the major axis (the blade is rotated by `angle`)
    const px = x - Math.cos(angle) * rx;
    const py = y - Math.sin(angle) * rx;

    if (item.tone === 'fresh') {
      ctx.fillStyle = colors.halo;
      ctx.globalAlpha = 0.4 + (still ? 0 : Math.sin(t * 2 + x) * 0.12);
      ctx.beginPath();
      ctx.ellipse(x, y, rx * 1.35, ry * 1.7, angle, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // petiole, back to the twig tip
    ctx.strokeStyle = colors.wood;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(x, y - 8);
    ctx.stroke();

    // blade
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
    ctx.fill();

    // midrib
    ctx.strokeStyle = colors.leafSoft;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(x + Math.cos(angle) * rx, y + Math.sin(angle) * rx);
    ctx.stroke();
  },
};
