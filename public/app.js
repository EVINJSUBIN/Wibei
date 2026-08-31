const bgCanvas = document.getElementById('bg-canvas');
const bgCtx = bgCanvas.getContext('2d');
let blocks = [];
let audioCtx, analyser, dataArr, audioSrc, curAudioEl;
let isPlaying = false;
let isMicActive = false;
let micStream = null;
let scene, camera, renderer, composer, bloomPass;

let visualizerRoot;
let pulseGrp, waveGrp, vgridGrp;
let pulseBars = [], waveBars = [], vgridBars = [];
let gridHelper;

const THEMES = {
    gold: { accent: '#facc15', glow: 'rgba(250, 204, 21, 0.35)', color: 0xfacc15 },
    cyan: { accent: '#06b6d4', glow: 'rgba(6, 182, 212, 0.35)', color: 0x06b6d4 },
    magenta: { accent: '#f43f5e', glow: 'rgba(244, 63, 94, 0.35)', color: 0xf43f5e }
};
let currentTheme = 'gold';
let currentVis = 'pulse';
let showGrid = true;
let bloomEnabled = true;
let bgBassLevel = 0;
let queue = [];

let mouseX = 0, mouseY = 0;
let targetRotX = 0, targetRotY = 0;
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

// FPS tracking
let lastFrameTime = performance.now();
let frameCount = 0;
let currentFps = 60;
const fpsCounter = document.getElementById('fps-counter');

// DOM Elements
const engineStatus = document.getElementById('engine-status');
const playBtn = document.getElementById('play-btn');
const iconPlay = document.querySelector('.icon-play');
const iconPause = document.querySelector('.icon-pause');
const seekSlider = document.getElementById('seek-slider');
const progressFill = document.getElementById('progress-fill');
const timeCurrent = document.getElementById('time-current');
const timeTotal = document.getElementById('time-total');
const volSlider = document.getElementById('vol-slider');
const volReadout = document.getElementById('vol-readout');
const muteBtn = document.getElementById('mute-btn');
const searchInp = document.getElementById('search-inp');
const searchBtn = document.getElementById('search-btn');
const suggBox = document.getElementById('suggestions-box');
const albumArt = document.getElementById('album-art');
const trackTitle = document.getElementById('track-title');
const trackArtist = document.getElementById('track-artist');
const miniEq = document.getElementById('mini-eq');
const vuLeds = document.querySelectorAll('.vu-led');
const activeSourceBadge = document.getElementById('active-source-badge');
const currentModeBadge = document.getElementById('current-mode-badge');

let toastTimer;
function showToast(msg, duration = 5000) {
    const banner = document.getElementById('toast-banner');
    const msgEl = document.getElementById('toast-msg');
    if (!banner || !msgEl) return;
    msgEl.innerText = msg;
    banner.style.display = 'flex';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        banner.style.display = 'none';
    }, duration);
}

document.getElementById('toast-close-btn')?.addEventListener('click', () => {
    const banner = document.getElementById('toast-banner');
    if (banner) banner.style.display = 'none';
});

function setEngineStatus(msg) {
    if (engineStatus) engineStatus.innerText = `ENGINE: ${msg}`;
}

function updatePlayIcons(playing) {
    isPlaying = playing;
    if (iconPlay && iconPause) {
        iconPlay.style.display = playing ? 'none' : 'block';
        iconPause.style.display = playing ? 'block' : 'none';
    }
    if (miniEq) {
        miniEq.style.display = playing ? 'flex' : 'none';
    }
    setEngineStatus(playing ? 'LIVE STREAM' : 'PAUSED');
}

function updateTrackInfo(title, artist, thumb) {
    if (trackTitle) trackTitle.innerText = title;
    if (trackArtist) trackArtist.innerText = artist;
    if (albumArt) {
        albumArt.src = thumb || 'favicon.svg';
    }
}

function resizeCanvas() {
    bgCanvas.width = window.innerWidth;
    bgCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function spawnBlock(randomY) {
    const sz = 10 + Math.random() * 25;
    blocks.push({
        x: Math.random() * bgCanvas.width,
        y: randomY ? Math.random() * bgCanvas.height : -sz,
        sz,
        dy: 0.3 + Math.random() * 0.8,
        rot: Math.random() * Math.PI * 2,
        rSpd: (Math.random() - 0.5) * 0.015,
        alpha: 0.03 + Math.random() * 0.08,
    });
}
for (let i = 0; i < 60; i++) spawnBlock(true);

function animateCanvas() {
    requestAnimationFrame(animateCanvas);
    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    
    if (!showGrid) return;

    const th = THEMES[currentTheme];
    const boost = 1 + bgBassLevel * 2.0;
    
    bgCtx.fillStyle = th.accent;
    bgCtx.strokeStyle = th.accent;
    
    blocks.forEach(b => {
        b.y += b.dy * boost;
        b.rot += b.rSpd * boost;
        if (b.y > bgCanvas.height + b.sz) {
            b.y = -b.sz;
            b.x = Math.random() * bgCanvas.width;
        }
        
        bgCtx.save();
        bgCtx.translate(b.x, b.y);
        bgCtx.rotate(b.rot);
        bgCtx.globalAlpha = b.alpha * (1 + bgBassLevel);
        bgCtx.lineWidth = 1;
        bgCtx.strokeRect(-b.sz/2, -b.sz/2, b.sz, b.sz);
        bgCtx.globalAlpha = b.alpha * 0.2;
        bgCtx.fillRect(-b.sz/2, -b.sz/2, b.sz, b.sz);
        bgCtx.restore();
    });
}
animateCanvas();

function initThree() {
    const container = document.getElementById('threejs-container');
    scene = new THREE.Scene();
    
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 8, 62);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const renderScene = new THREE.RenderPass(scene, camera);
    bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0.08;
    bloomPass.strength = 1.35;
    bloomPass.radius = 0.55;

    composer = new THREE.EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(THEMES[currentTheme].color, 2.5, 120);
    pointLight.position.set(0, 0, 20);
    scene.add(pointLight);

    gridHelper = new THREE.GridHelper(200, 40, THEMES[currentTheme].color, 0x1e293b);
    gridHelper.position.y = -15;
    scene.add(gridHelper);

    visualizerRoot = new THREE.Group();
    scene.add(visualizerRoot);

    const bGeo = new THREE.BoxGeometry(0.5, 1, 0.5);
    bGeo.translate(0, 0.5, 0);

    const bMat = new THREE.MeshStandardMaterial({ 
        color: THEMES[currentTheme].color, 
        emissive: THEMES[currentTheme].color,
        emissiveIntensity: 0.85,
        roughness: 0.2,
        metalness: 0.8
    });

    pulseGrp = new THREE.Group();
    const numBars = 128;
    const radius = 22;
    for (let i = 0; i < numBars; i++) {
        const mesh = new THREE.Mesh(bGeo, bMat.clone());
        const angle = (i / numBars) * Math.PI * 2;
        mesh.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
        mesh.rotation.z = angle - Math.PI / 2;
        pulseGrp.add(mesh);
        pulseBars.push(mesh);
    }
    visualizerRoot.add(pulseGrp);

    waveGrp = new THREE.Group();
    const waveNum = 64;
    for (let i = 0; i < waveNum; i++) {
        const mesh = new THREE.Mesh(bGeo, bMat.clone());
        mesh.position.set((i - waveNum / 2) * 1.25, -5, 0);
        waveGrp.add(mesh);
        waveBars.push(mesh);
    }
    waveGrp.visible = false;
    visualizerRoot.add(waveGrp);

    vgridGrp = new THREE.Group();
    const gridCols = 16;
    const gridRows = 8;
    for (let i = 0; i < gridCols * gridRows; i++) {
        const mesh = new THREE.Mesh(bGeo, bMat.clone());
        const x = (i % gridCols) - gridCols / 2;
        const z = Math.floor(i / gridCols) - gridRows / 2;
        mesh.position.set(x * 2.5, -10, z * 2.5);
        vgridGrp.add(mesh);
        vgridBars.push(mesh);
    }
    vgridGrp.visible = false;
    visualizerRoot.add(vgridGrp);

    window.addEventListener('mousemove', e => {
        mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        mouseY = -(e.clientY / window.innerHeight) * 2 + 1;

        if (isDragging) {
            const deltaX = e.clientX - previousMousePosition.x;
            const deltaY = e.clientY - previousMousePosition.y;
            targetRotY += deltaX * 0.006;
            targetRotX += deltaY * 0.006;
            previousMousePosition = { x: e.clientX, y: e.clientY };
        }
    });

    const isUIElement = el => el.closest('.studio-header, .studio-panel, .modal-overlay');

    window.addEventListener('mousedown', e => {
        if (!isUIElement(e.target)) {
            isDragging = true;
            previousMousePosition = { x: e.clientX, y: e.clientY };
        }
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
    });

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        composer.setSize(window.innerWidth, window.innerHeight);
    });

    threeAnimate();
}

function threeAnimate() {
    requestAnimationFrame(threeAnimate);
    const now = performance.now();
    const time = now * 0.001;

    // FPS calculation
    frameCount++;
    if (now - lastFrameTime >= 1000) {
        currentFps = Math.round((frameCount * 1000) / (now - lastFrameTime));
        if (fpsCounter) fpsCounter.innerText = `${currentFps} FPS`;
        frameCount = 0;
        lastFrameTime = now;
    }

    const parallaxX = mouseX * 0.15;
    const parallaxY = mouseY * 0.15;
    if (visualizerRoot) {
        visualizerRoot.rotation.y += (targetRotY + parallaxX - visualizerRoot.rotation.y) * 0.08;
        visualizerRoot.rotation.x += (targetRotX - parallaxY - visualizerRoot.rotation.x) * 0.08;
    }

    let hasAudio = false;
    let totalEnergy = 0;

    if ((isPlaying || isMicActive) && analyser && dataArr) {
        analyser.getByteFrequencyData(dataArr);
        for (let i = 0; i < dataArr.length; i++) {
            totalEnergy += dataArr[i];
        }
        if (totalEnergy > 100) {
            hasAudio = true;
        }
    }

    // Hardware VU Meter updates
    const avgVolume = hasAudio ? (totalEnergy / (dataArr.length * 255)) : 0;
    const activeLedsCount = Math.round(avgVolume * 8);
    vuLeds.forEach((led, idx) => {
        if (idx < activeLedsCount) {
            led.classList.add('active');
        } else {
            led.classList.remove('active');
        }
    });

    if (hasAudio) {
        let bassSum = 0;
        for (let i = 0; i < 8; i++) bassSum += dataArr[i];
        bgBassLevel = (bassSum / 8) / 255;

        if (currentVis === 'pulse') {
            const half = pulseBars.length / 2;
            for (let i = 0; i < pulseBars.length; i++) {
                const symIdx = i < half ? i : pulseBars.length - 1 - i;
                const freqBin = Math.min(dataArr.length - 1, Math.floor((symIdx / half) * (dataArr.length * 0.7)));
                const val = dataArr[freqBin] || 0;
                
                const targetScale = Math.max(0.8, 1 + (val / 255) * 16);
                pulseBars[i].scale.y += (targetScale - pulseBars[i].scale.y) * 0.25;
            }
        } 
        else if (currentVis === 'wave') {
            for (let i = 0; i < waveBars.length; i++) {
                const freqBin = Math.floor((i / waveBars.length) * (dataArr.length * 0.65));
                const val = dataArr[freqBin] || 0;
                const targetScale = Math.max(0.8, 1 + (val / 255) * 18);
                waveBars[i].scale.y += (targetScale - waveBars[i].scale.y) * 0.25;
            }
        } 
        else if (currentVis === 'grid') {
            for (let i = 0; i < vgridBars.length; i++) {
                const freqBin = Math.floor((i / vgridBars.length) * (dataArr.length * 0.55));
                const val = dataArr[freqBin] || 0;
                const targetScale = Math.max(0.6, 1 + (val / 255) * 12);
                vgridBars[i].scale.y += (targetScale - vgridBars[i].scale.y) * 0.25;
            }
        }
    } else {
        bgBassLevel *= 0.95;

        if (currentVis === 'pulse') {
            const numBars = pulseBars.length;
            for (let i = 0; i < numBars; i++) {
                const angle = (i / numBars) * Math.PI * 2;
                const harmonicWave = Math.sin(angle * 3 + time * 1.5) * 0.45 
                                   + Math.sin(angle * 2 - time * 0.9) * 0.35 
                                   + Math.sin(angle * 5 + time * 2.2) * 0.15;
                const breathe = 1.35 + Math.sin(time * 1.2) * 0.2;
                const targetScale = Math.max(0.7, breathe + harmonicWave);
                pulseBars[i].scale.y += (targetScale - pulseBars[i].scale.y) * 0.12;
            }
        } 
        else if (currentVis === 'wave') {
            for (let i = 0; i < waveBars.length; i++) {
                const norm = i / waveBars.length;
                const wave = Math.sin(norm * Math.PI * 2 + time * 2.0) * 0.55 
                           + Math.sin(norm * Math.PI * 4 - time * 1.3) * 0.25;
                const targetScale = Math.max(0.7, 1.3 + wave);
                waveBars[i].scale.y += (targetScale - waveBars[i].scale.y) * 0.12;
            }
        } 
        else if (currentVis === 'grid') {
            for (let i = 0; i < vgridBars.length; i++) {
                const x = (i % 16) - 7.5;
                const z = Math.floor(i / 16) - 3.5;
                const dist = Math.sqrt(x * x + z * z);
                const ripple = Math.sin(dist * 0.7 - time * 2.5) * 0.5 + Math.cos(x * 0.3 + time) * 0.2;
                const targetScale = Math.max(0.6, 1.1 + ripple);
                vgridBars[i].scale.y += (targetScale - vgridBars[i].scale.y) * 0.12;
            }
        }
    }

    if (showGrid && gridHelper) {
        gridHelper.position.z = (performance.now() * 0.012) % 5;
    }
    
    composer.render();
}

function ensureAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function attachAudioElement(el) {
    if (audioSrc) {
        try { audioSrc.disconnect(); } catch (e) {}
    }
    audioSrc = audioCtx.createMediaElementSource(el);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.88;
    dataArr = new Uint8Array(analyser.frequencyBinCount);
    audioSrc.connect(analyser);
    analyser.connect(audioCtx.destination);
}

function stopMic() {
    if (micStream) {
        micStream.getTracks().forEach(t => t.stop());
        micStream = null;
    }
    isMicActive = false;
}

function playNext() {
    if (queue.length > 0) {
        const nextQuery = queue.shift();
        if (nextQuery.src) {
            playDirectAudio(nextQuery.src, nextQuery.title, nextQuery.artist);
        } else {
            playStream(nextQuery.url || nextQuery, nextQuery);
        }
    } else {
        updatePlayIcons(false);
        setEngineStatus('IDLE');
    }
}

function playDirectAudio(src, title, artist) {
    stopMic();
    updateTrackInfo(title, artist, null);

    if (curAudioEl) {
        curAudioEl.pause();
        curAudioEl.src = '';
    }

    curAudioEl = new Audio();
    curAudioEl.crossOrigin = 'anonymous';
    curAudioEl.src = src;

    curAudioEl.oncanplay = () => {
        ensureAudioCtx();
        attachAudioElement(curAudioEl);
        curAudioEl.play().catch(() => {});
        updatePlayIcons(true);
        setEngineStatus('PLAYING');
    };

    curAudioEl.ontimeupdate = () => {
        if (!curAudioEl.duration) return;
        const pct = (curAudioEl.currentTime / curAudioEl.duration) * 100;
        seekSlider.value = pct;
        progressFill.style.width = pct + '%';
        const fmt = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
        timeCurrent.innerText = fmt(curAudioEl.currentTime);
        timeTotal.innerText = fmt(curAudioEl.duration);
    };

    curAudioEl.onerror = () => {
        updatePlayIcons(false);
        setEngineStatus('ERROR');
    };

    curAudioEl.onended = playNext;
}

async function playStream(query, presetMeta = null) {
    if (!query) return;
    
    if (isPlaying && curAudioEl && !curAudioEl.paused && curAudioEl.src && !curAudioEl.src.includes('blob:')) {
        queue.push(presetMeta || { title: query, url: query });
        showToast(`Queued: ${presetMeta?.title || query}`);
        return;
    }

    stopMic();
    setEngineStatus('CONNECTING');
    updateTrackInfo(presetMeta?.title || 'Loading...', presetMeta?.uploader || 'Streaming audio', presetMeta?.thumbnail);
    
    try {
        let meta = presetMeta;
        if (!meta) {
            const metaRes = await fetch(`/metadata?url=${encodeURIComponent(query)}`);
            meta = await metaRes.json();
        }
        
        updateTrackInfo(meta.title || query, meta.uploader || 'Unknown Artist', meta.thumbnail);

        if (curAudioEl) {
            curAudioEl.pause();
            curAudioEl.src = '';
        }
        
        curAudioEl = new Audio();
        curAudioEl.crossOrigin = 'anonymous';
        curAudioEl.src = `/stream?url=${encodeURIComponent(query)}`;
        
        curAudioEl.oncanplay = () => {
            ensureAudioCtx();
            attachAudioElement(curAudioEl);
            curAudioEl.play().catch(() => {});
            updatePlayIcons(true);
            setEngineStatus('PLAYING');
        };
        
        curAudioEl.ontimeupdate = () => {
            if (!curAudioEl.duration) return;
            const pct = (curAudioEl.currentTime / curAudioEl.duration) * 100;
            seekSlider.value = pct;
            progressFill.style.width = pct + '%';
            
            const fmt = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
            timeCurrent.innerText = fmt(curAudioEl.currentTime);
            timeTotal.innerText = fmt(curAudioEl.duration);
        };

        curAudioEl.onerror = () => {
            updatePlayIcons(false);
            setEngineStatus('STREAM BLOCKED');
            showToast('⚠️ YouTube bot-check on cloud! Use PRESETS or UPLOAD (MP3).');
            updateTrackInfo('Stream Blocked by YouTube', 'Select Presets or Local Audio', null);
        };

        curAudioEl.onended = playNext;
        
    } catch (err) {
        updatePlayIcons(false);
        setEngineStatus('STREAM ERROR');
        showToast('⚠️ YouTube bot-check on cloud! Use PRESETS or UPLOAD (MP3).');
        updateTrackInfo('Playback Error', 'Select Presets or Local Audio', null);
    }
}

// ----------------------------------------------------
// UI Interactions
// ----------------------------------------------------
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

// Audio Source Tabs
document.querySelectorAll('.source-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.source-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const targetTab = tab.dataset.tab;
        document.getElementById('tab-presets').style.display = targetTab === 'presets' ? 'block' : 'none';
        document.getElementById('tab-search').style.display = targetTab === 'search' ? 'block' : 'none';
        document.getElementById('tab-mic').style.display = targetTab === 'mic' ? 'block' : 'none';
        document.getElementById('tab-file').style.display = targetTab === 'file' ? 'block' : 'none';
    });
});

// Preset Channel Cards
document.querySelectorAll('.channel-card').forEach(card => {
    card.addEventListener('click', () => {
        document.querySelectorAll('.channel-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        const ch = card.dataset.ch;
        if (activeSourceBadge) activeSourceBadge.innerText = `${ch}: PRESET`;
        playDirectAudio(card.dataset.src, card.dataset.title, card.dataset.artist);
    });
});

// Search & YouTube Suggestions
let suggTimer;
const doSearch = () => {
    const q = searchInp.value.trim();
    if (q) {
        if (activeSourceBadge) activeSourceBadge.innerText = 'CH: SEARCH';
        playStream(q);
    }
    searchInp.value = '';
    if (suggBox) suggBox.style.display = 'none';
};

searchBtn.addEventListener('click', doSearch);
searchInp.addEventListener('keypress', e => { if (e.key === 'Enter') doSearch(); });

searchInp.addEventListener('input', () => {
    clearTimeout(suggTimer);
    const q = searchInp.value.trim();
    if (!q || !suggBox) { 
        if (suggBox) suggBox.style.display = 'none'; 
        return; 
    }
    suggTimer = setTimeout(async () => {
        try {
            const res = await fetch('/api/search?q=' + encodeURIComponent(q));
            const data = await res.json();
            suggBox.innerHTML = '';
            if (!data || data.length === 0) { 
                suggBox.style.display = 'none'; 
                return; 
            }
            data.forEach(item => {
                const card = document.createElement('div');
                card.className = 'suggestion-card';
                
                const thumbImg = item.thumbnail 
                    ? `<img class="suggestion-thumb" src="${item.thumbnail}" alt="">`
                    : `<div class="suggestion-thumb" style="display:flex;align-items:center;justify-content:center;background:#18181b;color:#facc15;font-size:12px;">🎵</div>`;

                card.innerHTML = `
                    ${thumbImg}
                    <div class="suggestion-details">
                        <div class="suggestion-title">${item.title}</div>
                        <div class="suggestion-channel">${item.uploader}</div>
                    </div>
                `;

                card.onclick = () => {
                    suggBox.style.display = 'none';
                    searchInp.value = '';
                    if (activeSourceBadge) activeSourceBadge.innerText = 'CH: SEARCH';
                    playStream(item.url, item);
                };
                suggBox.appendChild(card);
            });
            suggBox.style.display = 'flex';
        } catch (e) {}
    }, 200);
});

document.addEventListener('click', e => {
    if (suggBox && !searchInp.contains(e.target) && !suggBox.contains(e.target)) {
        suggBox.style.display = 'none';
    }
});

// Mic Input
document.getElementById('mic-btn')?.addEventListener('click', async () => {
    try {
        if (curAudioEl) {
            curAudioEl.pause();
            updatePlayIcons(false);
        }
        ensureAudioCtx();
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        isMicActive = true;
        updatePlayIcons(true);
        
        if (activeSourceBadge) activeSourceBadge.innerText = 'CH: MIC IN';
        updateTrackInfo('Live Microphone', 'Acoustic Input Active', null);
        
        const source = audioCtx.createMediaStreamSource(micStream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.85;
        dataArr = new Uint8Array(analyser.frequencyBinCount);
        source.connect(analyser);
    } catch (err) {
        showToast('Microphone access denied');
    }
});

// File Upload
const fileUpload = document.getElementById('file-upload');
document.getElementById('upload-btn')?.addEventListener('click', () => fileUpload?.click());
fileUpload?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    
    stopMic();
    if (activeSourceBadge) activeSourceBadge.innerText = 'CH: LOCAL FILE';
    updateTrackInfo(file.name, 'Local Audio Stem', null);
    
    if (curAudioEl) {
        curAudioEl.pause();
        curAudioEl.src = '';
    }
    
    curAudioEl = new Audio();
    curAudioEl.src = URL.createObjectURL(file);
    curAudioEl.oncanplay = () => {
        ensureAudioCtx();
        attachAudioElement(curAudioEl);
        curAudioEl.play();
        updatePlayIcons(true);
    };
    curAudioEl.ontimeupdate = () => {
        if (!curAudioEl.duration) return;
        const pct = (curAudioEl.currentTime / curAudioEl.duration) * 100;
        seekSlider.value = pct;
        progressFill.style.width = pct + '%';
        const fmt = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
        timeCurrent.innerText = fmt(curAudioEl.currentTime);
        timeTotal.innerText = fmt(curAudioEl.duration);
    };
    curAudioEl.onended = playNext;
});

// Visual Matrix Geometry Buttons
document.querySelectorAll('.matrix-btn').forEach((btn, idx) => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.matrix-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentVis = btn.dataset.value;
        pulseGrp.visible = (currentVis === 'pulse');
        waveGrp.visible = (currentVis === 'wave');
        vgridGrp.visible = (currentVis === 'grid');
        if (currentModeBadge) currentModeBadge.innerText = `MODE: 0${idx + 1}`;
    });
});

// Grid Toggle
const bgGridToggle = document.getElementById('bg-grid-toggle');
bgGridToggle.addEventListener('click', () => {
    showGrid = !showGrid;
    bgGridToggle.classList.toggle('active', showGrid);
    bgGridToggle.innerText = `SYNTH GRID: ${showGrid ? 'ON' : 'OFF'}`;
    if (gridHelper) gridHelper.visible = showGrid;
});

// Bloom Toggle
const bloomToggle = document.getElementById('bloom-toggle');
bloomToggle.addEventListener('click', () => {
    bloomEnabled = !bloomEnabled;
    bloomToggle.classList.toggle('active', bloomEnabled);
    bloomToggle.innerText = `BLOOM: ${bloomEnabled ? 'HIGH' : 'OFF'}`;
    if (bloomPass) bloomPass.strength = bloomEnabled ? 1.35 : 0.0;
});

// Theme Wavelength Buttons
document.querySelectorAll('.wavelength-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.wavelength-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTheme = btn.dataset.theme;
        const th = THEMES[currentTheme];
        
        document.documentElement.style.setProperty('--accent', th.accent);
        document.documentElement.style.setProperty('--accent-glow', th.glow);
        
        const updateMaterial = arr => {
            arr.forEach(b => {
                b.material.color.setHex(th.color);
                b.material.emissive.setHex(th.color);
            });
        };
        
        updateMaterial(pulseBars);
        updateMaterial(waveBars);
        updateMaterial(vgridBars);
        
        if (gridHelper) gridHelper.material.color.setHex(th.color);
        const pl = scene.children.find(c => c.isPointLight);
        if (pl) pl.color.setHex(th.color);
    });
});

// Scrubber & Volume Controls
seekSlider.addEventListener('input', e => {
    if (!curAudioEl || !curAudioEl.duration) return;
    const pct = parseFloat(e.target.value);
    curAudioEl.currentTime = (pct / 100) * curAudioEl.duration;
    progressFill.style.width = pct + '%';
});

volSlider.addEventListener('input', e => {
    const val = parseFloat(e.target.value);
    if (curAudioEl) curAudioEl.volume = val / 100;
    if (volReadout) volReadout.innerText = `${Math.round(val)}%`;
});

let isMuted = false;
let prevVol = 100;
muteBtn.addEventListener('click', () => {
    if (!curAudioEl) return;
    if (isMuted) {
        curAudioEl.volume = prevVol / 100;
        volSlider.value = prevVol;
        if (volReadout) volReadout.innerText = `${Math.round(prevVol)}%`;
        isMuted = false;
    } else {
        prevVol = volSlider.value;
        curAudioEl.volume = 0;
        volSlider.value = 0;
        if (volReadout) volReadout.innerText = '0%';
        isMuted = true;
    }
});

// Reset Camera
document.getElementById('reset-cam-btn')?.addEventListener('click', () => {
    targetRotX = 0;
    targetRotY = 0;
    if (visualizerRoot) {
        visualizerRoot.rotation.x = 0;
        visualizerRoot.rotation.y = 0;
    }
    camera.position.set(0, 8, 62);
    camera.lookAt(0, 0, 0);
    showToast('3D Camera Reset');
});

// Fullscreen
document.getElementById('fullscreen-btn')?.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen().catch(() => {});
    }
});

// Modals
const guideModal = document.getElementById('guide-modal');
const shortcutsModal = document.getElementById('shortcuts-modal');

document.getElementById('guide-btn')?.addEventListener('click', () => {
    guideModal.style.display = 'flex';
});
document.getElementById('close-guide-btn')?.addEventListener('click', () => {
    guideModal.style.display = 'none';
});
document.getElementById('dismiss-guide-btn')?.addEventListener('click', () => {
    guideModal.style.display = 'none';
});
guideModal?.addEventListener('click', e => {
    if (e.target === guideModal) guideModal.style.display = 'none';
});

document.getElementById('shortcuts-btn')?.addEventListener('click', () => {
    shortcutsModal.style.display = 'flex';
});
document.getElementById('close-modal-btn')?.addEventListener('click', () => {
    shortcutsModal.style.display = 'none';
});
shortcutsModal?.addEventListener('click', e => {
    if (e.target === shortcutsModal) shortcutsModal.style.display = 'none';
});

// Keyboard Shortcuts Listeners
window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    
    if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
    } else if (e.code === 'KeyM') {
        muteBtn.click();
    } else if (e.code === 'KeyR') {
        document.getElementById('reset-cam-btn')?.click();
    } else if (e.code === 'KeyF') {
        document.getElementById('fullscreen-btn')?.click();
    } else if (e.key === '1') {
        document.querySelector('.matrix-btn[data-value="pulse"]')?.click();
    } else if (e.key === '2') {
        document.querySelector('.matrix-btn[data-value="wave"]')?.click();
    } else if (e.key === '3') {
        document.querySelector('.matrix-btn[data-value="grid"]')?.click();
    }
});

initThree();
