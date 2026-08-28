const bgCanvas = document.getElementById('bg-canvas');
const bgCtx = bgCanvas.getContext('2d');
let blocks = [];
let audioCtx, analyser, dataArr, audioSrc, curAudioEl;
let isPlaying = false;
let scene, camera, renderer, composer;

// Visualizer Groups
let pulseGrp, waveGrp, vgridGrp;
let pulseBars = [], waveBars = [], vgridBars = [];
let gridHelper; // Background floor grid

const THEMES = {
    gold: { accent: '#facc15', color: 0xfacc15, bg: '#06070a' },
    cyan: { accent: '#00e5ff', color: 0x00e5ff, bg: '#020617' },
    magenta: { accent: '#ec4899', color: 0xec4899, bg: '#11030e' }
};
let currentTheme = 'gold';
let currentVis = 'pulse';
let currentBg = 'synth';
let bgBassLevel = 0;

// Setup Background Canvas
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
        dy: 0.5 + Math.random() * 1.5,
        rot: Math.random() * Math.PI * 2,
        rSpd: (Math.random() - 0.5) * 0.02,
        alpha: 0.05 + Math.random() * 0.15,
    });
}
for(let i=0; i<80; i++) spawnBlock(true);

function animateCanvas() {
    requestAnimationFrame(animateCanvas);
    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    
    if (currentBg === 'none') return; // Hide floating squares if BG is none

    const th = THEMES[currentTheme];
    const boost = 1 + bgBassLevel * 2;
    
    bgCtx.fillStyle = th.accent;
    bgCtx.strokeStyle = th.accent;
    
    blocks.forEach(b => {
        b.y += b.dy * boost;
        b.rot += b.rSpd * boost;
        if(b.y > bgCanvas.height + b.sz) {
            b.y = -b.sz;
            b.x = Math.random() * bgCanvas.width;
        }
        
        bgCtx.save();
        bgCtx.translate(b.x, b.y);
        bgCtx.rotate(b.rot);
        bgCtx.globalAlpha = b.alpha * (1 + bgBassLevel);
        bgCtx.lineWidth = 1;
        bgCtx.strokeRect(-b.sz/2, -b.sz/2, b.sz, b.sz);
        bgCtx.globalAlpha = b.alpha * 0.3;
        bgCtx.fillRect(-b.sz/2, -b.sz/2, b.sz, b.sz);
        bgCtx.restore();
    });
}
animateCanvas();

// ThreeJS Setup
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
    bloomPass.threshold = 0.1;
    bloomPass.strength = 1.2;
    bloomPass.radius = 0.5;

    composer = new THREE.EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(THEMES[currentTheme].color, 2, 100);
    pointLight.position.set(0, 0, 20);
    scene.add(pointLight);

    // Grid Floor (Background)
    gridHelper = new THREE.GridHelper(200, 40, THEMES[currentTheme].color, 0x1e293b);
    gridHelper.position.y = -15;
    scene.add(gridHelper);

    // Base Material for all visualizers
    const bMat = new THREE.MeshStandardMaterial({ 
        color: THEMES[currentTheme].color, 
        emissive: THEMES[currentTheme].color,
        emissiveIntensity: 0.8 
    });
    const bGeo = new THREE.BoxGeometry(0.5, 1, 0.5);
    bGeo.translate(0, 0.5, 0);

    // 1. Pulse Ring
    pulseGrp = new THREE.Group();
    const numBars = 128;
    const radius = 22;
    for(let i=0; i<numBars; i++) {
        const mesh = new THREE.Mesh(bGeo, bMat);
        const angle = (i / numBars) * Math.PI * 2;
        mesh.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
        mesh.rotation.z = angle - Math.PI/2;
        pulseGrp.add(mesh);
        pulseBars.push(mesh);
    }
    scene.add(pulseGrp);

    // 2. Wave (Linear)
    waveGrp = new THREE.Group();
    const waveNum = 64;
    for(let i=0; i<waveNum; i++) {
        const mesh = new THREE.Mesh(bGeo, bMat);
        mesh.position.set((i - waveNum/2) * 1.2, -5, 0);
        waveGrp.add(mesh);
        waveBars.push(mesh);
    }
    waveGrp.visible = false;
    scene.add(waveGrp);

    // 3. Grid Visualizer (Matrix)
    vgridGrp = new THREE.Group();
    const gridCols = 16;
    const gridRows = 8;
    for(let i=0; i<gridCols * gridRows; i++) {
        const mesh = new THREE.Mesh(bGeo, bMat);
        const x = (i % gridCols) - gridCols/2;
        const z = Math.floor(i / gridCols) - gridRows/2;
        mesh.position.set(x * 2.5, -10, z * 2.5);
        vgridGrp.add(mesh);
        vgridBars.push(mesh);
    }
    vgridGrp.visible = false;
    scene.add(vgridGrp);

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
    
    if(isPlaying && analyser) {
        analyser.getByteFrequencyData(dataArr);
        
        let bassSum = 0;
        for(let i=0; i<10; i++) bassSum += dataArr[i];
        bgBassLevel = (bassSum / 10) / 255;

        // Animate based on active visualizer
        if (currentVis === 'pulse') {
            for(let i=0; i<pulseBars.length; i++) {
                const half = pulseBars.length / 2;
                const idx = i < half ? i : pulseBars.length - 1 - i;
                const bin = Math.floor((idx / half) * (dataArr.length * 0.6));
                const val = dataArr[bin] || 0;
                pulseBars[i].scale.y += ((1 + (val / 255) * 15) - pulseBars[i].scale.y) * 0.2;
            }
        } 
        else if (currentVis === 'wave') {
            for(let i=0; i<waveBars.length; i++) {
                const bin = Math.floor((i / waveBars.length) * (dataArr.length * 0.6));
                const val = dataArr[bin] || 0;
                waveBars[i].scale.y += ((1 + (val / 255) * 20) - waveBars[i].scale.y) * 0.2;
            }
        }
        else if (currentVis === 'grid') {
            for(let i=0; i<vgridBars.length; i++) {
                const bin = Math.floor((i / vgridBars.length) * (dataArr.length * 0.5));
                const val = dataArr[bin] || 0;
                vgridBars[i].scale.y += ((1 + (val / 255) * 12) - vgridBars[i].scale.y) * 0.2;
            }
        }
    } else {
        bgBassLevel *= 0.95;
        const time = performance.now() * 0.001;
        if (currentVis === 'pulse') {
            for(let i=0; i<pulseBars.length; i++) pulseBars[i].scale.y += (Math.max(1, 1 + Math.sin(time * 2 + i * 0.1) * 2) - pulseBars[i].scale.y) * 0.1;
        } else if (currentVis === 'wave') {
            for(let i=0; i<waveBars.length; i++) waveBars[i].scale.y += (Math.max(1, 1 + Math.sin(time * 3 + i * 0.2) * 3) - waveBars[i].scale.y) * 0.1;
        } else if (currentVis === 'grid') {
            for(let i=0; i<vgridBars.length; i++) vgridBars[i].scale.y += (Math.max(1, 1 + Math.sin(time * 2 + (i%16)*0.2 + Math.floor(i/16)*0.2) * 2) - vgridBars[i].scale.y) * 0.1;
        }
    }

    if (currentBg === 'synth') {
        gridHelper.position.z = (performance.now() * 0.01) % 5;
    }
    
    composer.render();
}

// Audio Logic
function ensureAudioCtx() {
    if(!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if(audioCtx.state === 'suspended') audioCtx.resume();
}

async function playStream(query) {
    if(!query) return;
    
    document.getElementById('track-title').innerText = 'Loading...';
    
    try {
        const metaRes = await fetch(`/metadata?url=${encodeURIComponent(query)}`);
        const meta = await metaRes.json();
        
        document.getElementById('track-title').innerText = meta.title || 'Unknown Track';
        document.getElementById('track-artist').innerText = meta.uploader || 'Unknown Artist';
        if(meta.thumbnail) document.getElementById('album-art').src = meta.thumbnail;
        
        if(curAudioEl) {
            curAudioEl.pause();
            curAudioEl.src = '';
        }
        
        curAudioEl = new Audio();
        curAudioEl.crossOrigin = 'anonymous';
        curAudioEl.src = `/stream?url=${encodeURIComponent(query)}`;
        
        curAudioEl.oncanplay = () => {
            ensureAudioCtx();
            if(!audioSrc) {
                audioSrc = audioCtx.createMediaElementSource(curAudioEl);
                analyser = audioCtx.createAnalyser();
                analyser.fftSize = 256;
                dataArr = new Uint8Array(analyser.frequencyBinCount);
                audioSrc.connect(analyser);
                analyser.connect(audioCtx.destination);
            }
            curAudioEl.play();
            isPlaying = true;
            document.getElementById('play-btn').innerText = '⏸';
        };
        
        curAudioEl.ontimeupdate = () => {
            if(!curAudioEl.duration) return;
            const pct = (curAudioEl.currentTime / curAudioEl.duration) * 100;
            document.getElementById('seek-slider').value = pct;
            document.getElementById('progress-fill').style.width = pct + '%';
            
            const fmt = s => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
            document.getElementById('time-current').innerText = fmt(curAudioEl.currentTime);
            document.getElementById('time-total').innerText = fmt(curAudioEl.duration);
        };
        
    } catch (err) {
        console.error(err);
        document.getElementById('track-title').innerText = 'Error playing track';
    }
}

// Event Listeners
document.getElementById('play-btn').addEventListener('click', () => {
    if(!curAudioEl) return;
    if(curAudioEl.paused) {
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
    if(!curAudioEl || !curAudioEl.duration) return;
    const pct = parseFloat(e.target.value);
    curAudioEl.currentTime = (pct / 100) * curAudioEl.duration;
    document.getElementById('progress-fill').style.width = pct + '%';
});

document.getElementById('vol-slider').addEventListener('input', e => {
    if(curAudioEl) curAudioEl.volume = parseFloat(e.target.value) / 100;
});

const searchInp = document.getElementById('search-inp');
const searchBtn = document.getElementById('search-btn');
const doSearch = () => {
    const q = searchInp.value.trim();
    if(q) playStream(q);
    searchInp.value = '';
};
searchBtn.addEventListener('click', doSearch);
searchInp.addEventListener('keypress', e => { if(e.key === 'Enter') doSearch(); });

// Dropdown Handlers
document.getElementById('vis-sel').addEventListener('change', e => {
    currentVis = e.target.value;
    pulseGrp.visible = (currentVis === 'pulse');
    waveGrp.visible = (currentVis === 'wave');
    vgridGrp.visible = (currentVis === 'grid');
});

document.getElementById('bg-sel').addEventListener('change', e => {
    currentBg = e.target.value;
    gridHelper.visible = (currentBg === 'synth');
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
    
    if(gridHelper) gridHelper.material.color.setHex(th.color);
    
    const pl = scene.children.find(c => c.isPointLight);
    if(pl) pl.color.setHex(th.color);
});

// Init
initThree();
