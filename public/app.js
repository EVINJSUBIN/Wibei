const bgCanvas = document.getElementById('bg-canvas');
const bgCtx = bgCanvas.getContext('2d');

let audioCtx, analyser, dataArr, audioSrc, curAudioEl;
let isPlaying = false;
let isMicActive = false;
let micStream = null;
let scene, camera, renderer, composer, bloomPass;
let visualizerRoot;
let pulseGrp, waveGrp, vgridGrp;
let pulseBars = [], waveBars = [], vgridBars = [];

const THEMES = {
    gold:    { accent: '#facc15', glow: 'rgba(250, 204, 21, 0.28)',  color: 0xfacc15 },
    cyan:    { accent: '#22d3ee', glow: 'rgba(34,  211, 238, 0.28)', color: 0x22d3ee },
    magenta: { accent: '#fb7185', glow: 'rgba(251, 113, 133, 0.28)', color: 0xfb7185 },
};
let currentTheme = 'gold';
let currentVis   = 'pulse';
let bgBassLevel  = 0;
let queue        = [];

let mouseX = 0, mouseY = 0;
let targetRotX = 0, targetRotY = 0;
let isDragging = false;
let prevMouse = { x: 0, y: 0 };

// ---------- DOM refs ----------
const playBtn      = document.getElementById('play-btn');
const iconPlay     = document.querySelector('.icon-play');
const iconPause    = document.querySelector('.icon-pause');
const seekSlider   = document.getElementById('seek-slider');
const progressFill = document.getElementById('progress-fill');
const timeCurrent  = document.getElementById('time-current');
const timeTotal    = document.getElementById('time-total');
const volSlider    = document.getElementById('vol-slider');
const muteBtn      = document.getElementById('mute-btn');
const searchInp    = document.getElementById('search-inp');
const searchBtn    = document.getElementById('search-btn');
const suggBox      = document.getElementById('suggestions-box');
const albumArt     = document.getElementById('album-art');
const trackTitle   = document.getElementById('track-title');
const trackArtist  = document.getElementById('track-artist');
const miniEq       = document.getElementById('mini-eq');

// ---------- Toast ----------
let toastTimer;
function showToast(msg, duration = 5500) {
    const el  = document.getElementById('toast-banner');
    const msg_el = document.getElementById('toast-msg');
    if (!el || !msg_el) return;
    msg_el.innerText = msg;
    el.style.display = 'flex';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.style.display = 'none'; }, duration);
}
document.getElementById('toast-close-btn')?.addEventListener('click', () => {
    document.getElementById('toast-banner').style.display = 'none';
});

// ---------- Play state helpers ----------
function updatePlayIcons(playing) {
    isPlaying = playing;
    if (iconPlay && iconPause) {
        iconPlay.style.display  = playing ? 'none'  : 'block';
        iconPause.style.display = playing ? 'block' : 'none';
    }
    if (miniEq) miniEq.style.display = playing ? 'flex' : 'none';
}

function updateTrackInfo(title, artist, thumb) {
    if (trackTitle)  trackTitle.innerText  = title;
    if (trackArtist) trackArtist.innerText = artist;
    if (albumArt)    albumArt.src = thumb || 'favicon.svg';
}

// ---------- Background animation ----------
let currentBg     = 'dots';   // 'dots' | 'rings' | 'off'
let particles     = [];
let rings         = [];
let ringSpawnTimer = 0;

function resizeCanvas() {
    bgCanvas.width  = window.innerWidth;
    bgCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function spawnParticle(randomY) {
    particles.push({
        x:     Math.random() * bgCanvas.width,
        y:     randomY ? Math.random() * bgCanvas.height : bgCanvas.height + 4,
        r:     0.8 + Math.random() * 1.6,
        speed: 0.18 + Math.random() * 0.32,
        drift: (Math.random() - 0.5) * 0.25,
        alpha: 0.06 + Math.random() * 0.14,
    });
}
for (let i = 0; i < 110; i++) spawnParticle(true);

function spawnRing() {
    const cx = bgCanvas.width  / 2 + (Math.random() - 0.5) * 80;
    const cy = bgCanvas.height / 2 + (Math.random() - 0.5) * 60;
    rings.push({ cx, cy, r: 0, alpha: 0.22 });
}
spawnRing();

function drawDotsFrame() {
    const th    = THEMES[currentTheme];
    const boost = 1 + bgBassLevel * 1.6;
    particles.forEach(p => {
        p.y -= p.speed * boost;
        p.x += p.drift;
        if (p.y < -4) { p.y = bgCanvas.height + 4; p.x = Math.random() * bgCanvas.width; }
        if (p.x < -4 || p.x > bgCanvas.width + 4) p.x = Math.random() * bgCanvas.width;
        bgCtx.beginPath();
        bgCtx.arc(p.x, p.y, p.r * (1 + bgBassLevel * 0.5), 0, Math.PI * 2);
        bgCtx.fillStyle   = th.accent;
        bgCtx.globalAlpha = p.alpha * (1 + bgBassLevel * 0.6);
        bgCtx.fill();
    });
}

function drawRingsFrame() {
    const th          = THEMES[currentTheme];
    const expandSpeed = 0.55 + bgBassLevel * 2.2;
    const spawnEvery  = Math.max(600, 1800 - bgBassLevel * 1200);

    ringSpawnTimer += 16;
    if (ringSpawnTimer >= spawnEvery) {
        spawnRing();
        ringSpawnTimer = 0;
    }

    bgCtx.strokeStyle = th.accent;
    rings = rings.filter(r => r.alpha > 0.003);
    rings.forEach(ring => {
        ring.r    += expandSpeed;
        ring.alpha = Math.max(0, ring.alpha - 0.0008 - bgBassLevel * 0.003);
        bgCtx.beginPath();
        bgCtx.arc(ring.cx, ring.cy, ring.r, 0, Math.PI * 2);
        bgCtx.lineWidth   = 1.2 + bgBassLevel * 1.5;
        bgCtx.globalAlpha = ring.alpha;
        bgCtx.stroke();
    });
}

function animateBg() {
    requestAnimationFrame(animateBg);
    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    bgCtx.globalAlpha = 1;
    if      (currentBg === 'dots')  drawDotsFrame();
    else if (currentBg === 'rings') drawRingsFrame();
    bgCtx.globalAlpha = 1;
}
animateBg();

// ---------- Three.js ----------
function initThree() {
    const container = document.getElementById('threejs-container');
    scene  = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);
    camera.position.set(0, 8, 62);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const renderScene = new THREE.RenderPass(scene, camera);
    bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0.08;
    bloomPass.strength  = 1.35;
    bloomPass.radius    = 0.55;

    composer = new THREE.EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const pointLight = new THREE.PointLight(THEMES[currentTheme].color, 2.5, 120);
    pointLight.position.set(0, 0, 20);
    scene.add(pointLight);

    visualizerRoot = new THREE.Group();
    scene.add(visualizerRoot);

    const bGeo = new THREE.BoxGeometry(0.5, 1, 0.5);
    bGeo.translate(0, 0.5, 0);

    function makeMat() {
        return new THREE.MeshStandardMaterial({
            color:            THEMES[currentTheme].color,
            emissive:         THEMES[currentTheme].color,
            emissiveIntensity: 0.85,
            roughness:        0.2,
            metalness:        0.8,
        });
    }

    // Pulse ring
    pulseGrp = new THREE.Group();
    const ringCount = 128, ringR = 22;
    for (let i = 0; i < ringCount; i++) {
        const m = new THREE.Mesh(bGeo, makeMat());
        const a = (i / ringCount) * Math.PI * 2;
        m.position.set(Math.cos(a) * ringR, Math.sin(a) * ringR, 0);
        m.rotation.z = a - Math.PI / 2;
        pulseGrp.add(m);
        pulseBars.push(m);
    }
    visualizerRoot.add(pulseGrp);

    // Wave
    waveGrp = new THREE.Group();
    const waveN = 64;
    for (let i = 0; i < waveN; i++) {
        const m = new THREE.Mesh(bGeo, makeMat());
        m.position.set((i - waveN / 2) * 1.25, -5, 0);
        waveGrp.add(m);
        waveBars.push(m);
    }
    waveGrp.visible = false;
    visualizerRoot.add(waveGrp);

    // Grid
    vgridGrp = new THREE.Group();
    const gCols = 16, gRows = 8;
    for (let i = 0; i < gCols * gRows; i++) {
        const m = new THREE.Mesh(bGeo, makeMat());
        const x = (i % gCols) - gCols / 2;
        const z = Math.floor(i / gCols) - gRows / 2;
        m.position.set(x * 2.5, -10, z * 2.5);
        vgridGrp.add(m);
        vgridBars.push(m);
    }
    vgridGrp.visible = false;
    visualizerRoot.add(vgridGrp);

    // Mouse / drag
    window.addEventListener('mousemove', e => {
        mouseX = (e.clientX / innerWidth) * 2 - 1;
        mouseY = -(e.clientY / innerHeight) * 2 + 1;
        if (isDragging) {
            targetRotY += (e.clientX - prevMouse.x) * 0.006;
            targetRotX += (e.clientY - prevMouse.y) * 0.006;
            prevMouse = { x: e.clientX, y: e.clientY };
        }
    });

    const isUI = el => el.closest('.top-bar, .side-card, .player, .overlay, .toast');

    window.addEventListener('mousedown', e => {
        if (!isUI(e.target)) {
            isDragging = true;
            prevMouse  = { x: e.clientX, y: e.clientY };
        }
    });
    window.addEventListener('mouseup', () => { isDragging = false; });

    window.addEventListener('resize', () => {
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight);
        composer.setSize(innerWidth, innerHeight);
    });

    threeAnimate();
}

function threeAnimate() {
    requestAnimationFrame(threeAnimate);
    const time = performance.now() * 0.001;

    // Camera lerp
    if (visualizerRoot) {
        visualizerRoot.rotation.y += (targetRotY + mouseX * 0.15 - visualizerRoot.rotation.y) * 0.08;
        visualizerRoot.rotation.x += (targetRotX - mouseY * 0.15 - visualizerRoot.rotation.x) * 0.08;
    }

    let hasAudio = false, totalEnergy = 0;
    if ((isPlaying || isMicActive) && analyser && dataArr) {
        analyser.getByteFrequencyData(dataArr);
        for (let v of dataArr) totalEnergy += v;
        if (totalEnergy > 100) hasAudio = true;
    }

    if (hasAudio) {
        let bassSum = 0;
        for (let i = 0; i < 8; i++) bassSum += dataArr[i];
        bgBassLevel = (bassSum / 8) / 255;

        if (currentVis === 'pulse') {
            const half = pulseBars.length / 2;
            for (let i = 0; i < pulseBars.length; i++) {
                const sym  = i < half ? i : pulseBars.length - 1 - i;
                const bin  = Math.min(dataArr.length - 1, Math.floor((sym / half) * dataArr.length * 0.7));
                const val  = dataArr[bin] || 0;
                pulseBars[i].scale.y += (Math.max(0.8, 1 + (val / 255) * 16) - pulseBars[i].scale.y) * 0.25;
            }
        } else if (currentVis === 'wave') {
            for (let i = 0; i < waveBars.length; i++) {
                const bin = Math.floor((i / waveBars.length) * dataArr.length * 0.65);
                const val = dataArr[bin] || 0;
                waveBars[i].scale.y += (Math.max(0.8, 1 + (val / 255) * 18) - waveBars[i].scale.y) * 0.25;
            }
        } else if (currentVis === 'grid') {
            for (let i = 0; i < vgridBars.length; i++) {
                const bin = Math.floor((i / vgridBars.length) * dataArr.length * 0.55);
                const val = dataArr[bin] || 0;
                vgridBars[i].scale.y += (Math.max(0.6, 1 + (val / 255) * 12) - vgridBars[i].scale.y) * 0.25;
            }
        }
    } else {
        bgBassLevel *= 0.95;

        if (currentVis === 'pulse') {
            for (let i = 0; i < pulseBars.length; i++) {
                const a   = (i / pulseBars.length) * Math.PI * 2;
                const h   = Math.sin(a * 3 + time * 1.5) * 0.45 + Math.sin(a * 2 - time * 0.9) * 0.35 + Math.sin(a * 5 + time * 2.2) * 0.15;
                const tgt = Math.max(0.7, 1.35 + Math.sin(time * 1.2) * 0.2 + h);
                pulseBars[i].scale.y += (tgt - pulseBars[i].scale.y) * 0.12;
            }
        } else if (currentVis === 'wave') {
            for (let i = 0; i < waveBars.length; i++) {
                const n   = i / waveBars.length;
                const tgt = Math.max(0.7, 1.3 + Math.sin(n * Math.PI * 2 + time * 2) * 0.55 + Math.sin(n * Math.PI * 4 - time * 1.3) * 0.25);
                waveBars[i].scale.y += (tgt - waveBars[i].scale.y) * 0.12;
            }
        } else if (currentVis === 'grid') {
            for (let i = 0; i < vgridBars.length; i++) {
                const x   = (i % 16) - 7.5;
                const z   = Math.floor(i / 16) - 3.5;
                const d   = Math.sqrt(x * x + z * z);
                const tgt = Math.max(0.6, 1.1 + Math.sin(d * 0.7 - time * 2.5) * 0.5 + Math.cos(x * 0.3 + time) * 0.2);
                vgridBars[i].scale.y += (tgt - vgridBars[i].scale.y) * 0.12;
            }
        }
    }

    composer.render();
}

// ---------- Audio helpers ----------
function ensureAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function attachAudioElement(el) {
    if (audioSrc) { try { audioSrc.disconnect(); } catch (_) {} }
    audioSrc = audioCtx.createMediaElementSource(el);
    analyser  = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.88;
    dataArr   = new Uint8Array(analyser.frequencyBinCount);
    audioSrc.connect(analyser);
    analyser.connect(audioCtx.destination);
}

function stopMic() {
    micStream?.getTracks().forEach(t => t.stop());
    micStream   = null;
    isMicActive = false;
}

function playNext() {
    if (queue.length > 0) {
        const n = queue.shift();
        n.src ? playDirectAudio(n.src, n.title, n.artist) : playStream(n.url || n, n);
    } else {
        updatePlayIcons(false);
    }
}

function fmtTime(s) {
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function attachTimeEvents(el) {
    el.ontimeupdate = () => {
        if (!el.duration) return;
        const pct = (el.currentTime / el.duration) * 100;
        seekSlider.value = pct;
        progressFill.style.width = pct + '%';
        timeCurrent.innerText = fmtTime(el.currentTime);
        timeTotal.innerText   = fmtTime(el.duration);
    };
    el.onended = playNext;
}

function playDirectAudio(src, title, artist) {
    stopMic();
    updateTrackInfo(title, artist, null);
    if (curAudioEl) { curAudioEl.pause(); curAudioEl.src = ''; }

    curAudioEl = new Audio();
    curAudioEl.crossOrigin = 'anonymous';
    curAudioEl.src = src;
    curAudioEl.oncanplay = () => {
        ensureAudioCtx();
        attachAudioElement(curAudioEl);
        curAudioEl.play().catch(() => {});
        updatePlayIcons(true);
    };
    curAudioEl.onerror = () => updatePlayIcons(false);
    attachTimeEvents(curAudioEl);
}

async function playStream(query, presetMeta = null) {
    if (!query) return;
    if (isPlaying && curAudioEl && !curAudioEl.paused) {
        queue.push(presetMeta || { title: query, url: query });
        showToast(`Queued: ${presetMeta?.title || query}`);
        return;
    }

    stopMic();
    updateTrackInfo(presetMeta?.title || 'Loading…', presetMeta?.uploader || 'Streaming', presetMeta?.thumbnail);

    try {
        let meta = presetMeta;
        if (!meta) {
            const r = await fetch(`/metadata?url=${encodeURIComponent(query)}`);
            meta = await r.json();
        }
        updateTrackInfo(meta.title || query, meta.uploader || 'Unknown', meta.thumbnail);

        if (curAudioEl) { curAudioEl.pause(); curAudioEl.src = ''; }
        curAudioEl = new Audio();
        curAudioEl.crossOrigin = 'anonymous';
        curAudioEl.src = `/stream?url=${encodeURIComponent(query)}`;

        curAudioEl.oncanplay = () => {
            ensureAudioCtx();
            attachAudioElement(curAudioEl);
            curAudioEl.play().catch(() => {});
            updatePlayIcons(true);
        };
        curAudioEl.onerror = () => {
            updatePlayIcons(false);
            showToast('YouTube blocked this on cloud servers. Try the demo tracks or upload an MP3.');
            updateTrackInfo('Stream blocked', 'Use demos or upload an MP3', null);
        };
        attachTimeEvents(curAudioEl);

    } catch (_) {
        updatePlayIcons(false);
        showToast('YouTube blocked this on cloud servers. Try the demo tracks or upload an MP3.');
        updateTrackInfo('Playback error', 'Use demos or upload an MP3', null);
    }
}

// ---------- UI interactions ----------
function togglePlay() {
    if (isMicActive) return;
    if (!curAudioEl || !curAudioEl.src) {
        playDirectAudio('/audio/synthwave.mp3', 'Synthwave Pulse', 'RetroWave Studio');
        return;
    }
    if (curAudioEl.paused) {
        ensureAudioCtx();
        curAudioEl.play();
        updatePlayIcons(true);
    } else {
        curAudioEl.pause();
        updatePlayIcons(false);
    }
}
playBtn.addEventListener('click', togglePlay);

// Left panel tabs
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const t = tab.dataset.tab;
        document.getElementById('tab-presets').style.display = t === 'presets' ? 'block' : 'none';
        document.getElementById('tab-search').style.display  = t === 'search'  ? 'block' : 'none';
        document.getElementById('tab-upload').style.display  = t === 'upload'  ? 'block' : 'none';
    });
});

// Demo track rows
document.querySelectorAll('.track-row').forEach(row => {
    row.addEventListener('click', () => {
        document.querySelectorAll('.track-row').forEach(r => r.classList.remove('active'));
        row.classList.add('active');
        playDirectAudio(row.dataset.src, row.dataset.title, row.dataset.artist);
    });
});

// Search
let suggTimer;
const doSearch = () => {
    const q = searchInp.value.trim();
    if (q) playStream(q);
    searchInp.value = '';
    if (suggBox) suggBox.style.display = 'none';
};
searchBtn?.addEventListener('click', doSearch);
searchInp?.addEventListener('keypress', e => { if (e.key === 'Enter') doSearch(); });

searchInp?.addEventListener('input', () => {
    clearTimeout(suggTimer);
    const q = searchInp.value.trim();
    if (!q) { if (suggBox) suggBox.style.display = 'none'; return; }
    suggTimer = setTimeout(async () => {
        try {
            const res  = await fetch('/api/search?q=' + encodeURIComponent(q));
            const data = await res.json();
            if (!suggBox) return;
            suggBox.innerHTML = '';
            if (!data?.length) { suggBox.style.display = 'none'; return; }
            data.forEach(item => {
                const card = document.createElement('div');
                card.className = 'suggestion-card';
                card.innerHTML = `
                    ${item.thumbnail ? `<img class="suggestion-thumb" src="${item.thumbnail}" alt="">` : `<div class="suggestion-thumb" style="background:#1a1f2e;display:flex;align-items:center;justify-content:center;color:var(--accent);font-size:12px;">♪</div>`}
                    <div>
                        <div class="suggestion-title">${item.title}</div>
                        <div class="suggestion-channel">${item.uploader}</div>
                    </div>
                `;
                card.onclick = () => {
                    suggBox.style.display = 'none';
                    searchInp.value = '';
                    playStream(item.url, item);
                };
                suggBox.appendChild(card);
            });
            suggBox.style.display = 'flex';
        } catch (_) {}
    }, 220);
});

document.addEventListener('click', e => {
    if (suggBox && !searchInp?.contains(e.target) && !suggBox.contains(e.target)) {
        suggBox.style.display = 'none';
    }
});

// Mic
document.getElementById('mic-btn')?.addEventListener('click', async () => {
    try {
        if (curAudioEl) { curAudioEl.pause(); updatePlayIcons(false); }
        ensureAudioCtx();
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        isMicActive = true;
        updatePlayIcons(true);
        updateTrackInfo('Live microphone', 'Listening…', null);
        const src = audioCtx.createMediaStreamSource(micStream);
        analyser  = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.85;
        dataArr   = new Uint8Array(analyser.frequencyBinCount);
        src.connect(analyser);
    } catch (_) {
        showToast('Microphone access denied');
    }
});

// File upload
const fileUpload = document.getElementById('file-upload');
document.getElementById('upload-btn')?.addEventListener('click', () => fileUpload?.click());
fileUpload?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    stopMic();
    updateTrackInfo(file.name, 'Local file', null);
    if (curAudioEl) { curAudioEl.pause(); curAudioEl.src = ''; }
    curAudioEl = new Audio();
    curAudioEl.src = URL.createObjectURL(file);
    curAudioEl.oncanplay = () => {
        ensureAudioCtx();
        attachAudioElement(curAudioEl);
        curAudioEl.play();
        updatePlayIcons(true);
    };
    attachTimeEvents(curAudioEl);
});

// Shape buttons
document.querySelectorAll('#style-segmented .shape-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#style-segmented .shape-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentVis = btn.dataset.value;
        pulseGrp.visible = currentVis === 'pulse';
        waveGrp.visible  = currentVis === 'wave';
        vgridGrp.visible = currentVis === 'grid';
    });
});

// Background mode buttons
document.querySelectorAll('#bg-segmented .shape-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#bg-segmented .shape-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentBg = btn.dataset.bg;
        if (currentBg === 'rings') {
            rings = [];
            spawnRing();
        }
    });
});

// Color dots
document.querySelectorAll('.color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
        document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        currentTheme = dot.dataset.theme;
        const th = THEMES[currentTheme];

        document.documentElement.style.setProperty('--accent',      th.accent);
        document.documentElement.style.setProperty('--accent-glow', th.glow);

        const updateMat = arr => arr.forEach(b => {
            b.material.color.setHex(th.color);
            b.material.emissive.setHex(th.color);
        });
        updateMat(pulseBars);
        updateMat(waveBars);
        updateMat(vgridBars);

        const pl = scene.children.find(c => c.isPointLight);
        if (pl) pl.color.setHex(th.color);
    });
});

// Scrubber
seekSlider?.addEventListener('input', e => {
    if (!curAudioEl?.duration) return;
    const pct = parseFloat(e.target.value);
    curAudioEl.currentTime = (pct / 100) * curAudioEl.duration;
    progressFill.style.width = pct + '%';
});

// Volume
volSlider?.addEventListener('input', e => {
    if (curAudioEl) curAudioEl.volume = parseFloat(e.target.value) / 100;
});

let isMuted = false, prevVol = 100;
muteBtn?.addEventListener('click', () => {
    if (!curAudioEl) return;
    if (isMuted) {
        curAudioEl.volume = prevVol / 100;
        volSlider.value   = prevVol;
        isMuted = false;
    } else {
        prevVol = volSlider.value;
        curAudioEl.volume = 0;
        volSlider.value   = 0;
        isMuted = true;
    }
});

// Reset camera
document.getElementById('reset-cam-btn')?.addEventListener('click', () => {
    targetRotX = 0; targetRotY = 0;
    if (visualizerRoot) { visualizerRoot.rotation.x = 0; visualizerRoot.rotation.y = 0; }
    camera.position.set(0, 8, 62);
    camera.lookAt(0, 0, 0);
});

// Fullscreen
document.getElementById('fullscreen-btn')?.addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
});

// Guide modal
const guideModal = document.getElementById('guide-modal');
document.getElementById('guide-btn')?.addEventListener('click',        () => { guideModal.style.display = 'flex'; });
document.getElementById('close-guide-btn')?.addEventListener('click',  () => { guideModal.style.display = 'none'; });
document.getElementById('dismiss-guide-btn')?.addEventListener('click',() => { guideModal.style.display = 'none'; });
guideModal?.addEventListener('click', e => { if (e.target === guideModal) guideModal.style.display = 'none'; });

// Keyboard shortcuts
window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    else if (e.code === 'KeyM') muteBtn?.click();
    else if (e.code === 'KeyR') document.getElementById('reset-cam-btn')?.click();
    else if (e.code === 'KeyF') document.getElementById('fullscreen-btn')?.click();
    else if (e.key === '1') document.querySelector('.shape-btn[data-value="pulse"]')?.click();
    else if (e.key === '2') document.querySelector('.shape-btn[data-value="wave"]')?.click();
    else if (e.key === '3') document.querySelector('.shape-btn[data-value="grid"]')?.click();
});

if (albumArt) albumArt.onerror = () => { albumArt.src = 'favicon.svg'; };

initThree();
