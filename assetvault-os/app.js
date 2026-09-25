/* ══════════════════════════════════════════════
   AssetVault OS — views. Nothing here holds state;
   every screen renders from Vault.get() and re-renders on change.
   ══════════════════════════════════════════════ */
(function () {
  'use strict';

  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const V  = window.Vault;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
  const typing = el => el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);

  /* ─────────── clock ─────────── */
  const clockEl = $('#clock');
  const tick = () => {
    const d = new Date(), p = n => String(n).padStart(2, '0');
    clockEl.textContent = p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  };
  tick(); setInterval(tick, 1000);

  /* ─────────── cursor light on panels ─────────── */
  let spotQ = false, spotE = null;
  document.addEventListener('pointermove', e => {
    spotE = e;
    if (spotQ) return;
    spotQ = true;
    requestAnimationFrame(() => {
      spotQ = false;
      const el = spotE.target && spotE.target.closest ? spotE.target.closest('.glass') : null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (spotE.clientX - r.left) + 'px');
      el.style.setProperty('--my', (spotE.clientY - r.top) + 'px');
    });
  }, { passive: true });

  /* ═══════════════ ROUTER ═══════════════ */
  const TITLES = { command: 'Command', content: 'Content', vault: 'Vault', deploy: 'Deploy' };
  const ORDER  = ['command', 'content', 'vault', 'deploy'];
  let current = null, busy = false;

  function go(name, opts) {
    opts = opts || {};
    if (!TITLES[name]) return;
    if (name === current) { if (opts.then) opts.then(); return; }
    if (busy) return;
    busy = true;

    const next = $('#page-' + name);
    const prev = current ? $('#page-' + current) : null;

    if (prev) {
      stop(current);
      prev.classList.add('leaving'); prev.classList.remove('active');
      setTimeout(() => prev.classList.remove('leaving', 'playing'), 340);
    }

    $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === name));
    $('#crumbText').textContent = TITLES[name];

    setTimeout(() => {
      next.classList.add('active');
      next.classList.remove('playing'); void next.offsetWidth; next.classList.add('playing');
      current = name;
      start(name);
      busy = false;
      if (opts.then) opts.then();
    }, prev ? 180 : 0);
  }

  $$('.nav-item').forEach(b => b.addEventListener('click', () => go(b.dataset.page)));

  const timers = { content: [], deploy: [] };
  const clearTimers = k => { timers[k].forEach(clearTimeout); timers[k] = []; };
  const later = (k, fn, ms) => timers[k].push(setTimeout(fn, ms));

  function start(n) {
    if (n === 'command') startCommand();
    if (n === 'content') startContent();
    if (n === 'vault')   startGraph();
    if (n === 'deploy')  startDeploy();
  }
  function stop(n) {
    if (n === 'content') clearTimers('content');
    if (n === 'deploy')  clearTimers('deploy');
    if (n === 'vault')   stopGraph();
  }

  /* ═══════════════ 1 · COMMAND ═══════════════ */
  function renderCommand() {
    const s = V.get(), d = V.derived;
    const live = d.isLive();

    $('#statRow').innerHTML = [
      { lab: 'PRODUCT',        val: esc(s.product.name), cls: '' },
      { lab: 'STATUS',         val: (live ? 'LIVE' : 'BUILDING'), cls: live ? 'accent-live' : 'accent-warm', dot: true },
      { lab: 'CONTENT READY',  val: d.ready(), count: true },
      { lab: 'ACTIVE SYSTEMS', val: d.activeSystems(), count: true }
    ].map((t, i) => `
      <div class="stat glass anim" style="--i:${i + 1}">
        <div class="stat-label mono">${t.lab}</div>
        <div class="stat-value ${t.cls || ''}">${t.dot ? '<span class="dot ' + (live ? 'dot-live' : 'dot-warm') + '"></span>' : ''}<span ${t.count ? 'data-count="' + t.val + '"' : ''}>${t.val}</span></div>
      </div>`).join('');

    const wf = d.workflow();
    $('#workflowNote').textContent = wf.filter(w => w.have >= w.need).length + ' / ' + wf.length + ' COMPLETE';

    $('#flowRow').innerHTML = wf.map((w, i) => {
      const pct  = Math.min(100, Math.round(w.have / w.need * 100));
      const done = w.have >= w.need;
      const state = done ? 'done' : (w.have > 0 ? 'active' : 'queued');
      const chip = done ? '<span class="chip chip-done"><span class="dot dot-done"></span>COMPLETE</span>'
                 : w.have > 0 ? '<span class="chip chip-active"><span class="dot dot-live"></span>ACTIVE</span>'
                 : '<span class="chip chip-queued"><span class="dot dot-idle"></span>QUEUED</span>';
      return `
        <button class="flow glass anim ${done ? '' : 'is-active'}" style="--i:${i + 6}" data-page="${w.page}" data-state="${state}">
          <div class="flow-top"><span class="flow-idx mono">0${i + 1}</span>${chip}</div>
          <div class="flow-name">${w.name}</div>
          <div class="flow-meta mono">${w.have} / ${w.need} ${w.unit}</div>
          <div class="track"><i style="--pct:${pct}%"></i></div>
        </button>`;
    }).join('');

    $$('#flowRow .flow').forEach(b => b.addEventListener('click', () => go(b.dataset.page)));
  }

  function countUp(el, to, ms) {
    const t0 = performance.now();
    (function step(now) {
      const k = Math.min(1, (now - t0) / ms);
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step); else el.textContent = to;
    })(t0);
  }

  function startCommand() {
    $$('#page-command [data-count]').forEach((el, i) => {
      const to = parseInt(el.dataset.count, 10);
      el.textContent = '0';
      setTimeout(() => countUp(el, to, 900), 340 + i * 120);
    });
  }

  /* ═══════════════ 2 · CONTENT ═══════════════ */
  const LABEL = { queued: 'QUEUED', drafting: 'DRAFTING', ready: 'READY' };
  const CHIP  = { queued: 'chip-queued', drafting: 'chip-active', ready: 'chip-done' };
  const DOT   = { queued: 'dot-idle',    drafting: 'dot-live',    ready: 'dot-done' };

  function renderContent() {
    const s = V.get();
    $('#ideaEmpty').hidden = s.ideas.length > 0;

    $('#ideaList').innerHTML = s.ideas.map((it, i) => {
      const n = V.node(it.node) || { label: '—' };
      return `
        <article class="idea glass anim" style="--i:${i + 1}" data-id="${it.id}">
          <p class="idea-hook">${esc(it.hook)}</p>
          <div class="idea-meta">
            <span class="meta-val">${esc(it.format)}</span>
            <button class="node-chip" data-goto="${it.node}" title="Open in Vault">◈ ${esc(n.label)}</button>
            <button class="chip ${CHIP[it.status]}" data-cycle="${it.id}" title="Click to advance">
              <span class="dot ${DOT[it.status]}"></span>${LABEL[it.status]}
            </button>
            <button class="idea-del" data-del="${it.id}" title="Remove">×</button>
          </div>
        </article>`;
    }).join('');

    $$('#ideaList [data-cycle]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation(); V.actions.cycleStatus(b.dataset.cycle);
    }));
    $$('#ideaList [data-del]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation(); V.actions.removeIdea(b.dataset.del);
    }));
    $$('#ideaList [data-goto]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation(); openNode(b.dataset.goto);
    }));

    const sel = $('#composerNode');
    if (!sel.options.length) {
      sel.innerHTML = V.NODES.map(n => `<option value="${n.id}">${esc(n.label)}</option>`).join('');
      sel.value = 'hooks';
    }
  }

  /* composer */
  const composer = $('#composer');
  function openComposer() {
    go('content', { then: () => {
      composer.hidden = false;
      composer.classList.add('in');
      $('#composerHook').focus();
    }});
  }
  function closeComposer() {
    composer.hidden = true; composer.classList.remove('in');
    $('#composerHook').value = ''; $('#composerFormat').value = '';
  }
  $('#newIdeaBtn').addEventListener('click', openComposer);
  $('#composerCancel').addEventListener('click', closeComposer);
  composer.addEventListener('submit', e => {
    e.preventDefault();
    const hook = $('#composerHook').value.trim();
    if (!hook) return;
    V.actions.addIdea(hook, $('#composerFormat').value.trim(), $('#composerNode').value);
    closeComposer();
  });

  /* activity stream — real events, typed in for the first paint */
  const termBody = $('#termBody');
  let termShown = 0;

  function fmtT(ts) {
    const d = new Date(ts), p = n => String(n).padStart(2, '0');
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  function addLine(entry, animate, done) {
    const row = document.createElement('div');
    row.className = 'term-line ' + (entry.kind || 'info');
    row.innerHTML = `<span class="term-ts">${fmtT(entry.t)}</span><span class="term-arrow">›</span><span class="term-text"></span>`;
    termBody.appendChild(row);
    termBody.scrollTop = termBody.scrollHeight;
    const span = $('.term-text', row);

    if (!animate) { span.textContent = entry.text; if (done) done(); return; }

    const caret = document.createElement('span');
    caret.className = 'caret'; span.appendChild(caret);
    let i = 0;
    (function step() {
      if (i <= entry.text.length) {
        span.textContent = entry.text.slice(0, i); span.appendChild(caret);
        i++; later('content', step, 16);
      } else { caret.remove(); if (done) done(); }
    })();
  }

  function startContent() {
    clearTimers('content');
    termBody.innerHTML = '';
    const recent = V.get().log.slice(0, 6).reverse();
    termShown = V.get().log.length;
    (function next(k) {
      if (k >= recent.length) return;
      addLine(recent[k], true, () => later('content', () => next(k + 1), 180));
    })(0);
  }

  /* new events append live while the page is open */
  function syncLog() {
    const log = V.get().log;
    if (current !== 'content' || log.length <= termShown) { termShown = log.length; return; }
    const fresh = log.slice(0, log.length - termShown).reverse();
    termShown = log.length;
    fresh.forEach(e => addLine(e, true));
  }

  /* ═══════════════ 3 · VAULT ═══════════════ */
  const svg = $('#graph'), gEdges = $('#gEdges'), gNodes = $('#gNodes'),
        gPulses = $('#gPulses'), gZoom = $('#gZoom');
  const NS = 'http://www.w3.org/2000/svg';
  const byId = {}; V.NODES.forEach(n => { byId[n.id] = Object.assign({}, n); });
  const CLUSTER = ['product', 'audience', 'offer', 'content', 'distribution'];

  const edgeEls = [], nodeEls = {};
  let built = false;

  function buildGraph() {
    if (built) return;
    V.EDGES.forEach(([a, b]) => {
      const ln = document.createElementNS(NS, 'line');
      ln.setAttribute('class', 'edge'); gEdges.appendChild(ln);
      edgeEls.push({ el: ln, a, b });
    });
    V.NODES.forEach(n => {
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'node' + (n.hub ? ' hub' : ''));
      const halo = document.createElementNS(NS, 'circle');
      halo.setAttribute('class', 'node-halo'); halo.setAttribute('r', n.r + (n.hub ? 26 : 16));
      let ring = null;
      if (n.hub) { ring = document.createElementNS(NS, 'circle'); ring.setAttribute('class', 'node-ring'); ring.setAttribute('r', n.r + 9); }
      const core = document.createElementNS(NS, 'circle');
      core.setAttribute('class', 'node-core'); core.setAttribute('r', n.r);
      const hit = document.createElementNS(NS, 'circle');
      hit.setAttribute('r', n.r + 22); hit.setAttribute('fill', 'transparent');
      const tx = document.createElementNS(NS, 'text'); tx.textContent = n.label;
      const ct = document.createElementNS(NS, 'text'); ct.setAttribute('class', 'node-count');

      g.appendChild(halo); if (ring) g.appendChild(ring);
      g.appendChild(core); g.appendChild(hit); g.appendChild(tx); g.appendChild(ct);
      g.addEventListener('click', () => selectNode(n.id));
      gNodes.appendChild(g);
      nodeEls[n.id] = { g, halo, ring, core, hit, tx, ct };
    });
    built = true;
  }

  /* each node carries its own weight: notes + linked ideas */
  function renderGraphCounts() {
    V.NODES.forEach(n => {
      const c = V.derived.noteCount(n.id) + V.derived.ideasFor(n.id).length;
      const e = nodeEls[n.id]; if (!e) return;
      e.ct.textContent = c || '';
      e.g.classList.toggle('empty', c === 0);
    });
  }

  let raf = null, t0 = 0;
  const pulses = []; let pulseTimer = null;

  function frame(ts) {
    if (!t0) t0 = ts;
    const t = (ts - t0) / 1000;
    V.NODES.forEach((n, i) => {
      const b = byId[n.id];
      b.cx = n.x + Math.sin(t * .26 + i * 1.7) * 11 + Math.sin(t * .13 + i * .6) * 6;
      b.cy = n.y + Math.cos(t * .22 + i * 2.1) * 10 + Math.cos(t * .17 + i * 1.1) * 5;
      const e = nodeEls[n.id];
      e.halo.setAttribute('cx', b.cx); e.halo.setAttribute('cy', b.cy);
      if (e.ring) { e.ring.setAttribute('cx', b.cx); e.ring.setAttribute('cy', b.cy); }
      e.core.setAttribute('cx', b.cx); e.core.setAttribute('cy', b.cy);
      e.hit.setAttribute('cx', b.cx);  e.hit.setAttribute('cy', b.cy);
      e.tx.setAttribute('x', b.cx);    e.tx.setAttribute('y', b.cy + n.r + 21);
      e.ct.setAttribute('x', b.cx);    e.ct.setAttribute('y', b.cy + 5);
    });
    edgeEls.forEach(e => {
      const a = byId[e.a], b = byId[e.b];
      e.el.setAttribute('x1', a.cx); e.el.setAttribute('y1', a.cy);
      e.el.setAttribute('x2', b.cx); e.el.setAttribute('y2', b.cy);
    });
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i]; p.k += p.speed;
      if (p.k >= 1) { p.el.remove(); pulses.splice(i, 1); continue; }
      const a = byId[p.a], b = byId[p.b];
      p.el.setAttribute('cx', a.cx + (b.cx - a.cx) * p.k);
      p.el.setAttribute('cy', a.cy + (b.cy - a.cy) * p.k);
      p.el.setAttribute('opacity', Math.sin(p.k * Math.PI) * .95);
    }
    raf = requestAnimationFrame(frame);
  }

  function emitPulse() {
    const e = V.EDGES[Math.floor(Math.random() * V.EDGES.length)];
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('class', 'pulse-dot'); c.setAttribute('r', 3.4);
    gPulses.appendChild(c);
    pulses.push({ el: c, a: e[0], b: e[1], k: 0, speed: .0042 + Math.random() * .003 });
    pulseTimer = setTimeout(emitPulse, 620 + Math.random() * 1100);
  }

  function startGraph() {
    buildGraph(); renderGraphCounts(); t0 = 0;
    if (!raf) raf = requestAnimationFrame(frame);
    if (!pulseTimer) pulseTimer = setTimeout(emitPulse, 500);
  }
  function stopGraph() {
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    if (pulseTimer) { clearTimeout(pulseTimer); pulseTimer = null; }
    pulses.splice(0).forEach(p => p.el.remove());
    closeNote();
  }

  /* ─── node panel: notes, linked content, deploy ─── */
  const panel = $('#notePanel'), graphHint = $('.graph-hint');
  let selected = null;

  function selectNode(id) {
    if (selected === id) { closeNote(); return; }
    selected = id;

    const cluster = id === 'product' ? CLUSTER
      : [id].concat(V.EDGES.filter(e => e.indexOf(id) > -1).map(e => e[0] === id ? e[1] : e[0]));

    Object.keys(nodeEls).forEach(k => {
      nodeEls[k].g.classList.toggle('sel', k === id);
      nodeEls[k].g.classList.toggle('faded', cluster.indexOf(k) === -1);
    });
    edgeEls.forEach(e => {
      const inC = cluster.indexOf(e.a) > -1 && cluster.indexOf(e.b) > -1;
      const touch = e.a === id || e.b === id;
      e.el.classList.toggle('lit', touch);
      e.el.classList.toggle('dim', !inC && !touch);
    });
    gZoom.setAttribute('transform', id === 'product'
      ? 'translate(-272, -49.6) scale(1.16)' : 'translate(-212.5, -15.5) scale(1.05)');

    renderPanel();
    panel.classList.add('open');
    graphHint.classList.add('hidden');
  }

  function renderPanel() {
    if (!selected) return;
    const n = V.node(selected), notes = V.get().notes[selected] || [];
    const ideas = V.derived.ideasFor(selected), dep = V.derived.deployFor(selected);

    $('#noteKicker').textContent = n.kind + ' NODE';
    $('#noteTitle').textContent  = n.label;
    $('#noteTags').innerHTML     = n.tags.map(t => `<span class="note-tag">#${t}</span>`).join('');
    $('#noteCount').textContent  = notes.length;
    $('#linkedCount').textContent = ideas.length;

    $('#noteList').innerHTML = notes.length
      ? notes.map(nt => `<li>${esc(nt.text)}<button class="note-del" data-note="${nt.id}" aria-label="Remove">×</button></li>`).join('')
      : '<li class="muted">No notes yet.</li>';
    $$('#noteList [data-note]').forEach(b =>
      b.addEventListener('click', () => V.actions.removeNote(selected, b.dataset.note)));

    $('#linkedIdeasSec').hidden = ideas.length === 0;
    $('#linkedIdeas').innerHTML = ideas.map(i =>
      `<button class="link-row" data-idea="${i.id}">
         <span class="dot ${DOT[i.status]}"></span>
         <span class="link-text">${esc(i.hook)}</span>
       </button>`).join('');
    $$('#linkedIdeas [data-idea]').forEach(b =>
      b.addEventListener('click', () => focusIdea(b.dataset.idea)));

    $('#linkedDeploySec').hidden = dep.length === 0;
    $('#linkedDeploy').innerHTML = dep.map(d =>
      `<button class="link-row" data-dep="${d.id}">
         <span class="tick ${d.done ? 'on' : ''}"></span>
         <span class="link-text">${esc(d.label)}</span>
       </button>`).join('');
    $$('#linkedDeploy [data-dep]').forEach(b =>
      b.addEventListener('click', () => V.actions.toggleDeploy(b.dataset.dep)));
  }

  $('#noteForm').addEventListener('submit', e => {
    e.preventDefault();
    const v = $('#noteInput').value.trim();
    if (!v || !selected) return;
    V.actions.addNote(selected, v);
    $('#noteInput').value = '';
  });

  function closeNote() {
    selected = null;
    panel.classList.remove('open');
    graphHint.classList.remove('hidden');
    gZoom.setAttribute('transform', '');
    Object.keys(nodeEls).forEach(k => nodeEls[k].g.classList.remove('sel', 'faded'));
    edgeEls.forEach(e => e.el.classList.remove('lit', 'dim'));
  }
  $('#noteClose').addEventListener('click', closeNote);
  svg.addEventListener('click', e => { if (e.target === svg) closeNote(); });

  /* ─── cross-screen jumps ─── */
  function openNode(id) { go('vault', { then: () => setTimeout(() => selectNode(id), 260) }); }
  function focusIdea(id) {
    go('content', { then: () => setTimeout(() => {
      const el = $(`#ideaList [data-id="${id}"]`);
      if (!el) return;
      $$('#ideaList .idea').forEach(x => x.classList.remove('hot'));
      el.classList.add('hot');
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 280) });
  }

  /* ═══════════════ 4 · DEPLOY ═══════════════ */
  const PIPE = [
    { key: 'idea',    label: 'Idea',         test: s => s.ideas.length > 0 },
    { key: 'struct',  label: 'Structure',    test: () => V.derived.totalNotes() >= 5 },
    { key: 'product', label: 'Product',      test: s => s.deploy.some(d => d.label === 'Product' && d.done) },
    { key: 'store',   label: 'Storefront',   test: s => s.deploy.filter(d => /Landing|Checkout/.test(d.label)).every(d => d.done) },
    { key: 'dist',    label: 'Distribution', test: s => s.deploy.some(d => d.label === 'Content' && d.done) }
  ];

  function renderDeploy() {
    const s = V.get();
    const on = PIPE.map(p => !!p.test(s));

    $('#pipeline').innerHTML = PIPE.map((p, i) =>
      `${i ? `<div class="pl-link" data-link="${i - 1}"><i></i></div>` : ''}
       <div class="pl-step" data-step="${i}"><span class="pl-node"></span><span class="pl-label">${p.label}</span></div>`
    ).join('');

    $('#checkRow').innerHTML = s.deploy.map((d, i) =>
      `<button class="check glass ${d.done ? 'on' : ''}" data-dep="${d.id}" style="--i:${i}">
         <span class="check-mark"><svg viewBox="0 0 16 16"><path d="M3 8.4 6.3 11.6 13 5"/></svg></span>
         <span class="check-name">${esc(d.label)}</span>
       </button>`).join('');
    $$('#checkRow [data-dep]').forEach(b =>
      b.addEventListener('click', () => V.actions.toggleDeploy(b.dataset.dep)));

    $('#urlField').value = s.product.url || '';
    return on;
  }

  function setBadge(on) {
    const badge = $('#deployStatus'), tx = $('#deployStatusText');
    const live = V.derived.isLive();
    const any  = on.some(Boolean);
    badge.dataset.state = live ? 'live' : (any ? 'ready' : 'building');
    tx.textContent      = live ? 'PRODUCT LIVE' : (any ? 'IN PROGRESS' : 'BUILDING');
    $('#ctaBtn').classList.toggle('armed', live);
  }

  /* repaint without the entrance sequence — used when state changes
     while the page is already open, which otherwise blanks the pipeline */
  function paintDeploy(on) {
    $$('#pipeline .pl-step').forEach((s, i) => s.classList.toggle('on', on[i]));
    $$('#pipeline .pl-link').forEach((l, k) => l.classList.toggle('on', on[k] && on[k + 1]));
    setBadge(on);
  }

  function startDeploy() {
    clearTimers('deploy');
    const on = renderDeploy();
    const steps = $$('#pipeline .pl-step'), links = $$('#pipeline .pl-link'), checks = $$('#checkRow .check');

    steps.forEach(s => s.classList.remove('on'));
    links.forEach(l => l.classList.remove('on'));
    checks.forEach(c => c.classList.remove('on'));
    $('#ctaBtn').classList.remove('armed');
    $('#deployStatus').dataset.state = 'building';
    $('#deployStatusText').textContent = 'BUILDING';

    /* light up only as far as the real state goes */
    let t = 700;
    on.forEach((lit, i) => {
      if (!lit) return;
      later('deploy', () => steps[i].classList.add('on'), t);
      if (i > 0 && on[i - 1]) later('deploy', () => links[i - 1].classList.add('on'), t - 300);
      t += 760;
    });

    V.get().deploy.forEach((d, i) => {
      if (d.done) later('deploy', () => checks[i] && checks[i].classList.add('on'), 1500 + i * 600);
    });

    later('deploy', () => setBadge(on), t + 300);
  }

  $('#urlField').addEventListener('change', e => V.actions.setProduct({ url: e.target.value.trim() }));
  $('#ctaBtn').addEventListener('click', () => {
    const u = V.get().product.url;
    if (!V.derived.isLive()) return;
    if (u) window.open(u, '_blank', 'noopener');
    else $('#urlField').focus();
  });

  /* ═══════════════ COMMAND PALETTE ═══════════════ */
  const scrim = $('#paletteScrim'), pInput = $('#paletteInput'), pResults = $('#paletteResults');
  let pItems = [], pSel = 0;

  function buildItems() {
    const s = V.get(), out = [];
    ORDER.forEach(p => out.push({ grp: 'Page', label: TITLES[p], hint: 'Go to ' + TITLES[p], run: () => go(p) }));
    V.NODES.forEach(n => out.push({
      grp: 'Node', label: n.label,
      hint: V.derived.noteCount(n.id) + ' notes · ' + V.derived.ideasFor(n.id).length + ' linked',
      run: () => openNode(n.id)
    }));
    s.ideas.forEach(i => out.push({
      grp: 'Idea', label: i.hook, hint: LABEL[i.status], run: () => focusIdea(i.id)
    }));
    out.push({ grp: 'Action', label: 'New idea', hint: 'Capture a hook', run: openComposer });
    s.deploy.forEach(d => out.push({
      grp: 'Action', label: (d.done ? 'Reopen ' : 'Complete ') + d.label,
      hint: 'Deploy', run: () => V.actions.toggleDeploy(d.id)
    }));
    return out;
  }

  function renderPalette() {
    const q = pInput.value.trim().toLowerCase();
    const all = buildItems();
    pItems = q ? all.filter(i => (i.label + ' ' + i.grp).toLowerCase().includes(q)) : all;
    pSel = 0;
    pResults.innerHTML = pItems.length
      ? pItems.map((i, k) => `
          <button class="pal-row ${k === 0 ? 'sel' : ''}" data-k="${k}">
            <span class="pal-grp mono">${i.grp}</span>
            <span class="pal-label">${esc(i.label)}</span>
            <span class="pal-hint mono">${esc(i.hint)}</span>
          </button>`).join('')
      : '<div class="pal-none">No matches</div>';
    $('#paletteCountLab').textContent = pItems.length + ' result' + (pItems.length === 1 ? '' : 's');
    $$('.pal-row', pResults).forEach(b =>
      b.addEventListener('click', () => runPalette(parseInt(b.dataset.k, 10))));
  }

  function movePalette(d) {
    if (!pItems.length) return;
    pSel = (pSel + d + pItems.length) % pItems.length;
    $$('.pal-row', pResults).forEach((b, k) => b.classList.toggle('sel', k === pSel));
    const el = $$('.pal-row', pResults)[pSel];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }
  function runPalette(k) {
    const it = pItems[k == null ? pSel : k];
    closePalette();
    if (it) setTimeout(it.run, 60);
  }
  function openPalette() {
    scrim.hidden = false; requestAnimationFrame(() => scrim.classList.add('in'));
    pInput.value = ''; renderPalette(); pInput.focus();
  }
  function closePalette() {
    scrim.classList.remove('in');
    setTimeout(() => { scrim.hidden = true; }, 200);
  }

  pInput.addEventListener('input', renderPalette);
  scrim.addEventListener('mousedown', e => { if (e.target === scrim) closePalette(); });
  $('#paletteCue').addEventListener('click', openPalette);

  /* ═══════════════ SHORTCUTS ═══════════════ */
  document.addEventListener('keydown', e => {
    const open = !scrim.hidden;

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault(); open ? closePalette() : openPalette(); return;
    }
    if (open) {
      if (e.key === 'Escape')    { e.preventDefault(); closePalette(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); movePalette(1); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); movePalette(-1); }
      if (e.key === 'Enter')     { e.preventDefault(); runPalette(); }
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key === 'Escape') {
      if (!composer.hidden) { closeComposer(); return; }
      closeNote(); return;
    }
    if (typing(e.target)) return;

    const i = ['1', '2', '3', '4'].indexOf(e.key);
    if (i > -1) {
      e.preventDefault();
      const btn = $$('.nav-item')[i];
      btn.classList.remove('keyed'); void btn.offsetWidth; btn.classList.add('keyed');
      setTimeout(() => btn.classList.remove('keyed'), 460);
      go(ORDER[i]); return;
    }
    if (e.key.toLowerCase() === 'n') { e.preventDefault(); openComposer(); }
  });

  /* ═══════════════ GLOBAL RENDER ═══════════════ */
  function renderChrome() {
    const s = V.get(), d = V.derived;
    $('#navCountContent').textContent = s.ideas.length;
    $('#navCountVault').textContent   = d.totalNotes();
    $('#navCountDeploy').textContent  = d.deployDone() + '/' + s.deploy.length;
    $('#brandName').textContent       = (s.product.name || 'ASSETVAULT').toUpperCase();

    const live = d.isLive();
    const pill = $('#stagePill');
    pill.dataset.state = live ? 'live' : 'building';
    $('#stageText').textContent = live ? 'LIVE' : 'BUILDING';
    $('#storageState').textContent = V.storageOK() ? 'SAVED LOCALLY' : 'SESSION ONLY';
  }

  function renderAll() {
    renderChrome();
    renderCommand();
    renderContent();
    if (built) renderGraphCounts();
    if (selected) renderPanel();
    if (current === 'deploy') paintDeploy(renderDeploy());
  }

  V.subscribe(() => { renderAll(); syncLog(); });

  /* ─────────── boot ─────────── */
  renderAll();
  go('command');
})();
