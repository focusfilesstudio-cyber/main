/* ══════════════════════════════════════════════
   AssetVault OS — single source of truth.
   Every screen reads from here; nothing holds its own copy.
   Persists to localStorage, falls back to memory if unavailable
   (Safari blocks storage on file:// origins).
   ══════════════════════════════════════════════ */
(function (global) {
  'use strict';

  const KEY = 'assetvault.os.v1';

  /* ─────────── the vault skeleton: fixed nodes, user-owned notes ─────────── */
  const NODES = [
    { id: 'product',      label: 'Product',      kind: 'CORE',      x: 450, y: 310, r: 26, hub: true, tags: ['hub','asset'] },
    { id: 'audience',     label: 'Audience',     kind: 'INPUT',     x: 234, y: 231, r: 20, tags: ['research'] },
    { id: 'research',     label: 'Research',     kind: 'INPUT',     x: 371, y:  94, r: 18, tags: ['market'] },
    { id: 'offer',        label: 'Offer',        kind: 'STRUCTURE', x: 565, y: 111, r: 20, tags: ['scope'] },
    { id: 'sales',        label: 'Sales',        kind: 'SURFACE',   x: 676, y: 270, r: 18, tags: ['storefront'] },
    { id: 'distribution', label: 'Distribution', kind: 'CHANNEL',   x: 626, y: 458, r: 21, tags: ['reach'] },
    { id: 'content',      label: 'Content',      kind: 'OUTPUT',    x: 450, y: 540, r: 20, tags: ['pipeline'] },
    { id: 'hooks',        label: 'Hooks',        kind: 'OUTPUT',    x: 262, y: 442, r: 19, tags: ['angles'] }
  ];

  const EDGES = [
    ['audience','research'], ['audience','hooks'], ['audience','product'],
    ['research','offer'],    ['research','hooks'],
    ['offer','product'],     ['offer','sales'],
    ['hooks','content'],
    ['content','product'],   ['content','distribution'], ['content','sales'],
    ['distribution','product'], ['distribution','sales']
  ];

  const uid = () => Math.random().toString(36).slice(2, 9);

  function seed() {
    return {
      product: { name: 'AssetVault', url: '' },
      notes: {
        product: [
          { id: uid(), text: 'The packaged form of everything upstream — research, hooks and offer collapsed into one deliverable.' },
          { id: uid(), text: 'Structure: 6 modules, one worksheet per module, one template vault.' }
        ],
        audience:     [{ id: uid(), text: 'Written as one sentence before anything else gets made. Pulled from recurring questions, not assumptions.' }],
        research:     [{ id: uid(), text: 'Raw capture layer. Nothing structured yet — that is deliberate.' }],
        offer:        [{ id: uid(), text: 'The promise, the scope, and the boundary of what this does not cover.' }],
        hooks:        [{ id: uid(), text: 'Angle library. One line per idea, no drafts stored here.' }],
        content:      [{ id: uid(), text: 'Where hooks become scripts and scripts become recorded assets.' }],
        distribution: [{ id: uid(), text: 'Channel map and cadence. One asset, several cuts.' }],
        sales:        [{ id: uid(), text: 'Mirrors the Offer node word for word — no new promises here.' }]
      },
      ideas: [
        { id: uid(), hook: 'Stop selling your hours. Build an asset instead.',        format: 'Talking head · 22s',    status: 'ready',    node: 'hooks'   },
        { id: uid(), hook: 'Your knowledge is worth more packaged than explained.',   format: 'B-roll + caption · 18s', status: 'drafting', node: 'offer'   },
        { id: uid(), hook: 'Claude + Obsidian = your unfair advantage.',              format: 'Screen capture · 30s',   status: 'queued',   node: 'content' }
      ],
      deploy: [
        { id: uid(), label: 'Landing page', done: true,  node: 'sales'        },
        { id: uid(), label: 'Product',      done: true,  node: 'product'      },
        { id: uid(), label: 'Checkout',     done: true,  node: 'sales'        },
        { id: uid(), label: 'Content',      done: false, node: 'distribution' }
      ],
      log: (function () {
        const t = Date.now();
        return [
          { id: uid(), t: t,           text: 'Vault ready · 8 nodes, 13 links', kind: 'ok'   },
          { id: uid(), t: t -  4000,   text: 'Deploy checklist loaded',         kind: 'info' },
          { id: uid(), t: t -  9000,   text: 'Content pipeline restored',       kind: 'info' },
          { id: uid(), t: t - 15000,   text: 'Notes index rebuilt',             kind: 'info' },
          { id: uid(), t: t - 21000,   text: 'Local store mounted',             kind: 'info' }
        ];
      })()
    };
  }

  /* ─────────── persistence (never throws) ─────────── */
  let memoryOnly = false;
  let state;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { memoryOnly = true; }
    return seed();
  }

  function persist() {
    if (memoryOnly) return;
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { memoryOnly = true; }
  }

  state = load();

  /* ─────────── subscription ─────────── */
  const subs = [];
  const notify = () => subs.forEach(fn => fn(state));

  function commit(mutator, logEntry) {
    mutator(state);
    if (logEntry) {
      state.log.unshift({ id: uid(), t: Date.now(), text: logEntry.text, kind: logEntry.kind || 'info' });
      state.log = state.log.slice(0, 40);
    }
    persist();
    notify();
  }

  /* ─────────── derived values: every screen's numbers come from here ─────────── */
  const STATUSES = ['queued', 'drafting', 'ready'];

  const derived = {
    noteCount:  id => (state.notes[id] || []).length,
    totalNotes: () => Object.keys(state.notes).reduce((n, k) => n + state.notes[k].length, 0),
    ideasFor:   id => state.ideas.filter(i => i.node === id),
    deployFor:  id => state.deploy.filter(d => d.node === id),
    ready:      () => state.ideas.filter(i => i.status === 'ready').length,

    /* a node is "active" once anything is attached to it */
    activeSystems: () => NODES.filter(n =>
      derived.noteCount(n.id) > 0 || derived.ideasFor(n.id).length > 0
    ).length,

    deployDone: () => state.deploy.filter(d => d.done).length,
    isLive:     () => state.deploy.length > 0 && state.deploy.every(d => d.done),

    /* the four command-centre workflow rows, each a real fraction */
    workflow: () => {
      const notesIn = ids => ids.reduce((n, id) => n + derived.noteCount(id), 0);
      const ideas   = state.ideas.length;
      return [
        { key: 'research',  name: 'Research market',      page: 'vault',   have: notesIn(['research','audience']),   need: 4, unit: 'notes' },
        { key: 'structure', name: 'Structure knowledge',  page: 'vault',   have: notesIn(['offer','hooks','product']), need: 5, unit: 'notes' },
        { key: 'build',     name: 'Build product',        page: 'deploy',  have: derived.deployDone(),               need: state.deploy.length || 1, unit: 'steps' },
        { key: 'distribute',name: 'Distribute content',   page: 'content', have: derived.ready(),                    need: Math.max(ideas, 1), unit: 'ready' }
      ];
    }
  };

  /* ─────────── actions ─────────── */
  const actions = {
    addIdea(hook, format, node) {
      const id = uid();
      commit(s => s.ideas.unshift({ id, hook, format: format || 'Unassigned', status: 'queued', node: node || 'hooks' }),
             { text: 'Idea captured · ' + hook.slice(0, 34) + (hook.length > 34 ? '…' : '') });
      return id;
    },
    cycleStatus(id) {
      let to = '';
      commit(s => {
        const i = s.ideas.find(x => x.id === id); if (!i) return;
        i.status = STATUSES[(STATUSES.indexOf(i.status) + 1) % STATUSES.length];
        to = i.status;
      }, null);
      const i = state.ideas.find(x => x.id === id);
      if (i) commit(() => {}, { text: 'Status → ' + to.toUpperCase() + ' · ' + i.hook.slice(0, 26) + '…', kind: to === 'ready' ? 'ok' : 'info' });
      return to;
    },
    removeIdea(id) {
      const i = state.ideas.find(x => x.id === id);
      commit(s => { s.ideas = s.ideas.filter(x => x.id !== id); },
             { text: 'Idea removed · ' + (i ? i.hook.slice(0, 26) + '…' : ''), kind: 'warn' });
    },
    relinkIdea(id, node) {
      commit(s => { const i = s.ideas.find(x => x.id === id); if (i) i.node = node; },
             { text: 'Idea relinked → ' + node });
    },
    addNote(nodeId, text) {
      commit(s => { (s.notes[nodeId] = s.notes[nodeId] || []).push({ id: uid(), text }); },
             { text: 'Note added → ' + nodeId });
    },
    removeNote(nodeId, noteId) {
      commit(s => { s.notes[nodeId] = (s.notes[nodeId] || []).filter(n => n.id !== noteId); },
             { text: 'Note removed → ' + nodeId, kind: 'warn' });
    },
    toggleDeploy(id) {
      let label = '', done = false;
      commit(s => {
        const d = s.deploy.find(x => x.id === id); if (!d) return;
        d.done = !d.done; label = d.label; done = d.done;
      }, null);
      commit(() => {}, { text: label + (done ? ' · complete' : ' · reopened'), kind: done ? 'ok' : 'warn' });
    },
    setProduct(patch) {
      commit(s => Object.assign(s.product, patch), { text: 'Product details updated' });
    },
    reset() {
      state = seed(); persist(); notify();
    }
  };

  global.Vault = {
    NODES, EDGES, STATUSES,
    get: () => state,
    node: id => NODES.find(n => n.id === id),
    subscribe: fn => { subs.push(fn); return () => subs.splice(subs.indexOf(fn), 1); },
    derived, actions,
    storageOK: () => !memoryOnly
  };
})(window);
