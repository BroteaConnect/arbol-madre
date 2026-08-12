// El Árbol Madre — canvas engine.
// One organism: the trunk is Brotea, each main limb belongs to a creator,
// each fruit is a project. Factory events travel as sap pulses from the
// roots to the fruit they concern.
//
// The engine grows more than one kind of tree. What an item IS lives in a
// `species` (see SPECIES below and JOB_SPECIES in lib/jobs.js): the grouping
// that makes a limb, the key that fixes the geometry, and how a node is
// painted at the tip of a twig. Everything else — trunk, limbs, sway, sap,
// hit-testing, focus ring, label — is shared, so a second tree is a species
// and not a fork of this file.

const REDUCED = typeof matchMedia !== 'undefined'
  && matchMedia('(prefers-reduced-motion: reduce)').matches;

const STATUS_ES = {
  idea: 'idea',
  landing: 'landing',
  requirements: 'requisitos',
  development: 'desarrollo',
  production: 'producción',
  archived: 'archivado',
};

// Deterministic randomness per slug so the tree keeps its shape across polls.
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed) {
  let s = seed || 1;
  return () => {
    s = (Math.imul(s, 48271) % 2147483647 + 2147483647) % 2147483647;
    return s / 2147483647;
  };
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/* ---------- species ---------- */

// The mother tree: a project per fruit, grouped by creator. This is also the
// default, so `createTree(canvas, { onSelect })` behaves exactly as before.
export const PROJECT_SPECIES = {
  groupOf: (p) => p.creator ?? 'brotea',
  keyOf: (p) => p.slug,
  maxPerGroup: 4,
  clusters: true, // decorative (non-interactive) leaf clusters on the limbs
  radiusOf: (p) => (p.status === 'production' ? 9 : 7),
  labelOf: (p) => `${p.name} · ${STATUS_ES[p.status] ?? p.status}`,
  colors: {}, // extra CSS custom properties, merged into `colors`
  drawNode(ctx, p, geom, colors, state) {
    const { x, y, r, t } = geom;
    const still = state.reduced;
    const status = p.status;

    if (status === 'production') {
      ctx.fillStyle = colors.halo;
      ctx.globalAlpha = 0.45 + (still ? 0 : Math.sin(t * 2 + geom.x0) * 0.15);
      ctx.beginPath(); ctx.arc(x, y, r * 2.1, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = colors.fruit;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    } else if (status === 'idea') {
      ctx.strokeStyle = colors.bud; ctx.lineWidth = 2;
      ctx.fillStyle = colors.leafSoft;
      ctx.beginPath(); ctx.ellipse(x, y, r * 0.55, r * 0.8, 0.3, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    } else if (status === 'landing') {
      ctx.fillStyle = colors.blossom;
      for (let p2 = 0; p2 < 5; p2++) {
        const a = (p2 / 5) * Math.PI * 2 + t * (still ? 0 : 0.12);
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75, r * 0.5, r * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = colors.fruit;
      ctx.beginPath(); ctx.arc(x, y, r * 0.45, 0, Math.PI * 2); ctx.fill();
    } else {
      // development / requirements: a growing green fruit
      ctx.fillStyle = colors.leaf;
      ctx.beginPath(); ctx.arc(x, y, r * 0.85, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = colors.fruit; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, r * 0.85, 0, Math.PI * 2); ctx.stroke();
    }
  },
};

export function createTree(canvas, { onSelect, species } = {}) {
  const ctx = canvas.getContext('2d');
  const sp = { ...PROJECT_SPECIES, ...species };
  let items = [];
  let layout = null;
  let colors = readColors();
  let hovered = null;
  let selected = null;
  const pulses = [];
  const blooms = [];
  const born = new Map(); // item key → timestamp of first appearance, for grow-in

  function readColors() {
    const base = {
      wood: cssVar('--wood'),
      leaf: cssVar('--leaf'),
      leafSoft: cssVar('--leaf-soft'),
      fruit: cssVar('--accent'),
      bud: cssVar('--bud'),
      blossom: cssVar('--blossom'),
      ink: cssVar('--ink-2'),
      halo: cssVar('--halo'),
      ground: cssVar('--soil'),
    };
    for (const [name, prop] of Object.entries(sp.colors ?? {})) base[name] = cssVar(prop);
    return base;
  }

  /* ---------- layout ---------- */

  // Group items by whatever the species considers a limb (a creator on the
  // mother tree, a company on the job tree), chunked so no limb carries more
  // than `maxPerGroup` nodes. With one group the tree still branches; with
  // more, each group owns its limbs, fanned side by side.
  function limbSpecs(list) {
    const byGroup = new Map();
    for (const item of list) {
      const key = sp.groupOf(item);
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key).push(item);
    }
    const size = sp.maxPerGroup ?? 4;
    const specs = [];
    for (const [group, members] of byGroup) {
      for (let i = 0; i < members.length; i += size) {
        specs.push({ group, items: members.slice(i, i + size) });
      }
    }
    return specs;
  }

  function polyline(x0, y0, angle, length, segments, bend, rand) {
    const pts = [[x0, y0]];
    let a = angle, x = x0, y = y0;
    for (let i = 0; i < segments; i++) {
      const step = length / segments;
      a += bend + (rand() - 0.5) * 0.22;
      x += Math.cos(a) * step;
      y += Math.sin(a) * step;
      pts.push([x, y]);
    }
    return pts;
  }

  function build() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const ground = h - Math.max(36, h * 0.06);
    const rootX = w / 2;
    const scale = Math.min(1, w / 900) * Math.min(1, h / 640);

    const trunkTop = ground - h * 0.38 * Math.max(scale, 0.72);
    const trunk = [
      [rootX, ground],
      [rootX + 6, ground - (ground - trunkTop) * 0.35],
      [rootX - 5, ground - (ground - trunkTop) * 0.7],
      [rootX + 2, trunkTop],
    ];

    const specs = limbSpecs(items);
    const n = specs.length;
    const nodes = [];
    const limbs = [];
    const leaves = [];

    specs.forEach((spec, i) => {
      const rand = rng(hash(spec.group + i));
      // Fan angle: leftmost limb ≈ -145°, rightmost ≈ -35° (screen coords).
      const t = n === 1 ? 0.5 : i / (n - 1);
      const angle = -Math.PI * (0.86 - t * 0.72);
      const start = trunk[3];
      const len = (h * 0.26 + rand() * h * 0.08) * Math.max(scale, 0.72);
      const limb = polyline(start[0], start[1], angle, len, 4, (0.5 - t) * -0.08, rand);
      limbs.push({ path: limb, width: 7 });

      spec.items.forEach((p, j) => {
        const along = 0.45 + (j / Math.max(spec.items.length - 1, 1)) * 0.55;
        const idx = Math.min(Math.floor(along * (limb.length - 1)), limb.length - 2);
        const base = limb[idx];
        const side = j % 2 === 0 ? 1 : -1;
        const twigAngle = angle + side * (0.55 + rand() * 0.4);
        const twig = polyline(base[0], base[1], twigAngle, 34 + rand() * 30, 2, 0.15 * side, rand);
        limbs.push({ path: twig, width: 2.5 });
        const seed = hash(sp.keyOf(p));
        if (sp.clusters) leaves.push({ x: base[0], y: base[1], seed });
        const tip = twig[twig.length - 1];
        nodes.push({
          item: p,
          seed,
          x: tip[0],
          y: tip[1] + 7, // the node hangs just below the twig tip
          r: sp.radiusOf(p),
          path: trunk.concat(limb.slice(1, idx + 1), twig.slice(1), [[tip[0], tip[1] + 7]]),
        });
      });
      if (sp.clusters) {
        leaves.push({ x: limb[limb.length - 1][0], y: limb[limb.length - 1][1], seed: hash(spec.group + i) });
      }
    });

    layout = { w, h, ground, trunk, limbs, nodes, leaves, scale };
  }

  /* ---------- drawing ---------- */

  function sway(y, t) {
    if (REDUCED || !layout) return 0;
    const f = Math.max(0, (layout.ground - y) / layout.ground);
    return Math.sin(t * 0.7 + y * 0.012) * 9 * f * f;
  }

  function drawPath(path, width, t) {
    for (let i = 1; i < path.length; i++) {
      ctx.lineWidth = Math.max(width * (1 - (i - 1) / path.length), 1);
      ctx.beginPath();
      ctx.moveTo(path[i - 1][0] + sway(path[i - 1][1], t), path[i - 1][1]);
      ctx.lineTo(path[i][0] + sway(path[i][1], t), path[i][1]);
      ctx.stroke();
    }
  }

  function drawLeafCluster(cl, t) {
    const rand = rng(cl.seed);
    const x = cl.x + sway(cl.y, t), y = cl.y;
    for (let i = 0; i < 5; i++) {
      const a = rand() * Math.PI * 2;
      const d = 4 + rand() * 12;
      ctx.fillStyle = rand() > 0.45 ? colors.leaf : colors.leafSoft;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d - 4, 8 + rand() * 5, 5 + rand() * 3, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Shared for every species: grow-in, sway, focus ring and label. Only the
  // shape hanging at the tip belongs to the species.
  function drawNode(f, now, t) {
    const grow = Math.min((now - (born.get(sp.keyOf(f.item)) ?? 0)) / 900, 1);
    const r = f.r * (REDUCED ? 1 : 0.2 + 0.8 * grow);
    const x = f.x + sway(f.y, t), y = f.y;
    const focus = f === hovered || sp.keyOf(f.item) === selected;
    const geom = { x, y, r, t, now, seed: f.seed, x0: f.x, y0: f.y };

    sp.drawNode(ctx, f.item, geom, colors, { focus, reduced: REDUCED, grow });

    if (focus) {
      ctx.strokeStyle = colors.fruit; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, r + 5, 0, Math.PI * 2); ctx.stroke();
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = colors.label || colors.ink;
      ctx.fillText(sp.labelOf(f.item), Math.min(Math.max(x, 80), layout.w - 80), y - r - 12);
    }
  }

  function pathPoint(path, prog) {
    const idx = prog * (path.length - 1);
    const i = Math.min(Math.floor(idx), path.length - 2);
    const f = idx - i;
    return [
      path[i][0] + (path[i + 1][0] - path[i][0]) * f,
      path[i][1] + (path[i + 1][1] - path[i][1]) * f,
    ];
  }

  function frame(now, t) {
    if (!layout) return;
    const { w, h, ground, trunk, limbs, nodes, leaves } = layout;
    ctx.clearRect(0, 0, w, h);

    // ground
    ctx.strokeStyle = colors.ground; ctx.lineWidth = 2; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.moveTo(w * 0.08, ground + 1); ctx.lineTo(w * 0.92, ground + 1); ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = colors.wood; ctx.lineCap = 'round';
    drawPath(trunk, 13 * Math.max(layout.scale, 0.7), t);
    for (const limb of limbs) drawPath(limb.path, limb.width, t);
    for (const cl of leaves) drawLeafCluster(cl, t);
    for (const f of nodes) drawNode(f, now, t);

    // sap pulses
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      const prog = (now - p.t0) / p.dur;
      if (prog < 0) continue; // staggered pulse not started yet
      if (prog >= 1) {
        blooms.push({ x: p.node.x, y: p.node.y, t0: now, big: p.big });
        pulses.splice(i, 1);
        continue;
      }
      const [px, py] = pathPoint(p.node.path, prog);
      const x = px + sway(py, t);
      ctx.fillStyle = colors.fruit;
      ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(x, py, 3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.25;
      ctx.beginPath(); ctx.arc(x, py, 8, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // arrival rings & deploy blooms
    for (let i = blooms.length - 1; i >= 0; i--) {
      const b = blooms[i];
      const prog = (now - b.t0) / (b.big ? 1200 : 500);
      if (prog >= 1) { blooms.splice(i, 1); continue; }
      const x = b.x + sway(b.y, t);
      ctx.globalAlpha = 1 - prog;
      if (b.big) {
        ctx.fillStyle = colors.blossom;
        for (let p = 0; p < 8; p++) {
          const a = (p / 8) * Math.PI * 2;
          const d = 6 + prog * 30;
          ctx.beginPath();
          ctx.arc(x + Math.cos(a) * d, b.y + Math.sin(a) * d, 3.5 * (1 - prog * 0.5), 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.strokeStyle = colors.fruit; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, b.y, 6 + prog * 14, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- lifecycle ---------- */

  function fit() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (items.length) build();
  }

  let raf = null;
  function loop(ms) {
    frame(performance.now(), ms / 1000);
    if (!REDUCED) raf = requestAnimationFrame(loop);
  }

  function nodeAt(x, y) {
    if (!layout) return null;
    let best = null, bestD = 24;
    for (const f of layout.nodes) {
      const d = Math.hypot(f.x + sway(f.y, 0) - x, f.y - y);
      if (d < bestD) { best = f; bestD = d; }
    }
    return best;
  }

  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    hovered = nodeAt(e.clientX - r.left, e.clientY - r.top);
    canvas.style.cursor = hovered ? 'pointer' : 'default';
    if (REDUCED) loop(0);
  });
  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const f = nodeAt(e.clientX - r.left, e.clientY - r.top);
    selected = f ? sp.keyOf(f.item) : null;
    onSelect?.(f?.item ?? null);
    if (REDUCED) loop(0);
  });

  const ro = new ResizeObserver(() => { fit(); if (REDUCED) loop(0); });
  ro.observe(canvas);
  fit();

  const themeWatch = matchMedia('(prefers-color-scheme: dark)');
  themeWatch.addEventListener?.('change', () => { colors = readColors(); if (REDUCED) loop(0); });

  if (!REDUCED) raf = requestAnimationFrame(loop);

  return {
    setData(list) {
      const now = performance.now();
      for (const p of list) {
        const key = sp.keyOf(p);
        if (!born.has(key)) born.set(key, items.length ? now : 0);
      }
      items = list;
      build();
      if (REDUCED) loop(0);
    },
    // A factory event reached the node for `key`; big=true blooms (deploys).
    pulse(key, big = false) {
      if (REDUCED || !layout) return;
      const node = layout.nodes.find((f) => sp.keyOf(f.item) === key);
      if (!node) return;
      pulses.push({ node, t0: performance.now() + pulses.length * 350, dur: 2600, big });
    },
    select(key) {
      selected = key;
      if (REDUCED) loop(0);
    },
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
    },
  };
}
