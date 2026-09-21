/* ══════════════════════════════════════════════
   AssetVault OS — local visual dashboard
   No dependencies. No network. No build step.
   ══════════════════════════════════════════════ */
(function () {
  'use strict';

  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));

  /* ─────────── clock ─────────── */
  const clockEl = $('#clock');
  const tick = () => {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    clockEl.textContent = p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  };
  tick();
  setInterval(tick, 1000);

  /* ─────────── router ─────────── */
  const TITLES = {
    command: 'Command Center',
    content: 'Content Engine',
    vault:   'Vault Graph',
    deploy:  'Product Deployment'
  };
  const ORDER = ['command', 'content', 'vault', 'deploy'];

  let current = null;
  let busy = false;

  function replayEntrance(page) {
    page.classList.remove('playing');
    void page.offsetWidth;          // force reflow so CSS animations restart
    page.classList.add('playing');
  }

  function go(name) {
    if (busy || name === current || !TITLES[name]) return;
    busy = true;

    const next = $('#page-' + name);
    const prev = current ? $('#page-' + current) : null;

    if (prev) {
      stop(current);
      prev.classList.add('leaving');
      prev.classList.remove('active');
      setTimeout(() => prev.classList.remove('leaving', 'playing'), 340);
    }

    $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === name));
    $('#crumbText').textContent = TITLES[name];

    setTimeout(() => {
      next.classList.add('active');
      replayEntrance(next);
      current = name;
      start(name);
      busy = false;
    }, prev ? 180 : 0);
  }

  $$('.nav-item').forEach(b => b.addEventListener('click', () => go(b.dataset.page)));

  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const i = ['1', '2', '3', '4'].indexOf(e.key);
    if (i > -1) { e.preventDefault(); go(ORDER[i]); return; }
    if (e.key === 'Escape') closeNote();
  });

  /* per-page timer bookkeeping so nothing runs off-screen */
  const timers = { content: [], deploy: [] };
  const clearTimers = k => { timers[k].forEach(clearTimeout); timers[k] = []; };
  const later = (k, fn, ms) => timers[k].push(setTimeout(fn, ms));

  function start(name) {
    if (name === 'content') startContent();
    if (name === 'vault')   startGraph();
    if (name === 'deploy')  startDeploy();
  }
  function stop(name) {
    if (name === 'content') { clearTimers('content'); }
    if (name === 'vault')   { stopGraph(); }
    if (name === 'deploy')  { clearTimers('deploy'); }
  }

  /* ══════════ PAGE 1 — workflow card clicks ══════════ */
  $$('#page-command .flow').forEach(card => {
    card.addEventListener('click', () => {
      const on = card.classList.contains('picked');
      $$('#page-command .flow').forEach(c => c.classList.remove('picked'));
      if (!on) card.classList.add('picked');
    });
  });

  /* ══════════ PAGE 2 — terminal + auto-highlight ══════════ */
  const TERM = [
    { t: 'Analyzing audience...',  ok: false },
    { t: 'Structuring angle...',   ok: false },
    { t: 'Matching offer...',      ok: false },
    { t: 'Draft ready.',           ok: true  }
  ];
  const termBody = $('#termBody');
  const ideas = $$('#page-content .idea');

  function typeLine(idx, done) {
    if (idx >= TERM.length) return done();

    const row = document.createElement('div');
    row.className = 'term-line';
    row.innerHTML = '<span class="term-arrow">›</span><span class="term-text"></span>';
    termBody.appendChild(row);

    const span = $('.term-text', row);
    const full = TERM[idx].t;
    let i = 0;

    const caret = document.createElement('span');
    caret.className = 'caret';
    span.appendChild(caret);

    (function step() {
      if (i <= full.length) {
        span.textContent = full.slice(0, i);
        span.appendChild(caret);
        i++;
        later('content', step, 24);
      } else {
        caret.remove();
        row.classList.add(TERM[idx].ok ? 'ok' : 'done');
        later('content', () => typeLine(idx + 1, done), TERM[idx].ok ? 260 : 430);
      }
    })();
  }

  function runTerminal() {
    termBody.innerHTML = '';
    typeLine(0, () => later('content', runTerminal, 2600));
  }

  function runHighlight() {
    let k = 0;
    (function cycle() {
      ideas.forEach((el, i) => el.classList.toggle('hot', i === k));
      k = (k + 1) % ideas.length;
      later('content', cycle, 2800);
    })();
  }

  function startContent() {
    clearTimers('content');
    later('content', runTerminal, 700);
    later('content', runHighlight, 900);
  }

  /* manual click overrides the auto-highlight for that card */
  ideas.forEach(card => {
    card.addEventListener('click', () => {
      ideas.forEach(c => c.classList.remove('hot'));
      card.classList.add('hot');
    });
  });

  /* ══════════ PAGE 3 — vault graph ══════════ */
  const NODES = [
    { id: 'product',      label: 'Product',      x: 450, y: 310, r: 26, hub: true },
    { id: 'audience',     label: 'Audience',     x: 234, y: 231, r: 20 },
    { id: 'research',     label: 'Research',     x: 371, y:  94, r: 18 },
    { id: 'offer',        label: 'Offer',        x: 565, y: 111, r: 20 },
    { id: 'sales',        label: 'Sales',        x: 676, y: 270, r: 18 },
    { id: 'distribution', label: 'Distribution', x: 626, y: 458, r: 21 },
    { id: 'content',      label: 'Content',      x: 450, y: 540, r: 20 },
    { id: 'hooks',        label: 'Hooks',        x: 262, y: 442, r: 19 }
  ];

  const EDGES = [
    ['audience', 'research'], ['audience', 'hooks'], ['audience', 'product'],
    ['research', 'offer'],    ['research', 'hooks'],
    ['offer', 'product'],     ['offer', 'sales'],
    ['hooks', 'content'],
    ['content', 'product'],   ['content', 'distribution'], ['content', 'sales'],
    ['distribution', 'product'], ['distribution', 'sales']
  ];

  /* factual-looking working notes — no revenue, customer or sales claims */
  const NOTES = {
    product: {
      kicker: 'CORE NODE',
      tags: ['hub', 'asset', 'v1'],
      links: 4,
      notes: [
        'The packaged form of everything upstream — research, hooks and offer collapsed into one deliverable.',
        'Structure: 6 modules, one worksheet per module, one template vault.',
        'Every other node either feeds this or distributes it.'
      ]
    },
    audience: {
      kicker: 'INPUT NODE', tags: ['research', 'positioning'], links: 3,
      notes: [
        'Who the asset is built for, written as a single sentence before anything else gets made.',
        'Pulled from recurring questions, not assumptions.',
        'Feeds directly into Hooks and Offer.'
      ]
    },
    research: {
      kicker: 'INPUT NODE', tags: ['market', 'gaps'], links: 3,
      notes: [
        'Raw capture layer. Nothing here is structured yet — that is deliberate.',
        'Tracks what already exists so the offer is not a duplicate.',
        'Reviewed weekly, pruned monthly.'
      ]
    },
    offer: {
      kicker: 'STRUCTURE NODE', tags: ['positioning', 'scope'], links: 3,
      notes: [
        'The promise, the scope, and the boundary of what the product does not cover.',
        'Written before the product is built, revised after.',
        'Connects Research to Product.'
      ]
    },
    hooks: {
      kicker: 'OUTPUT NODE', tags: ['content', 'angles'], links: 3,
      notes: [
        'Angle library. One line per idea, no drafts stored here.',
        'Sourced from Audience language, rewritten for tension.',
        'Feeds the Content Engine.'
      ]
    },
    content: {
      kicker: 'OUTPUT NODE', tags: ['pipeline', 'reels'], links: 4,
      notes: [
        'Where hooks become scripts and scripts become recorded assets.',
        'Format decided before writing, not after.',
        'Routes to Distribution once a draft is ready.'
      ]
    },
    distribution: {
      kicker: 'CHANNEL NODE', tags: ['reach', 'cadence'], links: 3,
      notes: [
        'Channel map and posting cadence. One asset, several cuts.',
        'Nothing gets published that does not point back to Product.',
        'Cadence is a constraint, not a target.'
      ]
    },
    sales: {
      kicker: 'SURFACE NODE', tags: ['storefront', 'copy'], links: 3,
      notes: [
        'Storefront copy, FAQ, and the checkout surface itself.',
        'Mirrors the Offer node word for word — no new promises here.',
        'Last node to be touched before launch.'
      ]
    }
  };

  const byId = {};
  NODES.forEach(n => { byId[n.id] = n; });

  const PRODUCT_CLUSTER = ['product', 'audience', 'offer', 'content', 'distribution'];

  const svg     = $('#graph');
  const gEdges  = $('#gEdges');
  const gNodes  = $('#gNodes');
  const gPulses = $('#gPulses');
  const gZoom   = $('#gZoom');
  const NS = 'http://www.w3.org/2000/svg';

  const edgeEls = [];
  const nodeEls = {};
  let graphBuilt = false;

  function buildGraph() {
    if (graphBuilt) return;

    EDGES.forEach(([a, b]) => {
      const ln = document.createElementNS(NS, 'line');
      ln.setAttribute('class', 'edge');
      gEdges.appendChild(ln);
      edgeEls.push({ el: ln, a, b });
    });

    NODES.forEach(n => {
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'node' + (n.hub ? ' hub' : ''));

      const halo = document.createElementNS(NS, 'circle');
      halo.setAttribute('class', 'node-halo');
      halo.setAttribute('r', n.r + 16);

      const core = document.createElementNS(NS, 'circle');
      core.setAttribute('class', 'node-core');
      core.setAttribute('r', n.r);

      const hit = document.createElementNS(NS, 'circle');
      hit.setAttribute('r', n.r + 22);
      hit.setAttribute('fill', 'transparent');

      const tx = document.createElementNS(NS, 'text');
      tx.textContent = n.label;

      g.appendChild(halo); g.appendChild(core); g.appendChild(hit); g.appendChild(tx);
      g.addEventListener('click', () => selectNode(n.id));
      gNodes.appendChild(g);

      nodeEls[n.id] = { g, halo, core, hit, tx };
    });

    graphBuilt = true;
  }

  let raf = null;
  let t0 = 0;

  function frame(ts) {
    if (!t0) t0 = ts;
    const t = (ts - t0) / 1000;

    NODES.forEach((n, i) => {
      // two out-of-phase sines per axis => organic, non-repeating-looking drift
      n.cx = n.x + Math.sin(t * 0.26 + i * 1.7) * 11 + Math.sin(t * 0.13 + i * 0.6) * 6;
      n.cy = n.y + Math.cos(t * 0.22 + i * 2.1) * 10 + Math.cos(t * 0.17 + i * 1.1) * 5;

      const e = nodeEls[n.id];
      e.halo.setAttribute('cx', n.cx); e.halo.setAttribute('cy', n.cy);
      e.core.setAttribute('cx', n.cx); e.core.setAttribute('cy', n.cy);
      e.hit.setAttribute('cx', n.cx);  e.hit.setAttribute('cy', n.cy);
      e.tx.setAttribute('x', n.cx);    e.tx.setAttribute('y', n.cy + n.r + 21);
    });

    edgeEls.forEach(e => {
      const a = byId[e.a], b = byId[e.b];
      e.el.setAttribute('x1', a.cx); e.el.setAttribute('y1', a.cy);
      e.el.setAttribute('x2', b.cx); e.el.setAttribute('y2', b.cy);
    });

    // travelling pulses
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      p.k += p.speed;
      if (p.k >= 1) { p.el.remove(); pulses.splice(i, 1); continue; }
      const a = byId[p.a], b = byId[p.b];
      p.el.setAttribute('cx', a.cx + (b.cx - a.cx) * p.k);
      p.el.setAttribute('cy', a.cy + (b.cy - a.cy) * p.k);
      p.el.setAttribute('opacity', Math.sin(p.k * Math.PI) * 0.95);
    }

    raf = requestAnimationFrame(frame);
  }

  const pulses = [];
  let pulseTimer = null;

  function emitPulse() {
    const e = EDGES[Math.floor(Math.random() * EDGES.length)];
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('class', 'pulse-dot');
    c.setAttribute('r', 3.4);
    gPulses.appendChild(c);
    pulses.push({ el: c, a: e[0], b: e[1], k: 0, speed: 0.0042 + Math.random() * 0.003 });

    pulseTimer = setTimeout(emitPulse, 620 + Math.random() * 1100);
  }

  function startGraph() {
    buildGraph();
    t0 = 0;
    if (!raf) raf = requestAnimationFrame(frame);
    if (!pulseTimer) pulseTimer = setTimeout(emitPulse, 500);
  }

  function stopGraph() {
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    if (pulseTimer) { clearTimeout(pulseTimer); pulseTimer = null; }
    pulses.splice(0).forEach(p => p.el.remove());
    closeNote();
  }

  /* ── selection / notes / zoom ── */
  const panel     = $('#notePanel');
  const graphHint = $('.graph-hint');
  let selected = null;

  function selectNode(id) {
    if (selected === id) { closeNote(); return; }
    selected = id;

    const cluster = (id === 'product')
      ? PRODUCT_CLUSTER
      : [id].concat(EDGES.filter(e => e.indexOf(id) > -1).map(e => (e[0] === id ? e[1] : e[0])));

    Object.keys(nodeEls).forEach(k => {
      nodeEls[k].g.classList.toggle('sel', k === id);
      nodeEls[k].g.classList.toggle('faded', cluster.indexOf(k) === -1);
    });

    edgeEls.forEach(e => {
      const inC = cluster.indexOf(e.a) > -1 && cluster.indexOf(e.b) > -1;
      const touching = e.a === id || e.b === id;
      e.el.classList.toggle('lit', touching);
      e.el.classList.toggle('dim', !inC && !touching);
    });

    // Zoom about the graph centre, then shift left so the note panel
    // never covers a node. tx = cx*(1-s) + dx  (scale-about-a-point, pre-shifted).
    if (id === 'product') {
      gZoom.setAttribute('transform', 'translate(-272, -49.6) scale(1.16)');   // tighter zoom on the hub
    } else {
      gZoom.setAttribute('transform', 'translate(-212.5, -15.5) scale(1.05)');
    }

    const n = byId[id], d = NOTES[id];
    $('#noteKicker').textContent = d.kicker;
    $('#noteTitle').textContent  = n.label;
    $('#noteTags').innerHTML     = d.tags.map(t => '<span class="note-tag">#' + t + '</span>').join('');
    $('#noteList').innerHTML     = d.notes.map(t => '<li>' + t + '</li>').join('');
    $('#noteLinks').textContent  = d.links + ' linked notes';

    panel.classList.add('open');
    graphHint.style.opacity = '0';
  }

  function closeNote() {
    selected = null;
    panel.classList.remove('open');
    graphHint.style.opacity = '';
    gZoom.setAttribute('transform', '');
    Object.keys(nodeEls).forEach(k => nodeEls[k].g.classList.remove('sel', 'faded'));
    edgeEls.forEach(e => e.el.classList.remove('lit', 'dim'));
  }

  $('#noteClose').addEventListener('click', closeNote);
  svg.addEventListener('click', e => { if (e.target === svg) closeNote(); });

  /* ══════════ PAGE 4 — deploy sequence ══════════ */
  const steps   = $$('#pipeline .pl-step');
  const links   = $$('#pipeline .pl-link');
  const checks  = $$('#page-deploy .check');
  const badge   = $('#deployStatus');
  const badgeTx = $('#deployStatusText');
  const cta     = $('#ctaBtn');

  function resetDeploy() {
    clearTimers('deploy');
    steps.forEach(s => s.classList.remove('on'));
    links.forEach(l => l.classList.remove('on'));
    checks.forEach(c => c.classList.remove('on'));
    cta.classList.remove('armed');
    badge.dataset.state = 'building';
    badgeTx.textContent = 'BUILDING';
  }

  function startDeploy() {
    resetDeploy();

    steps.forEach((s, i)  => later('deploy', () => s.classList.add('on'), 900 + i * 820));
    links.forEach((l, i)  => later('deploy', () => l.classList.add('on'), 1240 + i * 820));
    checks.forEach((c, i) => later('deploy', () => c.classList.add('on'), 1900 + i * 820));

    later('deploy', () => { badge.dataset.state = 'ready'; badgeTx.textContent = 'READY'; }, 4500);
    later('deploy', () => { badge.dataset.state = 'live';  badgeTx.textContent = 'PRODUCT LIVE'; }, 5700);
    later('deploy', () => cta.classList.add('armed'), 5700);
  }

  $('#replayBtn').addEventListener('click', startDeploy);

  cta.addEventListener('click', () => {
    if (!cta.classList.contains('armed')) return;
    cta.style.transform = 'translateY(1px) scale(.985)';
    setTimeout(() => { cta.style.transform = ''; }, 170);
  });

  /* ─────────── boot ─────────── */
  go('command');
})();
