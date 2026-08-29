const bgCanvas = document.getElementById('bg-canvas');
const bgCtx = bgCanvas.getContext('2d');
let blocks = [];
let audioCtx, analyser, dataArr, audioSrc, curAudioEl;
let isPlaying = false;
let isMicActive = false;
let micStream = null;
let scene, camera, renderer, composer;

let visualizerRoot;
let pulseGrp, waveGrp, vgridGrp;
let pulseBars = [], waveBars = [], vgridBars = [];
let gridHelper;

const THEMES = {
    gold: { accent: '#facc15', color: 0xfacc15, bg: '#06070a' },
    cyan: { accent: '#00e5ff', color: 0x00e5ff, bg: '#020617' },
    magenta: { accent: '#ec4899', color: 0xec4899, bg: '#11030e' }
};
let currentTheme = 'gold';
let currentVis = 'pulse';
let currentBg = 'synth';
let bgBassLevel = 0;
let queue = [];

let mouseX = 0, mouseY = 0;
let targetRotX = 0, targetRotY = 0;
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

const logsContent = document.getElementById('logs-content');
const logsPanel = document.getElementById('logs-panel');

function addLog(msg, type = 'info') {
    if (!logsContent) return;
    const d = document.createElement('div');
    d.style.marginBottom = '4px';
    const color = type === 'error' ? '#ef4444' : (type === 'ok' ? '#10b981' : '#a1a1aa');
    d.innerHTML = `<span style="color:#52525b">[${new Date().toLocaleTimeString()}]</span> <span style="color:${color}">${msg}</span>`;
    logsContent.appendChild(d);
    logsContent.scrollTop = logsContent.scrollHeight;
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
        dy: 0.4 + Math.random() * 1.2,
        rot: Math.random() * Math.PI * 2,
        rSpd: (Math.random() - 0.5) * 0.02,
        alpha: 0.04 + Math.random() * 0.12,
    });
}
for (let i = 0; i < 80; i++) spawnBlock(true);

function animateCanvas() {
    requestAnimationFrame(animateCanvas);
    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    
    if (currentBg === 'none') return;

    const th = THEMES[currentTheme];
    const boost = 1 + bgBassLevel * 2.2;
    
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
        bgCtx.globalAlpha = b.alpha * 0.25;
        bgCtx.fillRect(-b.sz/2, -b.sz/2, b.sz, b.sz);
        bgCtx.restore();
    });
}
animateCanvas();

function initThree() {
    const container = document.getElementById('threejs-container');
    scene = new THREE.Scene();
    
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 10, 60);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const renderScene = new THREE.RenderPass(scene, camera);
    const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
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

    const isUIElement = el => el.closest('.top-nav, .player-container, #logs-panel');

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
    const time = performance.now() * 0.001;

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

    if (currentBg === 'synth' && gridHelper) {
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
        addLog(`Playing next in queue: ${nextQuery.title || nextQuery}`, 'ok');
        playStream(nextQuery.url || nextQuery);
    } else {
        isPlaying = false;
        document.getElementById('play-btn').innerText = '▶';
        addLog('Playback finished', 'info');
    }
}

async function playStream(query, presetMeta = null) {
    if (!query) return;
    
    if (isPlaying && curAudioEl && !curAudioEl.paused && curAudioEl.src && !curAudioEl.src.includes('blob:')) {
        queue.push(presetMeta || { title: query, url: query });
        addLog(`Added to queue: "${presetMeta?.title || query}" (Position: ${queue.length})`, 'ok');
        return;
    }

    stopMic();
    addLog(`Loading track: "${presetMeta?.title || query}"...`);
    document.getElementById('track-title').innerText = presetMeta?.title || 'Loading...';
    document.getElementById('track-artist').innerText = presetMeta?.uploader || 'Connecting stream';
    if (presetMeta?.thumbnail) {
        document.getElementById('album-art').src = presetMeta.thumbnail;
    }
    
    try {
        let meta = presetMeta;
        if (!meta) {
            const metaRes = await fetch(`/metadata?url=${encodeURIComponent(query)}`);
            meta = await metaRes.json();
        }
        
        document.getElementById('track-title').innerText = meta.title || query;
        document.getElementById('track-artist').innerText = meta.uploader || 'Unknown Artist';
        if (meta.thumbnail) {
            document.getElementById('album-art').src = meta.thumbnail;
        }

        if (curAudioEl) {
            curAudioEl.pause();
            curAudioEl.src = '';
        }
        
        curAudioEl = new Audio();
        curAudioEl.crossOrigin = 'anonymous';
        curAudioEl.src = `/stream?url=${encodeURIComponent(query)}`;
        
        curAudioEl.oncanplay = () => {
            ensureAudioCtx();
            if (!audioSrc) {
                audioSrc = audioCtx.createMediaElementSource(curAudioEl);
                analyser = audioCtx.createAnalyser();
                analyser.fftSize = 256;
                analyser.smoothingTimeConstant = 0.88;
                dataArr = new Uint8Array(analyser.frequencyBinCount);
                audioSrc.connect(analyser);
                analyser.connect(audioCtx.destination);
            }
            curAudioEl.play().catch(e => addLog(`Autoplay prevented: ${e.message}`, 'error'));
            isPlaying = true;
            document.getElementById('play-btn').innerText = '⏸';
            addLog(`Now playing: ${meta.title || query}`, 'ok');
        };
        
        curAudioEl.ontimeupdate = () => {
            if (!curAudioEl.duration) return;
            const pct = (curAudioEl.currentTime / curAudioEl.duration) * 100;
            document.getElementById('seek-slider').value = pct;
            document.getElementById('progress-fill').style.width = pct + '%';
            
            const fmt = s => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
            document.getElementById('time-current').innerText = fmt(curAudioEl.currentTime);
            document.getElementById('time-total').innerText = fmt(curAudioEl.duration);
        };

        curAudioEl.onended = playNext;
        
    } catch (err) {
        addLog(`Stream error: ${err.message}`, 'error');
        document.getElementById('track-title').innerText = 'Playback Error';
    }
}

document.getElementById('play-btn').addEventListener('click', () => {
    if (isMicActive) return;
    if (!curAudioEl || !curAudioEl.src) {
        addLog('Search for a song or upload an MP3 first!', 'info');
        return;
    }
    if (curAudioEl.paused) {
        ensureAudioCtx();
        curAudioEl.play();
        isPlaying = true;
        document.getElementById('play-btn').innerText = '⏸';
    } else {
        curAudioEl.pause();
        isPlaying = false;
        document.getElementById('play-btn').innerText = '▶';
    }
});

document.getElementById('seek-slider').addEventListener('input', e => {
    if (!curAudioEl || !curAudioEl.duration) return;
    const pct = parseFloat(e.target.value);
    curAudioEl.currentTime = (pct / 100) * curAudioEl.duration;
    document.getElementById('progress-fill').style.width = pct + '%';
});

document.getElementById('vol-slider').addEventListener('input', e => {
    if (curAudioEl) curAudioEl.volume = parseFloat(e.target.value) / 100;
});

const searchInp = document.getElementById('search-inp');
const searchBtn = document.getElementById('search-btn');
const suggBox = document.getElementById('suggestions-box');
let suggTimer;

const doSearch = () => {
    const q = searchInp.value.trim();
    if (q) playStream(q);
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
                    : `<div class="suggestion-thumb" style="display:flex;align-items:center;justify-content:center;background:#27272a;color:#facc15">🎵</div>`;

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
                    playStream(item.url, item);
                };
                suggBox.appendChild(card);
            });
            suggBox.style.display = 'flex';
        } catch (e) {
            console.error(e);
        }
    }, 200);
});

document.addEventListener('click', e => {
    if (suggBox && !searchInp.contains(e.target) && !suggBox.contains(e.target)) {
        suggBox.style.display = 'none';
    }
});

document.getElementById('mic-btn')?.addEventListener('click', async () => {
    try {
        if (curAudioEl) {
            curAudioEl.pause();
            isPlaying = false;
            document.getElementById('play-btn').innerText = '▶';
        }
        ensureAudioCtx();
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        isMicActive = true;
        isPlaying = true;
        
        document.getElementById('track-title').innerText = 'Microphone Live';
        document.getElementById('track-artist').innerText = 'Listening to input...';
        addLog('Microphone connected and listening', 'ok');
        
        const source = audioCtx.createMediaStreamSource(micStream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.85;
        dataArr = new Uint8Array(analyser.frequencyBinCount);
        source.connect(analyser);
    } catch (err) {
        addLog(`Microphone access denied: ${err.message}`, 'error');
    }
});

const fileUpload = document.getElementById('file-upload');
document.getElementById('upload-btn')?.addEventListener('click', () => fileUpload?.click());
fileUpload?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    
    stopMic();
    addLog(`Loading local audio file: ${file.name}`, 'ok');
    
    document.getElementById('track-title').innerText = file.name;
    document.getElementById('track-artist').innerText = 'Local File';
    
    if (curAudioEl) {
        curAudioEl.pause();
        curAudioEl.src = '';
    }
    
    curAudioEl = new Audio();
    curAudioEl.src = URL.createObjectURL(file);
    curAudioEl.oncanplay = () => {
        ensureAudioCtx();
        if (!audioSrc) {
            audioSrc = audioCtx.createMediaElementSource(curAudioEl);
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.88;
            dataArr = new Uint8Array(analyser.frequencyBinCount);
            audioSrc.connect(analyser);
            analyser.connect(audioCtx.destination);
        }
        curAudioEl.play();
        isPlaying = true;
        document.getElementById('play-btn').innerText = '⏸';
    };
    curAudioEl.ontimeupdate = () => {
        if (!curAudioEl.duration) return;
        const pct = (curAudioEl.currentTime / curAudioEl.duration) * 100;
        document.getElementById('seek-slider').value = pct;
        document.getElementById('progress-fill').style.width = pct + '%';
        const fmt = s => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
        document.getElementById('time-current').innerText = fmt(curAudioEl.currentTime);
        document.getElementById('time-total').innerText = fmt(curAudioEl.duration);
    };
    curAudioEl.onended = playNext;
});

document.querySelector('.logs-btn')?.addEventListener('click', () => {
    if (!logsPanel) return;
    logsPanel.style.display = logsPanel.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('vis-sel').addEventListener('change', e => {
    currentVis = e.target.value;
    pulseGrp.visible = (currentVis === 'pulse');
    waveGrp.visible = (currentVis === 'wave');
    vgridGrp.visible = (currentVis === 'grid');
    addLog(`Changed Visualizer Style to: ${e.target.options[e.target.selectedIndex].text}`);
});

document.getElementById('bg-sel').addEventListener('change', e => {
    currentBg = e.target.value;
    if (gridHelper) gridHelper.visible = (currentBg === 'synth');
    addLog(`Changed Background to: ${e.target.options[e.target.selectedIndex].text}`);
});

document.getElementById('theme-sel').addEventListener('change', e => {
    currentTheme = e.target.value;
    const th = THEMES[currentTheme];
    document.documentElement.style.setProperty('--accent', th.accent);
    
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
    addLog(`Changed Theme to: ${currentTheme.toUpperCase()}`);
});

const albumArt = document.getElementById('album-art');
if (albumArt) {
    albumArt.onerror = () => {
        albumArt.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="%2318181b"><rect width="100" height="100"/><text x="50" y="55" font-size="32" text-anchor="middle" fill="%23facc15">🎵</text></svg>';
    };
    albumArt.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="%2318181b"><rect width="100" height="100"/><text x="50" y="55" font-size="32" text-anchor="middle" fill="%23facc15">🎵</text></svg>';
}

document.getElementById('back-btn')?.addEventListener('click', () => {
    targetRotX = 0;
    targetRotY = 0;
    if (visualizerRoot) {
        visualizerRoot.rotation.x = 0;
        visualizerRoot.rotation.y = 0;
    }
    camera.position.set(0, 10, 60);
    camera.lookAt(0, 0, 0);
    addLog('3D View angle reset', 'info');
});

initThree();
addLog('Wibei visualizer initialized and ready', 'ok');
