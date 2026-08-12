// jobs-data.test.mjs — the gate for src/data/jobs.json, the file a company
// is "published" through (docs/jobs-tree.md).
//
// WHY IT LIVES IN src/locales/ AND NOT NEXT TO src/lib/jobs.js:
// `package.json`'s test script is a file the fleet quality sync
// materialises (the same line ships in templates/astro/package.json), so a
// `src/lib/*.test.mjs` glob added there gets reverted on the next sync and
// this gate would stop running — silently, with green CI. The
// `src/locales/*.test.mjs` glob already in that script is the durable hook.
// Please do not "tidy" this file into src/lib/.
// (Data goes the other way round: src/data/jobs.json must NOT move here,
// locales.test.mjs asserts every *.json in this folder is a locale.)
//
// What it enforces:
//   · ids unique and stable-looking, company FK resolves
//   · titles/summaries present in every required locale (offer copy is
//     CONTENT, carried bilingually in the data — see docs/jobs-tree.md)
//   · every enumeration is a code with a jobs.<group>.<code> in every
//     required dictionary (enumerations are UI chrome, they go through t())
//   · https-only outbound links (a leaf points off-site; a bad link is a
//     reputational hit for brotea.dev)
//   · dates parse, and the tree stays inside the size the layout can hold
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COMPANIES, CONTRACTS, GENERATED_AT, MAX_COMPANIES, MAX_OFFERS, MODALITIES,
  OFFERS, SENIORITIES, activeOffers, companyOf, localized, toneOf,
} from '../lib/jobs.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const read = (f) => JSON.parse(readFileSync(join(DIR, f), 'utf8'));
const config = read('config.json');
const dict = (code) => read(`${code}.json`);

test('the file has a generation stamp and fits the layout', () => {
  assert.ok(Number.isFinite(Date.parse(GENERATED_AT)), 'generated_at must be an ISO instant');
  assert.ok(COMPANIES.length > 0, 'at least one company');
  assert.ok(OFFERS.length > 0, 'at least one offer');
  assert.ok(COMPANIES.length <= MAX_COMPANIES,
    `${COMPANIES.length} companies: limbs overlap past ${MAX_COMPANIES}`);
  assert.ok(OFFERS.length <= MAX_OFFERS,
    `${OFFERS.length} offers: leaves stop being clickable past ${MAX_OFFERS}`);
});

test('companies: unique slugs, https sites', () => {
  const slugs = COMPANIES.map((c) => c.slug);
  assert.deepEqual(slugs, [...new Set(slugs)], 'company slugs must be unique');
  for (const c of COMPANIES) {
    assert.match(c.slug, /^[a-z0-9-]+$/, `company slug '${c.slug}' is not kebab-case`);
    assert.ok(typeof c.name === 'string' && c.name.trim() !== '', `company '${c.slug}' has no name`);
    if (c.url != null) {
      assert.ok(c.url.startsWith('https://'), `company '${c.slug}' url must be https`);
    }
  }
});

test('offers: unique ids and a company that exists', () => {
  const ids = OFFERS.map((o) => o.id);
  assert.deepEqual(ids, [...new Set(ids)], 'offer ids must be unique (they drive geometry and #deep-links)');
  for (const o of OFFERS) {
    assert.match(o.id, /^[a-z0-9-]+$/, `offer id '${o.id}' is not kebab-case`);
    assert.ok(companyOf(o), `offer '${o.id}' points at unknown company '${o.company}'`);
    assert.ok(o.url?.startsWith('https://'), `offer '${o.id}' apply url must be https`);
  }
});

test('offer copy exists in every required locale', () => {
  for (const o of OFFERS) {
    for (const field of ['title', 'summary']) {
      const value = o[field];
      assert.equal(typeof value, 'object',
        `offer '${o.id}' ${field} must be an object keyed by locale, not a bare string`);
      for (const code of config.required) {
        const text = value?.[code];
        assert.ok(typeof text === 'string' && text.trim() !== '',
          `offer '${o.id}' has no ${code} ${field}`);
        assert.equal(localized(value, code), text);
      }
      if (field === 'summary') {
        for (const code of config.required) {
          assert.ok(value[code].length <= 160,
            `offer '${o.id}' ${code} summary is ${value[code].length} chars (max 160)`);
        }
      }
    }
  }
});

test('every enumeration is a code translated in every dictionary', () => {
  const groups = [
    ['modality', MODALITIES, true],
    ['contract', CONTRACTS, true],
    ['seniority', SENIORITIES, false],
  ];
  const dicts = config.required.map((code) => [code, dict(code)]);
  for (const o of OFFERS) {
    for (const [group, allowed, required] of groups) {
      const code = o[group];
      if (code == null) {
        assert.ok(!required, `offer '${o.id}' has no ${group}`);
        continue;
      }
      assert.ok(allowed.includes(code), `offer '${o.id}' has unknown ${group} '${code}'`);
      for (const [locale, d] of dicts) {
        const key = `jobs.${group}.${code}`;
        assert.ok(d[key] && d[key].trim() !== '', `${locale}.json is missing '${key}'`);
      }
    }
  }
});

test('the whole vocabulary is translated, not only the codes in use', () => {
  const dicts = config.required.map((code) => [code, dict(code)]);
  const keys = [
    ...MODALITIES.map((c) => `jobs.modality.${c}`),
    ...CONTRACTS.map((c) => `jobs.contract.${c}`),
    ...SENIORITIES.map((c) => `jobs.seniority.${c}`),
  ];
  for (const [locale, d] of dicts) {
    for (const key of keys) {
      assert.ok(d[key] && d[key].trim() !== '', `${locale}.json is missing '${key}'`);
    }
  }
});

test('dates parse and make sense', () => {
  // Plain `YYYY-MM-DD` is the contract, not a preference: the pages render a
  // date by pinning it to midday UTC, so a full instant would build the string
  // `…ZT12:00:00Z`, and `Intl` throws RangeError on that — a red build for the
  // whole site, or a card that never opens. Shape first, then meaning.
  const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
  for (const o of OFFERS) {
    assert.match(o.published_at, DATE_ONLY, `offer '${o.id}' published_at must be YYYY-MM-DD`);
    const published = Date.parse(o.published_at);
    assert.ok(Number.isFinite(published), `offer '${o.id}' published_at does not parse`);
    if (o.expires_at != null) {
      assert.match(o.expires_at, DATE_ONLY, `offer '${o.id}' expires_at must be YYYY-MM-DD`);
      const expires = Date.parse(o.expires_at);
      assert.ok(Number.isFinite(expires), `offer '${o.id}' expires_at does not parse`);
      assert.ok(expires > published, `offer '${o.id}' expires before it is published`);
    }
  }
});

test('activeOffers drops what has expired, at any clock', () => {
  const sample = [
    { id: 'gone', expires_at: '2026-01-01', published_at: '2025-12-01' },
    { id: 'today', expires_at: '2026-06-15', published_at: '2026-06-01' },
    { id: 'forever', expires_at: null, published_at: '2026-06-01' },
  ];
  const now = Date.parse('2026-06-15T10:00:00Z');
  assert.deepEqual(activeOffers(now, sample).map((o) => o.id), ['today', 'forever'],
    'an offer is live for the whole of its expiry day, and null never expires');
  assert.deepEqual(activeOffers(Date.parse('2026-06-17T00:00:00Z'), sample).map((o) => o.id),
    ['forever']);

  // …and on the real file, with the clock the data was written for.
  const stamped = activeOffers(Date.parse(GENERATED_AT));
  assert.ok(stamped.length < OFFERS.length,
    'the seed must keep one already-expired offer so this path stays exercised');
  assert.ok(stamped.length > 0, 'not every offer can be expired');
});

test('tone: closing beats fresh, and the rest stay open', () => {
  const now = Date.parse('2026-06-15T00:00:00Z'); // fixed clock: no flaky midnight
  const at = (published, expires) => toneOf({ published_at: published, expires_at: expires }, now);
  assert.equal(at('2026-06-14', '2026-06-18'), 'closing', 'about to shut wins over just published');
  assert.equal(at('2026-06-14', '2026-09-01'), 'fresh');
  assert.equal(at('2026-01-10', '2026-09-01'), 'open');
  assert.equal(at('2026-01-10', null), 'open');
  assert.equal(at('2026-06-15', null), 'fresh');
});

test('localized falls back to the default locale, never to a blank', () => {
  assert.equal(localized({ es: 'Hola', en: 'Hi' }, 'en'), 'Hi');
  assert.equal(localized({ es: 'Hola', en: '   ' }, 'en'), 'Hola');
  assert.equal(localized({ es: 'Hola' }, 'xx'), 'Hola');
  assert.equal(localized(null, 'es'), '');
});
