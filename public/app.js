?
'use strict';
const bgCanvas = document.getElementById('bg-canvas');
const bgCtx = bgCanvas.getContext('2d');

let blocks = [];
let bgBassLevel = 0;
let bgCol = { r: 0, g: 229, b: 255 };
let canvasBgMode = 'blocks';
let isLightMode = false;

// Gradient mesh blobs
const gradBlobs = [
  { x: 0.28, y: 0.40, vx: 0.00018, vy: 0.00024, r: 0.52, c: [124, 58, 237] },
  { x: 0.72, y: 0.28, vx: -0.00022, vy: 0.00019, r: 0.48, c: [0, 229, 255] },
  { x: 0.50, y: 0.75, vx: 0.00014, vy: -0.00021, r: 0.45, c: [236, 72, 153] },
  { x: 0.15, y: 0.60, vx: 0.00020, vy: 0.00016, r: 0.38, c: [251, 191, 36] },
];

// Mode configs
const BG_MODES = {
  blocks: { bodyBg: '#0a0b12', blockFill: [0, 229, 255], outline: false, opacity: [0.04, 0.12] },
  ivory: { bodyBg: '#f0eeeb', blockFill: [24, 24, 60], outline: false, opacity: [0.06, 0.14] },
  navy: { bodyBg: '#0a1628', blockFill: [255, 255, 255], outline: false, opacity: [0.05, 0.13] },
  midnight: { bodyBg: '#050810', blockFill: [0, 229, 255], outline: true, opacity: [0, 0.32] },
  gradient: { bodyBg: '#0a0b12', blockFill: null, outline: false, opacity: [0, 0] },
};

function resizeBgCanvas() {
  bgCanvas.width = window.innerWidth;
  bgCanvas.height = window.innerHeight;
}

function spawnBlock(randomY) {
  const sz = 5 + Math.random() * 18;
  blocks.push({
    x: Math.random() * bgCanvas.width,
    y: randomY ? Math.random() * bgCanvas.height : -sz * 2,
    sz,
    dx: (Math.random() - 0.35) * 0.45,
    dy: 0.38 + Math.random() * 1.0,
    rot: Math.random() * Math.PI * 2,
    rSpd: (Math.random() - 0.5) * 0.016,
    alpha: 0.04 + Math.random() * 0.11,
  });
}

function initBlocks() {
  resizeBgCanvas();
  blocks = [];
  const n = Math.ceil((bgCanvas.width * bgCanvas.height) / 13000);
  for (let i = 0; i < n; i++) spawnBlock(true);
}

function drawGradientMesh() {
  const w = bgCanvas.width, h = bgCanvas.height;
  bgCtx.fillStyle = '#070510';
  bgCtx.fillRect(0, 0, w, h);

  const boost = 1 + bgBassLevel * 0.5;
  gradBlobs.forEach(b => {
    b.x += b.vx * boost; b.y += b.vy * boost;
    if (b.x < -0.1 || b.x > 1.1) b.vx *= -1;
    if (b.y < -0.1 || b.y > 1.1) b.vy *= -1;
    const cx = b.x * w, cy = b.y * h;
    const rad = b.r * Math.max(w, h) * (1 + bgBassLevel * 0.18);
    const grad = bgCtx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    const [r, g, bl] = b.c;
    const intensity = 0.30 + bgBassLevel * 0.22;
    grad.addColorStop(0, `rgba(${r},${g},${bl},${intensity})`);
    grad.addColorStop(0.5, `rgba(${r},${g},${bl},${intensity * 0.4})`);
    grad.addColorStop(1, `rgba(${r},${g},${bl},0)`);
    bgCtx.fillStyle = grad;
    bgCtx.fillRect(0, 0, w, h);
  });
}

function drawBlocks(cfg) {
  const boost = 1 + bgBassLevel * 1.6;
  const [fr, fg, fb] = cfg.blockFill;
  const [aMin, aMax] = cfg.opacity;

  blocks.forEach(bl => {
    bl.x += bl.dx * boost;
    bl.y += bl.dy * boost;
    bl.rot += bl.rSpd * boost;

    if (bl.y > bgCanvas.height + bl.sz * 2) { bl.y = -bl.sz * 2; bl.x = Math.random() * bgCanvas.width; }
    if (bl.x > bgCanvas.width + bl.sz) bl.x = -bl.sz;
    if (bl.x < -bl.sz) bl.x = bgCanvas.width + bl.sz;

    const a = aMin + (aMax - aMin) * bl.alpha / 0.15 * (1 + bgBassLevel * 0.5);
    bgCtx.save();
    bgCtx.translate(bl.x, bl.y);
    bgCtx.rotate(bl.rot);

    if (cfg.outline) {
      bgCtx.strokeStyle = `rgba(${fr},${fg},${fb},${Math.min(a * 3, 0.65)})`;
      bgCtx.lineWidth = 1;
      bgCtx.shadowColor = `rgba(${fr},${fg},${fb},0.8)`;
      bgCtx.shadowBlur = 6 + bgBassLevel * 12;
      bgCtx.strokeRect(-bl.sz / 2, -bl.sz / 2, bl.sz, bl.sz);
      bgCtx.shadowBlur = 0;
    } else {
      bgCtx.fillStyle = `rgba(${fr},${fg},${fb},${a})`;
      bgCtx.strokeStyle = `rgba(${fr},${fg},${fb},${Math.min(a * 2.2, 0.5)})`;
      bgCtx.lineWidth = 0.6;
      bgCtx.fillRect(-bl.sz / 2, -bl.sz / 2, bl.sz, bl.sz);
      bgCtx.strokeRect(-bl.sz / 2, -bl.sz / 2, bl.sz, bl.sz);
    }
    bgCtx.restore();
  });

  if (Math.random() < 0.07 + bgBassLevel * 0.18) spawnBlock(false);
  if (blocks.length > 280) blocks.splice(0, 6);
}

function animateBlocks() {
  const w = bgCanvas.width, h = bgCanvas.height;

  if (canvasBgMode === 'gradient') {
    drawGradientMesh();
  } else {
    const cfg = BG_MODES[canvasBgMode] || BG_MODES.blocks;
    bgCtx.clearRect(0, 0, w, h);
    drawBlocks(cfg);
  }

  requestAnimationFrame(animateBlocks);
}

function setCanvasBg(mode) {
  canvasBgMode = mode;
  const cfg = BG_MODES[mode] || BG_MODES.blocks;
  document.body.style.background = cfg.bodyBg;
  if (cfg.blockFill) bgCol = { r: cfg.blockFill[0], g: cfg.blockFill[1], b: cfg.blockFill[2] };
}

function toggleLightMode() {
  isLightMode = !isLightMode;
  document.body.classList.toggle('light', isLightMode);
  const icon = document.getElementById('theme-toggle-icon');
  const label = document.getElementById('theme-toggle-label');
  if (isLightMode) {
    icon.textContent = '🌙';
    label.textContent = 'Dark Mode';
    if (canvasBgMode === 'blocks') {
      document.getElementById('bg-sel').value = 'ivory';
      setCanvasBg('ivory');
      applyBg('ivory');
    }
  } else {
    icon.textContent = '☀️';
    label.textContent = 'Light Mode';
    if (canvasBgMode === 'ivory') {
      document.getElementById('bg-sel').value = 'blocks';
      setCanvasBg('blocks');
      applyBg('blocks');
    }
    document.body.style.background = '';
  }
}

window.addEventListener('resize', () => {
  initBlocks();
  if (renderer) {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }
});

// ══════════════════════════════════════════════════
// 2. HISTORY (localStorage)
// ══════════════════════════════════════════════════
const HISTORY_KEY = 'wibei_history_v2';
const MAX_HISTORY = 30;

function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
  catch (_) { return []; }
}

function saveToHistory(entry) {
  const hist = getHistory().filter(h => h.query !== entry.query);
  hist.unshift({ ...entry, ts: Date.now() });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(hist.slice(0, MAX_HISTORY)));
  renderRecents();
  renderHistory();
}

function clearHistory() {
  if (!confirm('Clear all play history?')) return;
  localStorage.removeItem(HISTORY_KEY);
  renderRecents(); renderHistory();
  addLog('History cleared.', 'info');
}

function relTime(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function renderRecents() {
  const row = document.getElementById('recents-row');
  const hist = getHistory().slice(0, 10);

  if (!hist.length) {
    row.innerHTML = `<div class="no-recents"><span class="no-recents-icon">🎵</span>Search for a song above to get started. Recent plays show up here.</div>`;
    return;
  }

  row.innerHTML = hist.map(h => `
    <div class="recent-card" style="position:relative" onclick="playStream(${JSON.stringify(h.query)})">
      ${h.thumbnail
      ? `<img class="recent-thumb" src="${esc(h.thumbnail)}" alt="" loading="lazy">`
      : `<div class="recent-thumb-placeholder">🎵</div>`
    }
      <div class="recent-info">
        <div class="recent-title">${esc(h.title || h.query)}</div>
        <div class="recent-artist">${esc(h.artist || '')}</div>
      </div>
      <div class="recent-play-badge">▶</div>
    </div>
  `).join('');
}

function renderHistory() {
  const list = document.getElementById('history-list');
  const hist = getHistory();

  if (!hist.length) {
    list.innerHTML = `<div class="no-recents"><span class="no-recents-icon">🕐</span>Nothing in history yet. Play some songs!</div>`;
    return;
  }

  list.innerHTML = hist.map(h => `
    <div class="history-row">
      ${h.thumbnail
      ? `<img class="history-thumb" src="${esc(h.thumbnail)}" alt="" loading="lazy">`
      : `<div class="history-thumb-ph">🎵</div>`
    }
      <div class="history-meta">
        <div class="history-title">${esc(h.title || h.query)}</div>
        <div class="history-artist">${esc(h.artist || 'Unknown')}</div>
      </div>
      <div class="history-ts">${relTime(h.ts)}</div>
      <button class="history-play-btn" onclick="playStream(${JSON.stringify(h.query)})">▶ Play</button>
    </div>
  `).join('');
}

// ══════════════════════════════════════════════════
// 3. VIEW SWITCHING (sidebar)
// ══════════════════════════════════════════════════
function switchView(name, el) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');

  document.getElementById('home-view').style.display = name === 'home' ? 'block' : 'none';
  document.getElementById('history-view').style.display = name === 'history' ? 'block' : 'none';
  document.getElementById('logs-view').style.display = name === 'logs' ? 'block' : 'none';

  if (name === 'history') renderHistory();
}

// ══════════════════════════════════════════════════
// 4. LOGGER
// ══════════════════════════════════════════════════
function addLog(msg, level = 'info') {
  const t = new Date().toLocaleTimeString();
  const row = () => {
    const el = document.createElement('div');
    el.className = 'le';
    el.innerHTML = `<span class="lt">[${t}]</span><span class="ll ${level}">[${level.toUpperCase()}]</span><span class="lm">${esc(msg)}</span>`;
    return el;
  };
  ['logs-body', 'float-logs-body'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.appendChild(row());
    el.scrollTop = el.scrollHeight;
  });
}

function clearLogs() {
  ['logs-body', 'float-logs-body'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });
  addLog('Logs cleared.', 'info');
}

function setStatus(text, state = 'ready') {
  document.getElementById('status-text').innerText = text;
  const dot = document.getElementById('status-dot');
  dot.className = 'status-dot' + (state !== 'ready' ? ' ' + state : '');
}

function esc(t) {
  if (typeof t !== 'string') t = String(t || '');
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function initSSE() {
  try {
    const es = new EventSource('/api/logs-stream');
    es.onmessage = e => {
      try { const d = JSON.parse(e.data); addLog(d.message, d.level || 'info'); }
      catch (_) { addLog(e.data); }
    };
  } catch (_) { }
}

// ══════════════════════════════════════════════════
// 5. SEARCH SUGGESTIONS
// ══════════════════════════════════════════════════
const searchInp = document.getElementById('search-input');
const suggestDrop = document.getElementById('suggest-drop');
let suggestTimer, suggestIdx = -1, lastSuggestions = [];

searchInp.addEventListener('input', () => {
  clearTimeout(suggestTimer);
  const q = searchInp.value.trim();
  if (!q) { closeSuggest(); return; }
  suggestTimer = setTimeout(() => fetchSuggest(q), 180);
});

async function fetchSuggest(q) {
  try {
    const r = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`);
    lastSuggestions = await r.json();
    renderSuggest(lastSuggestions);
  } catch (_) { }
}

function renderSuggest(list) {
  if (!list.length) { closeSuggest(); return; }
  suggestDrop.innerHTML = list.map((s, i) =>
    `<div class="suggest-item" data-i="${i}" data-v="${esc(s)}">
      <span class="suggest-item-icon">🔍</span>${esc(s)}
    </div>`
  ).join('');
  suggestDrop.style.display = 'block';
  suggestIdx = -1;
  suggestDrop.querySelectorAll('.suggest-item').forEach(el => {
    el.addEventListener('mousedown', e => {
      e.preventDefault();
      searchInp.value = el.dataset.v;
      closeSuggest();
      playStream(el.dataset.v);
    });
  });
}

function closeSuggest() { suggestDrop.style.display = 'none'; suggestIdx = -1; }

searchInp.addEventListener('keydown', e => {
  const items = suggestDrop.querySelectorAll('.suggest-item');
  if (!items.length) {
    if (e.key === 'Enter') { closeSuggest(); playStream(searchInp.value.trim()); }
    return;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    suggestIdx = Math.min(suggestIdx + 1, items.length - 1);
    items.forEach((el, i) => el.classList.toggle('active', i === suggestIdx));
    searchInp.value = items[suggestIdx].dataset.v;
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    suggestIdx = Math.max(suggestIdx - 1, -1);
    items.forEach((el, i) => el.classList.toggle('active', i === suggestIdx));
  } else if (e.key === 'Enter') {
    closeSuggest(); playStream(searchInp.value.trim());
  } else if (e.key === 'Escape') {
    closeSuggest();
  }
});

document.addEventListener('click', e => {
  if (!e.target.closest('#search-row')) closeSuggest();
});

// ══════════════════════════════════════════════════
// 6. THREE.JS SCENE
// ══════════════════════════════════════════════════
let scene, camera, renderer;
let specBars = [], ringBars = [];
let waveGeo, wavePos, waveLine;
let prismMesh;
let gridBars = [];

const bgMeshes = {
  synthgrid: null, aurora: null, auroraGeo: null,
  beams: null, beamList: [], tunnel: null, tunnelRings: []
};

const THEMES = {
  cyan: { p: 0x00e5ff, s: 0x7c3aed, l: 0x00e5ff, c: [0, 229, 255] },
  neon: { p: 0xff2d9b, s: 0x00e5ff, l: 0xff2d9b, c: [255, 45, 155] },
  gold: { p: 0xfbbf24, s: 0xec4899, l: 0xfbbf24, c: [251, 191, 36] },
  white: { p: 0xffffff, s: 0x64748b, l: 0xffffff, c: [255, 255, 255] },
};

let currTheme = 'cyan', currVis = 'spectrum', currBg = 'blocks';

function initThree() {
  const container = document.getElementById('threejs-container');
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 2000);
  camera.position.set(0, 0, 75);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const dl = new THREE.DirectionalLight(0xffffff, 0.8);
  dl.position.set(0, 40, 50); scene.add(dl);
  const pl = new THREE.PointLight(0x00e5ff, 2.5, 200);
  pl.position.set(0, 0, 20); scene.add(pl);

  const mkMat = () => new THREE.MeshStandardMaterial({
    color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 0.5,
    roughness: 0.2, metalness: 0.8
  });

  // 1. Spectrum bars
  const specGrp = new THREE.Group();
  const bGeo = new THREE.BoxGeometry(0.7, 1, 0.7);
  for (let i = 0; i < 64; i++) {
    const m = new THREE.Mesh(bGeo, mkMat());
    m.position.set((i - 32) * 1.3, -12, 0);
    specGrp.add(m); specBars.push(m);
  }
  scene.add(specGrp);

  // 2. Ring
  const ringGrp = new THREE.Group();
  const rR = 19;
  const rGeo = new THREE.BoxGeometry(0.5, 1, 0.5);
  rGeo.translate(0, 0.5, 0);
  const baseGeo = new THREE.RingGeometry(rR - 0.12, rR + 0.12, 64);
  ringGrp.add(new THREE.Mesh(baseGeo, new THREE.MeshBasicMaterial({
    color: 0x00e5ff, side: THREE.DoubleSide, transparent: true, opacity: 0.5
  })));
  for (let i = 0; i < 128; i++) {
    const a = (i / 128) * Math.PI * 2;
    const m = new THREE.Mesh(rGeo, mkMat());
    m.position.set(Math.cos(a) * rR, Math.sin(a) * rR, 0);
    m.rotation.z = a - Math.PI / 2;
    ringGrp.add(m); ringBars.push(m);
  }
  ringGrp.visible = false; scene.add(ringGrp);

  // 3. Wave
  const wPts = 128;
  waveGeo = new THREE.BufferGeometry();
  wavePos = new Float32Array(wPts * 3);
  for (let i = 0; i < wPts; i++) { wavePos[i * 3] = (i - wPts / 2) * 0.85; }
  waveGeo.setAttribute('position', new THREE.BufferAttribute(wavePos, 3));
  waveLine = new THREE.Line(waveGeo, new THREE.LineBasicMaterial({ color: 0x00e5ff }));
  waveLine.visible = false; scene.add(waveLine);

  // 4. Prism
  const pGeo = new THREE.OctahedronGeometry(12, 0);
  const pMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x7c3aed, emissiveIntensity: 0.3, roughness: 0.1, metalness: 0.9 });
  prismMesh = new THREE.Mesh(pGeo, pMat);
  prismMesh.add(new THREE.LineSegments(new THREE.WireframeGeometry(pGeo), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 })));
  prismMesh.visible = false; scene.add(prismMesh);

  // 5. Grid
  const gridGrp = new THREE.Group();
  for (let i = 0; i < 128; i++) {
    const m = new THREE.Mesh(bGeo, mkMat());
    m.position.set((i % 16 - 8) * 3, -14, (Math.floor(i / 16) - 4) * 3);
    gridGrp.add(m); gridBars.push(m);
  }
  gridGrp.visible = false; scene.add(gridGrp);

  // Store top-level groups
  window._specGrp = specGrp;
  window._ringGrp = ringGrp;
  window._gridGrp = gridGrp;

  buildBgSynthGrid();
  buildBgAurora();
  buildBgBeams();
  buildBgTunnel();
}

function buildBgSynthGrid() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(undefined, undefined));
  g.add(new THREE.GridHelper(160, 40, 0x00e5ff, 0x1e293b));
  g.children[1].position.set(0, -18, 0);
  g.visible = false; scene.add(g);
  bgMeshes.synthgrid = g;
}
function buildBgAurora() {
  const geo = new THREE.PlaneGeometry(160, 100, 32, 20);
  bgMeshes.auroraGeo = geo;
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: 0x7c3aed, emissive: 0x00e5ff, emissiveIntensity: 0.3,
    wireframe: true, transparent: true, opacity: 0.3
  }));
  m.position.set(0, 10, -45);
  m.visible = false; scene.add(m);
  bgMeshes.aurora = m;
}
function buildBgBeams() {
  const g = new THREE.Group();
  const cGeo = new THREE.CylinderGeometry(0.25, 0.25, 90, 6);
  for (let i = 0; i < 22; i++) {
    const m = new THREE.Mesh(cGeo, new THREE.MeshBasicMaterial({
      color: i % 2 === 0 ? 0x00e5ff : 0x7c3aed,
      transparent: true, opacity: 0.18 + Math.random() * 0.24
    }));
    m.position.set((Math.random() - 0.5) * 140, (Math.random() - 0.5) * 40, -15 - Math.random() * 55);
    g.add(m); bgMeshes.beamList.push(m);
  }
  g.visible = false; scene.add(g);
  bgMeshes.beams = g;
}
function buildBgTunnel() {
  const g = new THREE.Group();
  for (let i = 0; i < 18; i++) {
    const rGeo = new THREE.RingGeometry(30 + i * 2, 30.6 + i * 2, 32);
    const m = new THREE.Mesh(rGeo, new THREE.MeshBasicMaterial({
      color: 0x00e5ff, side: THREE.DoubleSide,
      transparent: true, opacity: 0.1 + (i / 18) * 0.22
    }));
    m.position.z = -i * 14;
    g.add(m); bgMeshes.tunnelRings.push(m);
  }
  g.visible = false; scene.add(g);
  bgMeshes.tunnel = g;
}

// ══════════════════════════════════════════════════
// 7. AUDIO ENGINE + DSP
// ══════════════════════════════════════════════════
let audioCtx, analyser, dataArr, gainNode;
let audioSrc = null, curAudioEl = null;
let isPlaying = false;
let sBass = 0, sMid = 0, sTreble = 0;

// Beat detection state
const BEAT_WIN = 23, BEAT_THRESH = 1.35, BEAT_LOCK = 12;
let bassHist = new Array(BEAT_WIN).fill(0);
let beatLock = 0, beatPulse = 0;
let dropCount = 0;

function getRange(d, lo, hi) {
  let s = 0;
  for (let i = lo; i <= hi; i++) s += d[i];
  return s / (hi - lo + 1) / 255;
}

function runDSP() {
  if (!analyser) return;
  analyser.getByteFrequencyData(dataArr);
  const rb = getRange(dataArr, 0, 3);
  const rm = getRange(dataArr, 4, 22);
  const rt = getRange(dataArr, 23, 110);
  sBass += (rb - sBass) * 0.18;
  sMid += (rm - sMid) * 0.15;
  sTreble += (rt - sTreble) * 0.15;

  bassHist.push(rb);
  if (bassHist.length > BEAT_WIN) bassHist.shift();

  if (beatLock > 0) {
    beatLock--;
  } else {
    const avg = bassHist.reduce((a, b) => a + b, 0) / BEAT_WIN;
    if (rb > avg * BEAT_THRESH && rb > 0.28) {
      beatPulse = 1.0; beatLock = BEAT_LOCK;
      triggerBeat();
    }
  }
  beatPulse *= 0.84;

  if (getRange(dataArr, 0, 110) > 0.68) { dropCount++; }
  else if (dropCount > 0) dropCount = Math.max(0, dropCount - 2);

  bgBassLevel = sBass * 0.55 + beatPulse * 0.45;
}

function triggerBeat() {
  const th = THEMES[currTheme];
  const [r, g, b] = th.c;
  const fl = document.getElementById('beat-flash');
  fl.style.background = `radial-gradient(circle at center, rgba(${r},${g},${b},0.2) 0%, transparent 70%)`;
  fl.style.opacity = '1';
  setTimeout(() => fl.style.opacity = '0', 90);

  const ring = document.getElementById('beat-ring');
  ring.style.transform = 'scale(1.28)';
  ring.style.opacity = '1';
  setTimeout(() => { ring.style.transform = ''; ring.style.opacity = ''; }, 110);

  document.querySelectorAll('.beat-bar').forEach(b => {
    b.style.height = (8 + Math.random() * 30) + 'px';
    b.style.opacity = '1';
    setTimeout(() => { b.style.height = '4px'; b.style.opacity = '0.3'; }, 200);
  });
}

// ══════════════════════════════════════════════════
// 8. THREE.JS ANIMATE LOOP
// ══════════════════════════════════════════════════
function threeAnimate() {
  requestAnimationFrame(threeAnimate);
  if (!renderer) return;

  const t = performance.now() * 0.001;
  if (isPlaying && analyser) runDSP();

  const bV = isPlaying ? sBass : 0.08 + Math.sin(t) * 0.04;
  const mV = isPlaying ? sMid : 0.04;
  const bp = beatPulse;
  const pLight = scene.children.find(c => c.isPointLight);
  if (pLight) pLight.intensity = 2 + bV * 3.5 + bp * 3.2;

  // Background anims
  if (currBg === 'synthgrid' && bgMeshes.synthgrid) {
    bgMeshes.synthgrid.children[1].position.z = (t * 10 * (1 + bV * 0.5)) % 4;
  }
  if (currBg === 'aurora' && bgMeshes.auroraGeo) {
    const pos = bgMeshes.auroraGeo.attributes.position.array;
    for (let i = 0; i < pos.length / 3; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1];
      pos[i * 3 + 2] = Math.sin(x * 0.04 + t * 1.2) * 4 + Math.cos(y * 0.05 + t) * 3 * (1 + mV);
    }
    bgMeshes.auroraGeo.attributes.position.needsUpdate = true;
  }
  if (currBg === 'beams') bgMeshes.beamList.forEach((b, i) => {
    b.position.y += 0.2 + (i % 3) * 0.1 + bV * 0.3;
    if (b.position.y > 50) b.position.y = -50;
  });
  if (currBg === 'tunnel') bgMeshes.tunnelRings.forEach(r => {
    r.position.z += 0.34 + bV * 0.65 + bp * 1.4;
    if (r.position.z > 20) r.position.z = -240;
  });

  // Visualizers
  if (currVis === 'spectrum') {
    for (let i = 0; i < specBars.length; i++) {
      const sIdx = i < 32 ? (31 - i) * 2 : (i - 32) * 2;
      const raw = isPlaying && dataArr ? dataArr[sIdx] || 0 : 128 * (0.12 + Math.sin(i * 0.1 + t * 2) * 0.1);
      const tgt = Math.max(0.2, (raw / 255) * 26 * (1 + bp * 0.28));
      specBars[i].scale.y += (tgt - specBars[i].scale.y) * 0.22;
      specBars[i].position.y = -12 + specBars[i].scale.y * 0.5;
    }
  } else if (currVis === 'ring') {
    const half = ringBars.length / 2;
    for (let i = 0; i < ringBars.length; i++) {
      const bin = i < half ? Math.floor((i / half) * 64) : Math.floor(((ringBars.length - 1 - i) / half) * 64);
      const raw = isPlaying && dataArr ? dataArr[bin] || 0 : 128 * (0.1 + Math.sin(i * 0.08 + t * 2) * 0.08);
      const tgt = Math.max(0.25, 0.4 + (raw / 255) * 18 * (1 + bp * 0.38));
      ringBars[i].scale.y += (tgt - ringBars[i].scale.y) * 0.25;
    }
  } else if (currVis === 'wave') {
    const pos = waveGeo.attributes.position.array;
    for (let i = 0; i < pos.length / 3; i++) {
      const fi = Math.floor((i / (pos.length / 3)) * 64);
      const val = isPlaying && dataArr ? (dataArr[fi] || 0) / 255 : Math.abs(Math.sin(i * 0.1 + t * 2)) * 0.18;
      const tgt = Math.sin(i * 0.14 + t * 3) * (2 + val * 18 + bp * 5);
      pos[i * 3 + 1] += (tgt - pos[i * 3 + 1]) * 0.22;
    }
    waveGeo.attributes.position.needsUpdate = true;
  } else if (currVis === 'prism') {
    const sc = 1 + bV * 0.55 + bp * 0.22;
    prismMesh.scale.set(sc, sc, sc);
    prismMesh.rotation.y += 0.006 + mV * 0.012 + bp * 0.03;
    prismMesh.rotation.x = Math.sin(t) * 0.18;
  } else if (currVis === 'grid') {
    for (let i = 0; i < gridBars.length; i++) {
      const raw = isPlaying && dataArr ? dataArr[i % 64] || 0 : 128 * (0.1 + Math.sin(i * 0.15 + t * 1.5) * 0.1);
      const tgt = Math.max(0.2, (raw / 255) * 18 + bp * 4);
      gridBars[i].scale.y += (tgt - gridBars[i].scale.y) * 0.2;
      gridBars[i].position.y = -14 + gridBars[i].scale.y * 0.5;
    }
  }

  // Album art pulse
  const artImg = document.getElementById('art-img');
  if (artImg && isPlaying) {
    artImg.style.transform = `scale(${1 + bp * 0.07})`;
  }

  renderer.render(scene, camera);
}

// ══════════════════════════════════════════════════
// 9. THEME / VIS / BG SWITCHES
// ══════════════════════════════════════════════════
function applyTheme(name) {
  currTheme = name;
  const th = THEMES[name];
  bgCol = { r: th.c[0], g: th.c[1], b: th.c[2] };
  const hex = '#' + th.p.toString(16).padStart(6, '0');
  document.documentElement.style.setProperty('--accent', hex);
  document.documentElement.style.setProperty('--beat-color', hex);

  const pLight = scene.children.find(c => c.isPointLight);
  if (pLight) pLight.color.setHex(th.l);

  [...specBars, ...ringBars, ...gridBars].forEach(b => {
    b.material.color.setHex(th.p);
    b.material.emissive.setHex(th.p);
  });
  if (waveLine) waveLine.material.color.setHex(th.p);
  if (prismMesh) { prismMesh.material.color.setHex(th.p); prismMesh.material.emissive.setHex(th.s); }
  document.getElementById('beat-ring').style.borderColor = hex;
}

function applyVis(name) {
  currVis = name;
  window._specGrp.visible = (name === 'spectrum');
  window._ringGrp.visible = (name === 'ring');
  waveLine.visible = (name === 'wave');
  prismMesh.visible = (name === 'prism');
  window._gridGrp.visible = (name === 'grid');

  const ca = document.getElementById('center-art');
  if (ca.style.display !== 'none') ca.style.display = (name === 'ring') ? 'block' : 'none';
  if (name === 'grid') { camera.position.set(0, 18, 65); camera.lookAt(0, -5, 0); }
  else { camera.position.set(0, 0, 75); camera.lookAt(0, 0, 0); }
}

function applyBg(name) {
  currBg = name;

  // Canvas-based backgrounds
  const canvasModes = ['blocks', 'ivory', 'gradient', 'navy', 'midnight'];
  if (canvasModes.includes(name)) {
    setCanvasBg(name);
    bgMeshes.synthgrid.visible = false;
    bgMeshes.aurora.visible = false;
    bgMeshes.beams.visible = false;
    bgMeshes.tunnel.visible = false;
    return;
  }

  // Three.js backgrounds
  document.body.style.background = ''; // reset to CSS var
  bgMeshes.synthgrid.children[1].visible = (name === 'synthgrid');
  bgMeshes.synthgrid.visible = (name === 'synthgrid');
  bgMeshes.aurora.visible = (name === 'aurora');
  bgMeshes.beams.visible = (name === 'beams');
  bgMeshes.tunnel.visible = (name === 'tunnel');
}

// ══════════════════════════════════════════════════
// 10. ALBUM COLOR EXTRACTION
// ══════════════════════════════════════════════════
function extractAlbumColor(url) {
  if (!url) { document.getElementById('color-wash').style.opacity = '0'; return; }
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = 8; c.height = 8;
    const cx = c.getContext('2d');
    cx.drawImage(img, 0, 0, 8, 8);
    const d = cx.getImageData(0, 0, 8, 8).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 100) continue;
      r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
    }
    if (n) {
      r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
      const el = document.getElementById('color-wash');
      el.style.background = `radial-gradient(ellipse at center, rgba(${r},${g},${b},0.16) 0%, rgba(${r},${g},${b},0.05) 55%, transparent 80%)`;
      el.style.opacity = '1';
      if (canvasBgMode === 'blocks' || canvasBgMode === 'gradient') {
        bgCol = { r: Math.min(r + 70, 255), g: Math.min(g + 70, 255), b: Math.min(b + 70, 255) };
      }
    }
  };
  img.onerror = () => { };
  img.src = url;
}

// ══════════════════════════════════════════════════
// 11. SCREEN TRANSITIONS
// ══════════════════════════════════════════════════
function showViz(meta) {
  const hs = document.getElementById('home-screen');
  const vs = document.getElementById('viz-screen');
  const pb = document.getElementById('player-bar');
  const bi = document.getElementById('beat-indicator');
  const ca = document.getElementById('center-art');

  hs.style.opacity = '0';
  hs.style.transform = 'scale(1.03)';
  hs.style.pointerEvents = 'none';

  setTimeout(() => {
    hs.style.display = 'none';
    vs.style.display = 'block';
    pb.style.display = 'block';
    bi.style.display = 'flex';
    if (currVis === 'ring') ca.style.display = 'block';
  }, 380);

  if (meta) {
    document.getElementById('p-title').innerText = meta.title || '—';
    document.getElementById('p-artist').innerText = meta.uploader || '—';

    const thumb = document.getElementById('p-thumb');
    const artImg = document.getElementById('art-img');
    if (meta.thumbnail) {
      thumb.src = meta.thumbnail; thumb.style.display = 'block';
      artImg.src = meta.thumbnail;
      extractAlbumColor(meta.thumbnail);
    } else {
      thumb.style.display = 'none';
      document.getElementById('color-wash').style.opacity = '0';
    }
  }
}

function showHome() {
  const hs = document.getElementById('home-screen');
  const vs = document.getElementById('viz-screen');

  if (curAudioEl) { curAudioEl.pause(); curAudioEl.src = ''; curAudioEl = null; }
  else if (audioSrc) { try { audioSrc.stop?.(); audioSrc.disconnect?.(); } catch (_) { } audioSrc = null; }
  isPlaying = false; sBass = 0; sMid = 0; sTreble = 0; beatPulse = 0; bgBassLevel = 0;

  document.getElementById('play-btn').innerText = '▶';
  document.getElementById('player-bar').style.display = 'none';
  document.getElementById('beat-indicator').style.display = 'none';
  document.getElementById('center-art').style.display = 'none';
  document.getElementById('float-logs').style.display = 'none';
  document.getElementById('color-wash').style.opacity = '0';

  vs.style.display = 'none';
  hs.style.display = 'flex';
  setTimeout(() => {
    hs.style.opacity = '1'; hs.style.transform = '';
    hs.style.pointerEvents = 'auto';
    setStatus('Ready');
    addLog('Returned to home.', 'info');
  }, 50);
}

// ══════════════════════════════════════════════════
// 12. AUDIO SETUP
// ══════════════════════════════════════════════════
function ensureAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    gainNode = audioCtx.createGain();
    gainNode.connect(audioCtx.destination);
    addLog(`AudioContext ready at ${audioCtx.sampleRate}Hz`, 'ok');
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function setupAnalyser(source) {
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.82;
  dataArr = new Uint8Array(analyser.frequencyBinCount);
  source.connect(analyser);
  analyser.connect(gainNode);
}

// ══════════════════════════════════════════════════
// 13. PLAY STREAM
// ══════════════════════════════════════════════════
async function playStream(query) {
  if (!query || !query.trim()) return;
  query = query.trim();
  setStatus('Fetching…', 'loading');
  addLog(`Loading: "${query}"`, 'process');
  document.getElementById('play-btn').innerText = '⏳';
  document.getElementById('p-title').innerText = 'Loading…';

  try {
    const metaRes = await fetch(`/metadata?url=${encodeURIComponent(query)}`);
    if (!metaRes.ok) throw new Error(`HTTP ${metaRes.status}`);
    const meta = await metaRes.json();

    addLog(`Got: "${meta.title}"`, 'ok');
    setStatus(`Streaming…`, 'loading');
    showViz(meta);

    // Save to history
    saveToHistory({ query, title: meta.title, artist: meta.uploader, thumbnail: meta.thumbnail });

    if (curAudioEl) { curAudioEl.pause(); curAudioEl.src = ''; }

    const el = new Audio();
    el.crossOrigin = 'anonymous';
    el.src = `/stream?url=${encodeURIComponent(query)}`;
    curAudioEl = el;

    el.oncanplay = () => {
      ensureAudioCtx();
      if (audioSrc) { try { audioSrc.disconnect?.(); } catch (_) { } }
      audioSrc = audioCtx.createMediaElementSource(el);
      setupAnalyser(audioSrc);
      el.play().catch(e => addLog('Autoplay blocked: ' + e.message, 'warn'));
      isPlaying = true;
      document.getElementById('play-btn').innerText = '⏸';
      setStatus('Playing');
      addLog('Stream active — DSP running.', 'ok');
    };

    el.ontimeupdate = () => updateProgress(el);
    el.onerror = () => { addLog('Stream error.', 'error'); setStatus('Error', 'error'); };

  } catch (err) {
    addLog(`Error: ${err.message}`, 'error');
    setStatus('Failed', 'error');
    document.getElementById('play-btn').innerText = '▶';
  }
}

// ══════════════════════════════════════════════════
// 14. MIC + FILE
// ══════════════════════════════════════════════════
async function startMic() {
  addLog('Requesting microphone…', 'process');
  setStatus('Connecting mic…', 'loading');
  ensureAudioCtx();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.82;
    dataArr = new Uint8Array(analyser.frequencyBinCount);
    audioSrc = audioCtx.createMediaStreamSource(stream);
    audioSrc.connect(analyser);
    isPlaying = true; curAudioEl = null;
    addLog('Mic active.', 'ok'); setStatus('Mic live');
    showViz({ title: 'Microphone', uploader: 'Live Input' });
  } catch (e) {
    addLog('Mic denied: ' + e.message, 'error');
    setStatus('Mic denied', 'error');
  }
}

function startFile(file) {
  addLog(`File: "${file.name}"`, 'process');
  ensureAudioCtx();
  const reader = new FileReader();
  reader.onload = e => {
    audioCtx.decodeAudioData(e.target.result, buf => {
      if (audioSrc) { try { audioSrc.stop?.(); audioSrc.disconnect?.(); } catch (_) { } }
      audioSrc = audioCtx.createBufferSource();
      audioSrc.buffer = buf;
      setupAnalyser(audioSrc);
      audioSrc.start(0);
      isPlaying = true; curAudioEl = null;
      addLog(`Decoded ${buf.duration.toFixed(1)}s audio.`, 'ok');
      setStatus('Playing');
      showViz({ title: file.name.replace(/\.[^.]+$/, ''), uploader: 'Local File' });
    }, () => { addLog('Decode failed.', 'error'); setStatus('Error', 'error'); });
  };
  reader.readAsArrayBuffer(file);
}

// ══════════════════════════════════════════════════
// 15. PROGRESS BAR
// ══════════════════════════════════════════════════
function fmt(s) {
  s = Math.floor(s || 0);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function updateProgress(el) {
  if (!el.duration) return;
  const p = el.currentTime / el.duration;
  document.getElementById('prog-fill').style.width = (p * 100) + '%';
  document.getElementById('t-cur').innerText = fmt(el.currentTime);
  document.getElementById('t-dur').innerText = fmt(el.duration);
}
document.getElementById('prog-track').addEventListener('click', e => {
  if (!curAudioEl || !curAudioEl.duration) return;
  const r = e.currentTarget.getBoundingClientRect();
  curAudioEl.currentTime = ((e.clientX - r.left) / r.width) * curAudioEl.duration;
});

// ══════════════════════════════════════════════════
// 16. EVENT LISTENERS
// ══════════════════════════════════════════════════
document.getElementById('search-go').addEventListener('click', () => {
  const v = searchInp.value.trim(); if (v) { closeSuggest(); playStream(v); }
});
document.getElementById('url-btn').addEventListener('click', () => {
  const v = document.getElementById('url-inp').value.trim(); if (v) playStream(v);
});
document.getElementById('url-inp').addEventListener('keypress', e => {
  if (e.key === 'Enter') { const v = e.target.value.trim(); if (v) playStream(v); }
});
document.getElementById('file-inp').addEventListener('change', e => {
  if (e.target.files[0]) startFile(e.target.files[0]);
});
document.getElementById('back-btn').addEventListener('click', showHome);
document.getElementById('play-btn').addEventListener('click', () => {
  if (!curAudioEl) return;
  if (curAudioEl.paused) { curAudioEl.play(); isPlaying = true; document.getElementById('play-btn').innerText = '⏸'; }
  else { curAudioEl.pause(); isPlaying = false; document.getElementById('play-btn').innerText = '▶'; }
});
document.getElementById('vol-range').addEventListener('input', e => {
  if (gainNode) gainNode.gain.value = parseFloat(e.target.value);
});
document.getElementById('ps-btn').addEventListener('click', () => {
  const v = document.getElementById('ps-inp').value.trim(); if (v) playStream(v);
});
document.getElementById('ps-inp').addEventListener('keypress', e => {
  if (e.key === 'Enter') { const v = e.target.value.trim(); if (v) playStream(v); }
});
document.getElementById('vis-sel').addEventListener('change', e => applyVis(e.target.value));
document.getElementById('bg-sel').addEventListener('change', e => applyBg(e.target.value));
document.getElementById('theme-sel').addEventListener('change', e => applyTheme(e.target.value));
document.getElementById('logs-toggle').addEventListener('click', () => {
  const fl = document.getElementById('float-logs');
  fl.style.display = fl.style.display === 'block' ? 'none' : 'block';
});
document.getElementById('float-close').addEventListener('click', () => {
  document.getElementById('float-logs').style.display = 'none';
});

// Prevent canvas events leaking through UI
['#player-bar', '#top-bar', '#float-logs', '#home-screen'].forEach(sel => {
  document.querySelectorAll(sel).forEach(el => {
    el.addEventListener('mousedown', e => e.stopPropagation());
    el.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
  });
});

// ══════════════════════════════════════════════════
// 17. BOOT
// ══════════════════════════════════════════════════
initBlocks();
animateBlocks();
initThree();
applyVis('spectrum');
applyBg('blocks');
initSSE();
renderRecents();

addLog('Wibei ready. Search, paste a link, or use the sidebar.', 'ok');
setStatus('Ready');
