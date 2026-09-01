// ==========================================
// ⚡ WIBEI 3D AUDIO SPECTROGRAPH & DSP LAB
// Built with Three.js WebGL & Web Audio API
// ==========================================

console.log(
    '%c⚡ WIBEI // 3D AUDIO DSP STUDIO \n%cThree.js WebGL & Web Audio API Engine Initialized',
    'color: #facc15; font-weight: bold; font-size: 14px;',
    'color: #94a3b8; font-size: 11px;'
);

// Math & Audio DSP Helpers
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

const bgCanvas = document.getElementById('bg-canvas');
const bgCtx = bgCanvas.getContext('2d');

let audioCtx, analyser, dataArr, audioSrc, curAudioEl;
let biquadMuffler, biquadBass, masterGain;
let isPlaying = false;
let isMicActive = false;
let micStream = null;
let queue = [];

let fxMuffler = false;
let fxBassBoost = false;
let fxSpeedIdx = 0;
const FX_SPEEDS = [1.0, 1.25, 0.85];

let scene, camera, renderer, composer, bloomPass;
let visualizerRoot, shockwaveGroup;
let pulseGrp, waveGrp, vgridGrp, orbGrp;
let pulseBars = [], waveBars = [], vgridBars = [], orbVertices = [];
let orbMesh, orbWireMesh;

const THEMES = {
    gold:    { accent: '#facc15', glow: 'rgba(250, 204, 21, 0.35)', color: 0xfacc15 },
    cyan:    { accent: '#06b6d4', glow: 'rgba(6, 182, 212, 0.35)', color: 0x06b6d4 },
    magenta: { accent: '#f43f5e', glow: 'rgba(244, 63, 94, 0.35)', color: 0xf43f5e },
    rainbow: { accent: '#facc15', glow: 'rgba(250, 204, 21, 0.35)', color: 0xffffff, isRainbow: true }
};
let currentTheme = 'gold';
let currentVis   = 'pulse';
let currentBg    = 'dots';
let isAutoCam    = false;
let autoCamAngle = 0;
let bgBassLevel  = 0;
let lastBassEnergy = 0;

let mouseX = 0, mouseY = 0;
let targetRotX = 0, targetRotY = 0;
let isDragging = false;
let prevMouse = { x: 0, y: 0 };

let lastFpsTime = performance.now();
let frameCounter = 0;
let currentFps = 60;

const playBtn        = document.getElementById('play-btn');
const iconPlay       = document.querySelector('.icon-play');
const iconPause      = document.querySelector('.icon-pause');
const seekSlider     = document.getElementById('seek-slider');
const progressFill   = document.getElementById('progress-fill');
const timeCurrent    = document.getElementById('time-current');
const timeTotal      = document.getElementById('time-total');
const volSlider      = document.getElementById('vol-slider');
const muteBtn        = document.getElementById('mute-btn');
const searchInp      = document.getElementById('search-inp');
const searchBtn      = document.getElementById('search-btn');
const suggBox        = document.getElementById('suggestions-box');
const albumArt       = document.getElementById('album-art');
const trackTitle     = document.getElementById('track-title');
const trackArtist    = document.getElementById('track-artist');
const miniEq         = document.getElementById('mini-eq');
const telemetryMode  = document.getElementById('telemetry-mode');
const telemetryPeak  = document.getElementById('telemetry-peak');
const telemetryFps   = document.getElementById('telemetry-fps');
const sourceBadge    = document.getElementById('source-badge');
const geometryBadge  = document.getElementById('geometry-badge');
const masterVuSpans  = document.querySelectorAll('#master-vu span');
const fxMufflerBtn   = document.getElementById('fx-muffler');
const fxBassBtn      = document.getElementById('fx-bassboost');
const fxSpeedBtn     = document.getElementById('fx-speed');
const fxSpeedStatus  = document.getElementById('fx-speed-status');
const autoCamBtn     = document.getElementById('cam-autopilot-btn');

let toastTimer;
function showToast(msg, duration = 5000) {
    const el = document.getElementById('toast-banner');
    const msgEl = document.getElementById('toast-msg');
    if (!el || !msgEl) return;
    msgEl.innerText = msg;
    el.style.display = 'flex';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.style.display = 'none'; }, duration);
}
document.getElementById('toast-close-btn')?.addEventListener('click', () => {
    document.getElementById('toast-banner').style.display = 'none';
});

function updatePlayIcons(playing) {
    isPlaying = playing;
    if (iconPlay && iconPause) {
        iconPlay.style.display  = playing ? 'none'  : 'block';
        iconPause.style.display = playing ? 'block' : 'none';
    }
    if (miniEq) miniEq.style.display = playing ? 'flex' : 'none';
    if (telemetryMode) telemetryMode.innerText = playing ? 'ACTIVE' : 'IDLE';
}

function updateTrackInfo(title, artist, thumb) {
    if (trackTitle)  trackTitle.innerText  = title;
    if (trackArtist) trackArtist.innerText = artist;
    if (albumArt)    albumArt.src = thumb || 'favicon.svg';
}

let particles = [];
let rings = [];
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
        speed: 0.2 + Math.random() * 0.35,
        drift: (Math.random() - 0.5) * 0.3,
        alpha: 0.05 + Math.random() * 0.12,
    });
}
for (let i = 0; i < 100; i++) spawnParticle(true);

function spawnRing() {
    rings.push({
        cx: bgCanvas.width / 2 + (Math.random() - 0.5) * 60,
        cy: bgCanvas.height / 2 + (Math.random() - 0.5) * 40,
        r: 0,
        alpha: 0.2
    });
}
spawnRing();

function drawDotsFrame() {
    const th = THEMES[currentTheme];
    const boost = 1 + bgBassLevel * 1.8;
    particles.forEach(p => {
        p.y -= p.speed * boost;
        p.x += p.drift;
        if (p.y < -4) { p.y = bgCanvas.height + 4; p.x = Math.random() * bgCanvas.width; }
        if (p.x < -4 || p.x > bgCanvas.width + 4) p.x = Math.random() * bgCanvas.width;
        bgCtx.beginPath();
        bgCtx.arc(p.x, p.y, p.r * (1 + bgBassLevel * 0.6), 0, Math.PI * 2);
        bgCtx.fillStyle   = th.accent;
        bgCtx.globalAlpha = p.alpha * (1 + bgBassLevel * 0.7);
        bgCtx.fill();
    });
}

function drawRingsFrame() {
    const th = THEMES[currentTheme];
    const expandSpeed = 0.6 + bgBassLevel * 2.5;
    const spawnEvery = Math.max(500, 1600 - bgBassLevel * 1000);

    ringSpawnTimer += 16;
    if (ringSpawnTimer >= spawnEvery) {
        spawnRing();
        ringSpawnTimer = 0;
    }

    bgCtx.strokeStyle = th.accent;
    rings = rings.filter(r => r.alpha > 0.003);
    rings.forEach(ring => {
        ring.r    += expandSpeed;
        ring.alpha = Math.max(0, ring.alpha - 0.0009 - bgBassLevel * 0.002);
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
    if (currentBg === 'dots')  drawDotsFrame();
    else if (currentBg === 'rings') drawRingsFrame();
    bgCtx.globalAlpha = 1;
}
animateBg();

let shockwaves = [];
function triggerBeatShockwave(energy) {
    if (!shockwaveGroup) return;
    const geom = new THREE.RingGeometry(0.1, 0.6, 32);
    const th = THEMES[currentTheme];
    const mat = new THREE.MeshBasicMaterial({
        color: th.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: Math.min(1.0, 0.4 + energy * 0.8)
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = -10;
    shockwaveGroup.add(mesh);
    shockwaves.push({ mesh, radius: 0.5, speed: 0.8 + energy * 1.5, alpha: 1.0 });
}

function initThree() {
    const container = document.getElementById('threejs-container');
    scene  = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);
    camera.position.set(0, 10, 60);
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

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const pointLight = new THREE.PointLight(THEMES[currentTheme].color, 2.8, 140);
    pointLight.position.set(0, 0, 24);
    scene.add(pointLight);

    visualizerRoot = new THREE.Group();
    scene.add(visualizerRoot);

    shockwaveGroup = new THREE.Group();
    scene.add(shockwaveGroup);

    const bGeo = new THREE.BoxGeometry(0.5, 1, 0.5);
    bGeo.translate(0, 0.5, 0);

    function makeMat(idx = 0, total = 128) {
        let col = THEMES[currentTheme].color;
        if (THEMES[currentTheme].isRainbow) {
            col = new THREE.Color().setHSL(idx / total, 0.9, 0.55).getHex();
        }
        return new THREE.MeshStandardMaterial({
            color:             col,
            emissive:          col,
            emissiveIntensity: 0.85,
            roughness:         0.2,
            metalness:         0.8,
        });
    }

    pulseGrp = new THREE.Group();
    const ringCount = 128, ringR = 22;
    for (let i = 0; i < ringCount; i++) {
        const m = new THREE.Mesh(bGeo, makeMat(i, ringCount));
        const a = (i / ringCount) * Math.PI * 2;
        m.position.set(Math.cos(a) * ringR, Math.sin(a) * ringR, 0);
        m.rotation.z = a - Math.PI / 2;
        pulseGrp.add(m);
        pulseBars.push(m);
    }
    visualizerRoot.add(pulseGrp);

    waveGrp = new THREE.Group();
    const waveN = 64;
    for (let i = 0; i < waveN; i++) {
        const m = new THREE.Mesh(bGeo, makeMat(i, waveN));
        m.position.set((i - waveN / 2) * 1.25, -6, 0);
        waveGrp.add(m);
        waveBars.push(m);
    }
    waveGrp.visible = false;
    visualizerRoot.add(waveGrp);

    vgridGrp = new THREE.Group();
    const gCols = 16, gRows = 8;
    for (let i = 0; i < gCols * gRows; i++) {
        const m = new THREE.Mesh(bGeo, makeMat(i, gCols * gRows));
        const x = (i % gCols) - gCols / 2;
        const z = Math.floor(i / gCols) - gRows / 2;
        m.position.set(x * 2.5, -10, z * 2.5);
        vgridGrp.add(m);
        vgridBars.push(m);
    }
    vgridGrp.visible = false;
    visualizerRoot.add(vgridGrp);

    orbGrp = new THREE.Group();
    const sphereGeom = new THREE.IcosahedronGeometry(12, 3);
    const sphereMat = new THREE.MeshStandardMaterial({
        color: THEMES[currentTheme].color,
        emissive: THEMES[currentTheme].color,
        emissiveIntensity: 0.7,
        wireframe: true,
        roughness: 0.1,
        metalness: 0.9
    });
    orbMesh = new THREE.Mesh(sphereGeom, sphereMat);
    orbGrp.add(orbMesh);

    const pos = sphereGeom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        orbVertices.push(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
    }
    orbGrp.visible = false;
    visualizerRoot.add(orbGrp);

    window.addEventListener('mousemove', e => {
        mouseX = (e.clientX / innerWidth) * 2 - 1;
        mouseY = -(e.clientY / innerHeight) * 2 + 1;
        if (isDragging) {
            targetRotY += (e.clientX - prevMouse.x) * 0.006;
            targetRotX += (e.clientY - prevMouse.y) * 0.006;
            prevMouse = { x: e.clientX, y: e.clientY };
        }
    });

    const isUI = el => el.closest('.top-bar, .control-deck, .master-transport, .modal-dialog, .toast-card');
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

    frameCounter++;
    const nowMs = performance.now();
    if (nowMs - lastFpsTime >= 1000) {
        currentFps = Math.round((frameCounter * 1000) / (nowMs - lastFpsTime));
        if (telemetryFps) telemetryFps.innerText = `${currentFps} FPS`;
        frameCounter = 0;
        lastFpsTime = nowMs;
    }

    if (isAutoCam) {
        autoCamAngle += 0.008 + bgBassLevel * 0.02;
        const camDist = 58 - bgBassLevel * 10;
        camera.position.x = Math.sin(autoCamAngle) * camDist;
        camera.position.z = Math.cos(autoCamAngle) * camDist;
        camera.position.y = 10 + Math.sin(autoCamAngle * 0.5) * 8;
        camera.lookAt(0, 0, 0);
    } else if (visualizerRoot) {
        visualizerRoot.rotation.y += (targetRotY + mouseX * 0.15 - visualizerRoot.rotation.y) * 0.08;
        visualizerRoot.rotation.x += (targetRotX - mouseY * 0.15 - visualizerRoot.rotation.x) * 0.08;
    }

    shockwaves = shockwaves.filter(sw => sw.alpha > 0.01);
    shockwaves.forEach(sw => {
        sw.radius += sw.speed;
        sw.alpha -= 0.025;
        sw.mesh.scale.set(sw.radius, sw.radius, sw.radius);
        sw.mesh.material.opacity = Math.max(0, sw.alpha);
        if (sw.alpha <= 0.01) {
            shockwaveGroup.remove(sw.mesh);
            sw.mesh.geometry.dispose();
            sw.mesh.material.dispose();
        }
    });

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

        if (bgBassLevel - lastBassEnergy > 0.32 && bgBassLevel > 0.55) {
            triggerBeatShockwave(bgBassLevel);
        }
        lastBassEnergy = bgBassLevel;

        const peakDb = Math.round(20 * Math.log10(Math.max(0.01, bgBassLevel)));
        if (telemetryPeak) telemetryPeak.innerText = `${peakDb} dB`;

        const activeVu = Math.min(6, Math.floor(bgBassLevel * 7));
        masterVuSpans.forEach((span, idx) => {
            span.style.height = idx < activeVu ? `${4 + idx * 2}px` : '3px';
        });

        if (currentVis === 'pulse') {
            const half = pulseBars.length / 2;
            for (let i = 0; i < pulseBars.length; i++) {
                const sym = i < half ? i : pulseBars.length - 1 - i;
                const bin = Math.min(dataArr.length - 1, Math.floor((sym / half) * dataArr.length * 0.7));
                const val = dataArr[bin] || 0;
                pulseBars[i].scale.y += (Math.max(0.8, 1 + (val / 255) * 17) - pulseBars[i].scale.y) * 0.28;
            }
        } else if (currentVis === 'wave') {
            for (let i = 0; i < waveBars.length; i++) {
                const bin = Math.floor((i / waveBars.length) * dataArr.length * 0.65);
                const val = dataArr[bin] || 0;
                waveBars[i].scale.y += (Math.max(0.8, 1 + (val / 255) * 19) - waveBars[i].scale.y) * 0.28;
            }
        } else if (currentVis === 'grid') {
            for (let i = 0; i < vgridBars.length; i++) {
                const bin = Math.floor((i / vgridBars.length) * dataArr.length * 0.55);
                const val = dataArr[bin] || 0;
                vgridBars[i].scale.y += (Math.max(0.6, 1 + (val / 255) * 13) - vgridBars[i].scale.y) * 0.28;
            }
        } else if (currentVis === 'orb' && orbMesh) {
            const pos = orbMesh.geometry.attributes.position;
            orbMesh.rotation.y += 0.01 + bgBassLevel * 0.03;
            orbMesh.rotation.x += 0.006;
            for (let i = 0; i < pos.count; i++) {
                const orig = orbVertices[i];
                const bin = (i * 3) % (dataArr.length - 1);
                const factor = 1 + ((dataArr[bin] || 0) / 255) * 0.85 + bgBassLevel * 0.4;
                pos.setXYZ(i, orig.x * factor, orig.y * factor, orig.z * factor);
            }
            pos.needsUpdate = true;
        }
    } else {
        bgBassLevel *= 0.95;
        lastBassEnergy = 0;
        if (telemetryPeak) telemetryPeak.innerText = '-inf dB';
        masterVuSpans.forEach(span => { span.style.height = '3px'; });

        if (currentVis === 'pulse') {
            for (let i = 0; i < pulseBars.length; i++) {
                const a = (i / pulseBars.length) * Math.PI * 2;
                const h = Math.sin(a * 3 + time * 1.5) * 0.45 + Math.sin(a * 2 - time * 0.9) * 0.35;
                const tgt = Math.max(0.7, 1.35 + Math.sin(time * 1.2) * 0.2 + h);
                pulseBars[i].scale.y += (tgt - pulseBars[i].scale.y) * 0.12;
            }
        } else if (currentVis === 'wave') {
            for (let i = 0; i < waveBars.length; i++) {
                const n = i / waveBars.length;
                const tgt = Math.max(0.7, 1.3 + Math.sin(n * Math.PI * 2 + time * 2) * 0.55);
                waveBars[i].scale.y += (tgt - waveBars[i].scale.y) * 0.12;
            }
        } else if (currentVis === 'grid') {
            for (let i = 0; i < vgridBars.length; i++) {
                const x = (i % 16) - 7.5;
                const z = Math.floor(i / 16) - 3.5;
                const d = Math.sqrt(x * x + z * z);
                const tgt = Math.max(0.6, 1.1 + Math.sin(d * 0.7 - time * 2.5) * 0.5);
                vgridBars[i].scale.y += (tgt - vgridBars[i].scale.y) * 0.12;
            }
        } else if (currentVis === 'orb' && orbMesh) {
            orbMesh.rotation.y += 0.008;
            orbMesh.rotation.x += 0.004;
            const pos = orbMesh.geometry.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                const orig = orbVertices[i];
                const wave = Math.sin(time * 2 + orig.y * 0.5) * 0.12;
                pos.setXYZ(i, orig.x * (1 + wave), orig.y * (1 + wave), orig.z * (1 + wave));
            }
            pos.needsUpdate = true;
        }
    }

    composer.render();
}

function ensureAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        biquadMuffler = audioCtx.createBiquadFilter();
        biquadMuffler.type = 'lowpass';
        biquadMuffler.frequency.value = fxMuffler ? 650 : 20000;
        biquadMuffler.Q.value = 1.2;

        biquadBass = audioCtx.createBiquadFilter();
        biquadBass.type = 'lowshelf';
        biquadBass.frequency.value = 120;
        biquadBass.gain.value = fxBassBoost ? 10 : 0;

        masterGain = audioCtx.createGain();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.86;
        dataArr = new Uint8Array(analyser.frequencyBinCount);

        biquadMuffler.connect(biquadBass);
        biquadBass.connect(masterGain);
        masterGain.connect(analyser);
        analyser.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function attachAudioElement(el) {
    ensureAudioCtx();
    if (audioSrc) {
        try { audioSrc.disconnect(); } catch (_) {}
    }
    audioSrc = audioCtx.createMediaElementSource(el);
    audioSrc.connect(biquadMuffler);
}

function stopMic() {
    micStream?.getTracks().forEach(t => t.stop());
    micStream = null;
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
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
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
    if (sourceBadge) sourceBadge.innerText = 'DEMO';

    if (curAudioEl) { curAudioEl.pause(); curAudioEl.src = ''; }

    curAudioEl = new Audio();
    curAudioEl.crossOrigin = 'anonymous';
    curAudioEl.src = src;
    curAudioEl.playbackRate = FX_SPEEDS[fxSpeedIdx];

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
    if (sourceBadge) sourceBadge.innerText = 'STREAM';
    updateTrackInfo(presetMeta?.title || 'Connecting...', presetMeta?.uploader || 'Streaming audio', presetMeta?.thumbnail);

    try {
        let meta = presetMeta;
        if (!meta) {
            const r = await fetch(`/metadata?url=${encodeURIComponent(query)}`);
            meta = await r.json();
        }
        updateTrackInfo(meta.title || query, meta.uploader || 'Unknown Artist', meta.thumbnail);

        if (curAudioEl) { curAudioEl.pause(); curAudioEl.src = ''; }
        curAudioEl = new Audio();
        curAudioEl.crossOrigin = 'anonymous';
        curAudioEl.src = `/stream?url=${encodeURIComponent(query)}`;
        curAudioEl.playbackRate = FX_SPEEDS[fxSpeedIdx];

        curAudioEl.oncanplay = () => {
            ensureAudioCtx();
            attachAudioElement(curAudioEl);
            curAudioEl.play().catch(() => {});
            updatePlayIcons(true);
        };
        curAudioEl.onerror = () => {
            updatePlayIcons(false);
            showToast('YouTube bot challenge triggered on cloud! Use DEMOS or local MP3.');
            updateTrackInfo('Stream Blocked by YouTube', 'Use Demos or Local File', null);
        };
        attachTimeEvents(curAudioEl);

    } catch (_) {
        updatePlayIcons(false);
        showToast('YouTube rate-limit on cloud host! Use DEMOS or local MP3.');
        updateTrackInfo('Playback Error', 'Use Demos or Local File', null);
    }
}

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

document.querySelectorAll('.deck-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.deck-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.tab;
        document.getElementById('tab-presets').style.display = target === 'presets' ? 'block' : 'none';
        document.getElementById('tab-search').style.display  = target === 'search'  ? 'block' : 'none';
        document.getElementById('tab-upload').style.display  = target === 'upload'  ? 'block' : 'none';
    });
});

document.querySelectorAll('.preset-row').forEach(row => {
    row.addEventListener('click', () => {
        document.querySelectorAll('.preset-row').forEach(r => r.classList.remove('active'));
        row.classList.add('active');
        playDirectAudio(row.dataset.src, row.dataset.title, row.dataset.artist);
    });
});

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
                    ${item.thumbnail ? `<img class="suggestion-thumb" src="${item.thumbnail}" alt="">` : `<div class="suggestion-thumb" style="background:#1e293b;display:flex;align-items:center;justify-content:center;color:var(--accent);font-size:12px;">♪</div>`}
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

document.getElementById('mic-btn')?.addEventListener('click', async () => {
    try {
        if (curAudioEl) { curAudioEl.pause(); updatePlayIcons(false); }
        ensureAudioCtx();
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        isMicActive = true;
        updatePlayIcons(true);
        if (sourceBadge) sourceBadge.innerText = 'MIC';
        updateTrackInfo('Live Microphone', 'Acoustic Input Active', null);

        if (audioSrc) {
            try { audioSrc.disconnect(); } catch (_) {}
        }
        audioSrc = audioCtx.createMediaStreamSource(micStream);
        audioSrc.connect(biquadMuffler);
    } catch (_) {
        showToast('Microphone access denied');
    }
});

const fileUpload = document.getElementById('file-upload');
document.getElementById('upload-btn')?.addEventListener('click', () => fileUpload?.click());

function loadLocalFile(file) {
    if (!file) return;
    stopMic();
    if (sourceBadge) sourceBadge.innerText = 'LOCAL';
    updateTrackInfo(file.name, 'Local Audio File', null);
    if (curAudioEl) { curAudioEl.pause(); curAudioEl.src = ''; }
    curAudioEl = new Audio();
    curAudioEl.src = URL.createObjectURL(file);
    curAudioEl.playbackRate = FX_SPEEDS[fxSpeedIdx];
    curAudioEl.oncanplay = () => {
        ensureAudioCtx();
        attachAudioElement(curAudioEl);
        curAudioEl.play();
        updatePlayIcons(true);
    };
    attachTimeEvents(curAudioEl);
}

fileUpload?.addEventListener('change', e => {
    loadLocalFile(e.target.files[0]);
});

const dropzone = document.getElementById('drag-dropzone');
window.addEventListener('dragover', e => {
    e.preventDefault();
    if (dropzone) dropzone.classList.add('active');
});
window.addEventListener('dragleave', e => {
    if (e.relatedTarget === null && dropzone) {
        dropzone.classList.remove('active');
    }
});
window.addEventListener('drop', e => {
    e.preventDefault();
    if (dropzone) dropzone.classList.remove('active');
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('audio/')) {
        loadLocalFile(file);
        showToast(`Loaded: ${file.name}`);
    }
});

document.querySelectorAll('#style-segmented .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#style-segmented .seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentVis = btn.dataset.value;
        pulseGrp.visible = currentVis === 'pulse';
        waveGrp.visible  = currentVis === 'wave';
        vgridGrp.visible = currentVis === 'grid';
        orbGrp.visible   = currentVis === 'orb';
        if (geometryBadge) geometryBadge.innerText = btn.innerText;
    });
});

fxMufflerBtn?.addEventListener('click', () => {
    fxMuffler = !fxMuffler;
    ensureAudioCtx();
    fxMufflerBtn.classList.toggle('active', fxMuffler);
    fxMufflerBtn.querySelector('.fx-status').innerText = fxMuffler ? 'ON' : 'OFF';
    if (biquadMuffler) {
        biquadMuffler.frequency.setTargetAtTime(fxMuffler ? 650 : 20000, audioCtx.currentTime, 0.05);
    }
    showToast(`Muffler Filter: ${fxMuffler ? 'ON (Underwater vibe)' : 'OFF'}`);
});

fxBassBtn?.addEventListener('click', () => {
    fxBassBoost = !fxBassBoost;
    ensureAudioCtx();
    fxBassBtn.classList.toggle('active', fxBassBoost);
    fxBassBtn.querySelector('.fx-status').innerText = fxBassBoost ? '+10dB' : 'OFF';
    if (biquadBass) {
        biquadBass.gain.setTargetAtTime(fxBassBoost ? 10 : 0, audioCtx.currentTime, 0.05);
    }
    showToast(`Bass Boost: ${fxBassBoost ? 'ON (+10dB)' : 'OFF'}`);
});

fxSpeedBtn?.addEventListener('click', () => {
    fxSpeedIdx = (fxSpeedIdx + 1) % FX_SPEEDS.length;
    const speed = FX_SPEEDS[fxSpeedIdx];
    if (curAudioEl) curAudioEl.playbackRate = speed;
    if (fxSpeedStatus) fxSpeedStatus.innerText = `${speed}x`;
    fxSpeedBtn.classList.toggle('active', speed !== 1.0);
    const label = speed === 1.25 ? 'Nightcore (1.25x)' : speed === 0.85 ? 'Slowed Vibe (0.85x)' : 'Normal (1.0x)';
    showToast(`Playback Speed: ${label}`);
});

document.querySelectorAll('#bg-segmented .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#bg-segmented .seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentBg = btn.dataset.bg;
        if (currentBg === 'rings') {
            rings = [];
            spawnRing();
        }
    });
});

autoCamBtn?.addEventListener('click', () => {
    isAutoCam = !isAutoCam;
    autoCamBtn.classList.toggle('active', isAutoCam);
    if (!isAutoCam) {
        camera.position.set(0, 10, 60);
        camera.lookAt(0, 0, 0);
    }
    showToast(`Auto-Pilot Orbit: ${isAutoCam ? 'ACTIVE' : 'OFF'}`);
});

document.querySelectorAll('.color-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        document.querySelectorAll('.color-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentTheme = chip.dataset.theme;
        const th = THEMES[currentTheme];

        document.documentElement.style.setProperty('--accent', th.accent);
        document.documentElement.style.setProperty('--accent-glow', th.glow);

        const updateMat = (arr, total) => arr.forEach((b, idx) => {
            let col = th.color;
            if (th.isRainbow) col = new THREE.Color().setHSL(idx / total, 0.9, 0.55).getHex();
            b.material.color.setHex(col);
            b.material.emissive.setHex(col);
        });
        updateMat(pulseBars, pulseBars.length);
        updateMat(waveBars, waveBars.length);
        updateMat(vgridBars, vgridBars.length);

        if (orbMesh) {
            orbMesh.material.color.setHex(th.color);
            orbMesh.material.emissive.setHex(th.color);
        }

        const pl = scene.children.find(c => c.isPointLight);
        if (pl) pl.color.setHex(th.color);
    });
});

seekSlider?.addEventListener('input', e => {
    if (!curAudioEl?.duration) return;
    const pct = parseFloat(e.target.value);
    curAudioEl.currentTime = (pct / 100) * curAudioEl.duration;
    progressFill.style.width = pct + '%';
});

volSlider?.addEventListener('input', e => {
    const val = parseFloat(e.target.value) / 100;
    if (curAudioEl) curAudioEl.volume = val;
    if (masterGain && audioCtx) masterGain.gain.value = val;
});

let isMuted = false, prevVol = 100;
muteBtn?.addEventListener('click', () => {
    if (!curAudioEl) return;
    if (isMuted) {
        curAudioEl.volume = prevVol / 100;
        volSlider.value = prevVol;
        if (masterGain) masterGain.gain.value = prevVol / 100;
        isMuted = false;
    } else {
        prevVol = volSlider.value;
        curAudioEl.volume = 0;
        volSlider.value = 0;
        if (masterGain) masterGain.gain.value = 0;
        isMuted = true;
    }
});

document.getElementById('reset-cam-btn')?.addEventListener('click', () => {
    targetRotX = 0; targetRotY = 0;
    isAutoCam = false;
    autoCamBtn?.classList.remove('active');
    if (visualizerRoot) { visualizerRoot.rotation.x = 0; visualizerRoot.rotation.y = 0; }
    camera.position.set(0, 10, 60);
    camera.lookAt(0, 0, 0);
    showToast('3D Viewport Reset');
});

document.getElementById('fullscreen-btn')?.addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
});

const guideModal = document.getElementById('guide-modal');
document.getElementById('guide-btn')?.addEventListener('click',        () => { guideModal.style.display = 'flex'; });
document.getElementById('close-guide-btn')?.addEventListener('click',  () => { guideModal.style.display = 'none'; });
document.getElementById('dismiss-guide-btn')?.addEventListener('click',() => { guideModal.style.display = 'none'; });
guideModal?.addEventListener('click', e => { if (e.target === guideModal) guideModal.style.display = 'none'; });

window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    else if (e.code === 'KeyM') muteBtn?.click();
    else if (e.code === 'KeyR') document.getElementById('reset-cam-btn')?.click();
    else if (e.code === 'KeyF') document.getElementById('fullscreen-btn')?.click();
    else if (e.code === 'KeyU') fxMufflerBtn?.click();
    else if (e.code === 'KeyB') fxBassBtn?.click();
    else if (e.code === 'KeyA') autoCamBtn?.click();
    else if (e.key === '1') document.querySelector('.seg-btn[data-value="pulse"]')?.click();
    else if (e.key === '2') document.querySelector('.seg-btn[data-value="wave"]')?.click();
    else if (e.key === '3') document.querySelector('.seg-btn[data-value="grid"]')?.click();
    else if (e.key === '4') document.querySelector('.seg-btn[data-value="orb"]')?.click();
});

if (albumArt) albumArt.onerror = () => { albumArt.src = 'favicon.svg'; };

let isLightMode = localStorage.getItem('wibei_theme_mode') === 'light';
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const themeSunIcon   = document.querySelector('.theme-sun-icon');
const themeMoonIcon  = document.querySelector('.theme-moon-icon');

function applyThemeMode(light) {
    isLightMode = light;
    document.body.classList.toggle('light-mode', light);
    if (themeSunIcon && themeMoonIcon) {
        themeSunIcon.style.display  = light ? 'block' : 'none';
        themeMoonIcon.style.display = light ? 'none'  : 'block';
    }
    if (bloomPass) {
        bloomPass.threshold = light ? 0.16 : 0.08;
        bloomPass.strength  = light ? 1.05 : 1.35;
    }
    localStorage.setItem('wibei_theme_mode', light ? 'light' : 'dark');
}

themeToggleBtn?.addEventListener('click', () => {
    applyThemeMode(!isLightMode);
});

initThree();
applyThemeMode(isLightMode);
