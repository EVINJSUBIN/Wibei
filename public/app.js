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

let scene, camera, renderer, composer, bloomPass, bgTexture;
let visualizerRoot, shockwaveGroup;
let pulseGrp, waveGrp, vgridGrp, orbGrp, vgridFloor;
let pulseBars = [], pulseInnerBars = [], waveBars = [], waveMirrorBars = [], wavePeakBeads = [], vgridBars = [], orbVertices = [];
let orbMesh, orbWireMesh, orbInnerCore, orbRing1, orbRing2, orbRing3, orbEquatorBeacons = [], orbParticles;
let pulseGyroCore, pulseHalo, pulseFloor, waveHorizon, waveFloor;
let wavePeakY = [];
let pulseInnerGrp, pulseOuterGrp;

let matrixRipplePhase = 0;
let matrixShockwaves = [];
let lastMatrixShockwaveTime = 0;
const MATRIX_DIM = 18;
const MATRIX_SPACING = 2.15;
const MATRIX_MAX_DIST = Math.hypot((MATRIX_DIM / 2) * MATRIX_SPACING, (MATRIX_DIM / 2) * MATRIX_SPACING);

const THEMES = {
    phonk: {
        name: 'Phonk / Drift',
        accent: '#ef4444',
        accentGlow: 'rgba(239, 68, 68, 0.45)',
        accentDim: 'rgba(239, 68, 68, 0.15)',
        bg: '#08040d',
        panelBg: 'rgba(18, 8, 28, 0.65)',
        border: 'rgba(168, 85, 247, 0.18)',
        borderHover: 'rgba(239, 68, 68, 0.45)',
        color: 0xef4444,
        secondaryColor: 0xa855f7,
        lightColor: 0xef4444,
        bloomStrength: 0.5,
        getColor: (idx, total) => idx % 2 === 0 ? 0xef4444 : 0xa855f7
    },
    comic: {
        name: 'Comic / Pop',
        accent: '#facc15',
        accentGlow: 'rgba(250, 204, 21, 0.45)',
        accentDim: 'rgba(250, 204, 21, 0.15)',
        bg: '#080d16',
        panelBg: 'rgba(15, 23, 42, 0.65)',
        border: 'rgba(6, 182, 212, 0.18)',
        borderHover: 'rgba(250, 204, 21, 0.45)',
        color: 0xfacc15,
        secondaryColor: 0x06b6d4,
        lightColor: 0xfacc15,
        bloomStrength: 0.4,
        getColor: (idx, total) => {
            const step = idx % 3;
            if (step === 0) return 0xfacc15;
            if (step === 1) return 0x06b6d4;
            return 0xf43f5e;
        }
    },
    lofi: {
        name: 'Lofi Sunset',
        accent: '#fb923c',
        accentGlow: 'rgba(251, 146, 60, 0.45)',
        accentDim: 'rgba(251, 146, 60, 0.15)',
        bg: '#0f0c18',
        panelBg: 'rgba(24, 20, 38, 0.65)',
        border: 'rgba(192, 132, 252, 0.18)',
        borderHover: 'rgba(251, 146, 60, 0.45)',
        color: 0xfb923c,
        secondaryColor: 0xc084fc,
        lightColor: 0xfb923c,
        bloomStrength: 0.35,
        getColor: (idx, total) => {
            const t = idx / total;
            return new THREE.Color().setHSL(0.05 + t * 0.18, 0.95, 0.6).getHex();
        }
    },
    cyber: {
        name: 'Cyber Matrix',
        accent: '#10b981',
        accentGlow: 'rgba(16, 185, 129, 0.45)',
        accentDim: 'rgba(16, 185, 129, 0.15)',
        bg: '#040d07',
        panelBg: 'rgba(8, 23, 14, 0.65)',
        border: 'rgba(16, 185, 129, 0.2)',
        borderHover: 'rgba(52, 211, 153, 0.45)',
        color: 0x10b981,
        secondaryColor: 0x34d399,
        lightColor: 0x10b981,
        bloomStrength: 0.45,
        getColor: (idx, total) => idx % 4 === 0 ? 0x34d399 : 0x10b981
    },
    serious: {
        name: 'Serious Void',
        accent: '#f8fafc',
        accentGlow: 'rgba(248, 250, 252, 0.3)',
        accentDim: 'rgba(248, 250, 252, 0.08)',
        bg: '#070707',
        panelBg: 'rgba(15, 15, 18, 0.65)',
        border: 'rgba(255, 255, 255, 0.12)',
        borderHover: 'rgba(255, 255, 255, 0.3)',
        color: 0xf8fafc,
        secondaryColor: 0x94a3b8,
        lightColor: 0xf8fafc,
        bloomStrength: 0.3,
        getColor: (idx, total) => (idx % 8 === 0 ? 0xffffff : 0x64748b)
    },
    auto: {
        name: 'Dynamic Auto Mood',
        accent: '#ef4444',
        accentGlow: 'rgba(239, 68, 68, 0.45)',
        accentDim: 'rgba(239, 68, 68, 0.15)',
        bg: '#09090b',
        panelBg: 'rgba(19, 19, 24, 0.65)',
        border: 'rgba(255, 255, 255, 0.14)',
        borderHover: 'rgba(239, 68, 68, 0.45)',
        color: 0xef4444,
        secondaryColor: 0x06b6d4,
        lightColor: 0xef4444,
        bloomStrength: 0.45,
        isAuto: true,
        getColor: (idx, total) => new THREE.Color().setHSL((idx / total) % 1, 0.9, 0.55).getHex()
    }
};
let currentTheme = 'phonk';
let autoHue = 0;
let currentVis   = 'pulse';
let currentBg    = 'vibe';
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

let currentAudioSessionId = 0;

function updatePlayIcons(playing) {
    isPlaying = playing;
    if (iconPlay && iconPause) {
        iconPlay.style.display  = playing ? 'none'  : 'block';
        iconPause.style.display = playing ? 'block' : 'none';
    }
    if (miniEq) miniEq.style.display = playing ? 'flex' : 'none';
    if (telemetryMode) telemetryMode.innerText = playing ? 'ACTIVE' : 'IDLE';
    
    const artWrap = document.querySelector('.album-art-wrap');
    if (artWrap) artWrap.classList.toggle('playing', playing);
}

function updateTrackInfo(title, artist, thumb) {
    if (trackTitle)  trackTitle.innerText  = title || 'Unknown Track';
    if (trackArtist) trackArtist.innerText = artist || 'Unknown Artist';
    
    const lyricsTrackTitle = document.getElementById('lyrics-track-title');
    if (lyricsTrackTitle) lyricsTrackTitle.innerText = `${title || 'Track'} // ${artist || 'Artist'}`;

    if (albumArt) {
        if (thumb && (thumb.startsWith('http') || thumb.startsWith('/'))) {
            albumArt.src = thumb;
        } else {
            albumArt.src = 'favicon.svg';
        }
    }
    
    if (title && !title.includes('Connecting') && !title.includes('Loading') && !title.includes('Error')) {
        loadLyricsForTrack(title, artist);
    }
}

let particles = [];
let rings = [];
let ringSpawnTimer = 0;

function resizeCanvas() {
    bgCanvas.width  = window.innerWidth;
    bgCanvas.height = window.innerHeight;
    if (bgTexture) bgTexture.needsUpdate = true;
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

let comicGlyphs = [];
let cyberDrops = [];
let lofiOrbs = [];
let lightningBolts = [];
let lastMoodSwitchTime = 0;
let autoDetectedMood = 'phonk';

function initCyberDrops() {
    cyberDrops = [];
    const cols = Math.floor((bgCanvas?.width || window.innerWidth) / 22);
    for (let i = 0; i < cols; i++) {
        cyberDrops.push({
            x: i * 22,
            y: Math.random() * (bgCanvas?.height || window.innerHeight),
            speed: 2 + Math.random() * 4.5,
            chars: '0101λΨ⚡♫✦<>#*'
        });
    }
}

function initLofiOrbs() {
    lofiOrbs = [];
    const w = bgCanvas?.width || window.innerWidth;
    const h = bgCanvas?.height || window.innerHeight;
    for (let i = 0; i < 16; i++) {
        lofiOrbs.push({
            x: Math.random() * w,
            y: Math.random() * h,
            r: 30 + Math.random() * 70,
            speedX: (Math.random() - 0.5) * 0.4,
            speedY: -0.2 - Math.random() * 0.3,
            alpha: 0.04 + Math.random() * 0.08,
            hue: Math.random() > 0.5 ? 24 : 270
        });
    }
}

let voidStars = [];
function initVoidStars() {
    voidStars = [];
    const w = bgCanvas?.width || window.innerWidth;
    const h = bgCanvas?.height || window.innerHeight;
    for (let i = 0; i < 120; i++) {
        voidStars.push({
            x: Math.random() * w,
            y: Math.random() * h,
            r: 0.6 + Math.random() * 1.5,
            alpha: 0.15 + Math.random() * 0.65,
            twinkleSpeed: 0.02 + Math.random() * 0.05,
            twinklePhase: Math.random() * Math.PI * 2
        });
    }
}

initCyberDrops();
initLofiOrbs();
initVoidStars();

function spawnComicGlyph(text, x, y) {
    const glyphs = ['POW!', 'BOOM!', '✦', '⚡', '★', 'BASS', '♫', 'DROP!'];
    comicGlyphs.push({
        text: text || glyphs[Math.floor(Math.random() * glyphs.length)],
        x: x || (bgCanvas.width * 0.2 + Math.random() * bgCanvas.width * 0.6),
        y: y || (bgCanvas.height * 0.3 + Math.random() * bgCanvas.height * 0.4),
        alpha: 0.9,
        scale: 0.8 + Math.random() * 0.6,
        rot: (Math.random() - 0.5) * 0.4,
        vy: -1.2 - Math.random() * 1.5,
        color: ['#facc15', '#06b6d4', '#f43f5e'][Math.floor(Math.random() * 3)]
    });
}

function spawnLightning() {
    const startX = Math.random() * bgCanvas.width;
    const segments = [];
    let curX = startX, curY = 0;
    while (curY < bgCanvas.height) {
        const nextX = curX + (Math.random() - 0.5) * 60;
        const nextY = curY + 20 + Math.random() * 40;
        segments.push({ x1: curX, y1: curY, x2: nextX, y2: nextY });
        curX = nextX;
        curY = nextY;
    }
    lightningBolts.push({ segments, alpha: 0.85 });
}

function getActiveAccentColor() {
    const th = THEMES[currentTheme] || THEMES.phonk;
    if (th.isAuto) {
        return '#' + new THREE.Color().setHSL(autoHue, 0.9, 0.55).getHexString();
    }
    return th.accent;
}

function drawDotsFrame() {
    const accentCol = getActiveAccentColor();
    const boost = 1 + bgBassLevel * 1.8;
    particles.forEach(p => {
        p.y -= p.speed * boost;
        p.x += p.drift;
        if (p.y < -4) { p.y = bgCanvas.height + 4; p.x = Math.random() * bgCanvas.width; }
        if (p.x < -4 || p.x > bgCanvas.width + 4) p.x = Math.random() * bgCanvas.width;
        bgCtx.beginPath();
        bgCtx.arc(p.x, p.y, p.r * (1 + bgBassLevel * 0.6), 0, Math.PI * 2);
        bgCtx.fillStyle   = accentCol;
        bgCtx.globalAlpha = p.alpha * (1 + bgBassLevel * 0.7);
        bgCtx.fill();
    });
}

function drawRingsFrame() {
    const accentCol = getActiveAccentColor();
    const expandSpeed = 0.6 + bgBassLevel * 2.5;
    const spawnEvery = Math.max(500, 1600 - bgBassLevel * 1000);

    ringSpawnTimer += 16;
    if (ringSpawnTimer >= spawnEvery) {
        spawnRing();
        ringSpawnTimer = 0;
    }

    bgCtx.strokeStyle = accentCol;
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

// 1. Comic / Pop Art Background (Halftone Grid, Speed Burst Rays, Comic Sound Glyphs)
function drawComicFrame() {
    const w = bgCanvas.width, h = bgCanvas.height;
    
    // Halftone pop dot grid
    const spacing = 38;
    const dotMaxR = 2.5 + bgBassLevel * 6;
    bgCtx.fillStyle = 'rgba(250, 204, 21, 0.07)';
    for (let x = spacing / 2; x < w; x += spacing) {
        for (let y = spacing / 2; y < h; y += spacing) {
            bgCtx.beginPath();
            bgCtx.arc(x, y, Math.max(1, dotMaxR * 0.35), 0, Math.PI * 2);
            bgCtx.fill();
        }
    }

    // Comic radial burst lines on drops
    if (bgBassLevel > 0.48) {
        bgCtx.save();
        bgCtx.translate(w / 2, h / 2);
        bgCtx.strokeStyle = 'rgba(244, 63, 94, 0.1)';
        bgCtx.lineWidth = 1.5;
        const rays = 12;
        for (let i = 0; i < rays; i++) {
            const a = (i / rays) * Math.PI * 2 + performance.now() * 0.0005;
            bgCtx.beginPath();
            bgCtx.moveTo(0, 0);
            bgCtx.lineTo(Math.cos(a) * w, Math.sin(a) * h);
            bgCtx.stroke();
        }
        bgCtx.restore();
    }

    if (bgBassLevel > 0.6 && Math.random() < 0.08 && comicGlyphs.length < 6) {
        spawnComicGlyph();
    }

    comicGlyphs = comicGlyphs.filter(g => g.alpha > 0.02);
    comicGlyphs.forEach(g => {
        g.y += g.vy;
        g.alpha -= 0.015;
        bgCtx.save();
        bgCtx.translate(g.x, g.y);
        bgCtx.rotate(g.rot);
        bgCtx.font = `bold ${Math.round(18 * g.scale)}px "JetBrains Mono", monospace`;
        bgCtx.fillStyle = g.color;
        bgCtx.globalAlpha = g.alpha;
        bgCtx.fillText(g.text, 0, 0);
        bgCtx.restore();
    });
}

// 2. Phonk / Neo-Brutalist Lightning & Pulse Rings
function drawPhonkFrame() {
    const w = bgCanvas.width, h = bgCanvas.height;

    if (bgBassLevel > 0.58 && Math.random() < 0.12 && lightningBolts.length < 3) {
        spawnLightning();
    }

    lightningBolts = lightningBolts.filter(l => l.alpha > 0.05);
    lightningBolts.forEach(l => {
        l.alpha -= 0.08;
        bgCtx.strokeStyle = `rgba(239, 68, 68, ${l.alpha})`;
        bgCtx.lineWidth = 2;
        l.segments.forEach(s => {
            bgCtx.beginPath();
            bgCtx.moveTo(s.x1, s.y1);
            bgCtx.lineTo(s.x2, s.y2);
            bgCtx.stroke();
        });
    });

    drawRingsFrame();
}

// 3. Lofi Sunset Dreamy Bokeh Horizon
function drawLofiFrame() {
    const w = bgCanvas.width, h = bgCanvas.height;

    const grad = bgCtx.createLinearGradient(0, h * 0.4, 0, h);
    grad.addColorStop(0, 'rgba(192, 132, 252, 0)');
    grad.addColorStop(0.7, 'rgba(251, 146, 60, 0.05)');
    grad.addColorStop(1, 'rgba(56, 189, 248, 0.03)');
    bgCtx.fillStyle = grad;
    bgCtx.fillRect(0, 0, w, h);

    lofiOrbs.forEach(orb => {
        orb.x += orb.speedX;
        orb.y += orb.speedY * (1 + bgBassLevel * 0.8);
        if (orb.y < -orb.r) { orb.y = h + orb.r; orb.x = Math.random() * w; }
        if (orb.x < -orb.r || orb.x > w + orb.r) orb.x = Math.random() * w;

        const pulseR = orb.r * (1 + bgBassLevel * 0.25);
        const orbGrad = bgCtx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, pulseR);
        const colStr = orb.hue === 24 ? '251, 146, 60' : '192, 132, 252';
        orbGrad.addColorStop(0, `rgba(${colStr}, ${orb.alpha * 1.5})`);
        orbGrad.addColorStop(1, `rgba(${colStr}, 0)`);
        
        bgCtx.fillStyle = orbGrad;
        bgCtx.beginPath();
        bgCtx.arc(orb.x, orb.y, pulseR, 0, Math.PI * 2);
        bgCtx.fill();
    });

    drawDotsFrame();
}

// 4. Cyber Matrix Falling Phosphor Rain & Scanlines
function drawCyberFrame() {
    const w = bgCanvas.width, h = bgCanvas.height;

    bgCtx.font = '10px "JetBrains Mono", monospace';
    bgCtx.fillStyle = 'rgba(16, 185, 129, 0.25)';
    cyberDrops.forEach(d => {
        d.y += d.speed * (1 + bgBassLevel * 1.4);
        if (d.y > h) d.y = -20;
        const char = d.chars[Math.floor((d.y * 0.1) % d.chars.length)];
        bgCtx.fillText(char, d.x, d.y);
    });

    bgCtx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    for (let y = 0; y < h; y += 4) {
        bgCtx.fillRect(0, y, w, 1);
    }
}

function hexToRgba(hex, alpha) {
    if (!hex) return `rgba(255, 255, 255, ${alpha})`;
    if (hex.startsWith('rgba')) return hex;
    if (hex.startsWith('rgb')) return hex.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

function drawAtmosphericAura() {
    const w = bgCanvas.width, h = bgCanvas.height;
    const cx = w / 2, cy = h / 2;
    const th = THEMES[currentTheme] || THEMES.phonk;
    const accentCol = getActiveAccentColor();
    const secCol = th.secondaryColor ? ('#' + new THREE.Color(th.secondaryColor).getHexString()) : accentCol;

    // Solid dark base to prevent transparent WebGL additive blowout
    bgCtx.fillStyle = th.bg || '#070709';
    bgCtx.fillRect(0, 0, w, h);

    // 1. Subtle, deep cosmic radial nebula (dark & soft)
    const maxR = Math.max(w, h) * 0.45;
    const auraGrad = bgCtx.createRadialGradient(cx, cy, 10, cx, cy, maxR);
    const coreAlpha = 0.04 + bgBassLevel * 0.05;
    const midAlpha  = 0.015 + bgBassLevel * 0.02;
    auraGrad.addColorStop(0, hexToRgba(accentCol, coreAlpha));
    auraGrad.addColorStop(0.45, hexToRgba(secCol, midAlpha));
    auraGrad.addColorStop(0.85, hexToRgba(accentCol, 0.003));
    auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    bgCtx.fillStyle = auraGrad;
    bgCtx.fillRect(0, 0, w, h);

    // 2. Cinematic perimeter vignette
    const vigGrad = bgCtx.createRadialGradient(cx, cy, Math.min(w, h) * 0.4, cx, cy, Math.max(w, h) * 0.72);
    vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vigGrad.addColorStop(1, 'rgba(0, 0, 0, 0.68)');
    bgCtx.fillStyle = vigGrad;
    bgCtx.fillRect(0, 0, w, h);
}

function drawSeriousFrame() {
    const time = performance.now() * 0.001;
    voidStars.forEach(s => {
        const tw = Math.sin(time * 3 + s.twinklePhase) * 0.3;
        const alpha = clamp(s.alpha + tw + bgBassLevel * 0.4, 0.1, 1.0);
        bgCtx.beginPath();
        bgCtx.arc(s.x, s.y, s.r * (1 + bgBassLevel * 0.5), 0, Math.PI * 2);
        bgCtx.fillStyle = `rgba(248, 250, 252, ${alpha})`;
        bgCtx.fill();
    });
    drawDotsFrame();
}

function drawVibeFrame() {
    const th = THEMES[currentTheme] || THEMES.phonk;
    const mode = th.isAuto ? autoDetectedMood : currentTheme;
    if (mode === 'comic') drawComicFrame();
    else if (mode === 'phonk') drawPhonkFrame();
    else if (mode === 'lofi') drawLofiFrame();
    else if (mode === 'cyber') drawCyberFrame();
    else if (mode === 'serious') drawSeriousFrame();
    else drawDotsFrame();
}

function animateBg() {
    requestAnimationFrame(animateBg);
    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    bgCtx.globalAlpha = 1;

    // Atmospheric volumetric radial aura & vignette
    drawAtmosphericAura();

    if (currentBg === 'vibe') drawVibeFrame();
    else if (currentBg === 'dots') drawDotsFrame();
    else if (currentBg === 'rings') drawRingsFrame();
    bgCtx.globalAlpha = 1;

    if (bgTexture) bgTexture.needsUpdate = true;
}
animateBg();

let shockwaves = [];
function triggerBeatShockwave(energy) {
    if (!shockwaveGroup) return;
    const geom = new THREE.RingGeometry(0.1, 0.6, 32);
    const th = THEMES[currentTheme] || THEMES.phonk;
    const shockColor = th.isAuto ? new THREE.Color().setHSL(autoHue, 0.9, 0.55).getHex() : (th.secondaryColor || th.color);
    const mat = new THREE.MeshBasicMaterial({
        color: shockColor,
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
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    bgTexture = new THREE.CanvasTexture(bgCanvas);
    scene.background = bgTexture;

    const renderScene = new THREE.RenderPass(scene, camera);
    bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.45, 0.25, 0.82);
    bloomPass.threshold = 0.82;
    bloomPass.strength  = 0.45;
    bloomPass.radius    = 0.25;

    composer = new THREE.EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const pointLight = new THREE.PointLight(THEMES[currentTheme].color, 0.85, 120);
    pointLight.position.set(0, 0, 24);
    scene.add(pointLight);

    visualizerRoot = new THREE.Group();
    scene.add(visualizerRoot);

    shockwaveGroup = new THREE.Group();
    scene.add(shockwaveGroup);

    function makeMat(idx = 0, total = 128) {
        const th = THEMES[currentTheme] || THEMES.phonk;
        const col = th.getColor ? th.getColor(idx, total) : th.color;
        return new THREE.MeshStandardMaterial({
            color:             col,
            emissive:          col,
            emissiveIntensity: 0.42,
            roughness:         0.18,
            metalness:         0.82,
        });
    }

    // 1. PULSE RING // Dual Accelerator (Outer Towers + Inner Iris), Floor Grid, Base Halo & Gyro Reactor
    pulseGrp = new THREE.Group();
    const ringCount = 96, ringR = 21;
    const innerRingCount = 48, innerR = 13.5;

    // Cyber Stage Floor Grid for Ring (matches the floor perspective depth of Grid)
    pulseFloor = new THREE.GridHelper(56, 20, thInit.color, 0x181824);
    pulseFloor.position.y = -10;
    pulseFloor.rotation.x = 0.35;
    pulseFloor.material.transparent = true;
    pulseFloor.material.opacity = 0.35;
    pulseGrp.add(pulseFloor);

    pulseOuterGrp = new THREE.Group();
    pulseGrp.add(pulseOuterGrp);

    pulseInnerGrp = new THREE.Group();
    pulseGrp.add(pulseInnerGrp);

    // Smooth Tapered Cylindrical Rod for Outer Ring
    const ringRodGeo = new THREE.CylinderGeometry(0.35, 0.55, 1, 16);
    ringRodGeo.translate(0, 0.5, 0);

    // Inner Inverted Spikes
    const innerRodGeo = new THREE.CylinderGeometry(0.45, 0.25, 1, 16);
    innerRodGeo.translate(0, -0.5, 0);

    pulseBars = [];
    pulseInnerBars = [];

    // Outer Ring Towers
    for (let i = 0; i < ringCount; i++) {
        const m = new THREE.Mesh(ringRodGeo, makeMat(i, ringCount));
        const a = (i / ringCount) * Math.PI * 2;
        m.position.set(Math.cos(a) * ringR, Math.sin(a) * ringR, 0);
        m.rotation.z = a - Math.PI / 2;
        pulseOuterGrp.add(m);
        pulseBars.push(m);
    }

    // Inner Iris Spikes (counter-pointing toward center)
    for (let i = 0; i < innerRingCount; i++) {
        const m = new THREE.Mesh(innerRodGeo, makeMat(i + ringCount, innerRingCount));
        const a = (i / innerRingCount) * Math.PI * 2;
        m.position.set(Math.cos(a) * innerR, Math.sin(a) * innerR, 0);
        m.rotation.z = a - Math.PI / 2;
        pulseInnerGrp.add(m);
        pulseInnerBars.push(m);
    }

    // Center Rotating Energy Gyro-Core
    const gyroGeo = new THREE.OctahedronGeometry(3.4, 0);
    const gyroMat = new THREE.MeshStandardMaterial({
        color: thInit.color,
        emissive: thInit.color,
        emissiveIntensity: 0.4,
        wireframe: true,
        roughness: 0.1,
        metalness: 0.9
    });
    pulseGyroCore = new THREE.Mesh(gyroGeo, gyroMat);
    pulseGrp.add(pulseGyroCore);

    // Dual Glowing Halo Base Rings
    const haloOuterGeo = new THREE.RingGeometry(ringR - 0.4, ringR + 0.4, 64);
    const haloMat = new THREE.MeshBasicMaterial({
        color: thInit.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.35
    });
    pulseHalo = new THREE.Mesh(haloOuterGeo, haloMat);
    pulseGrp.add(pulseHalo);

    const haloInnerGeo = new THREE.RingGeometry(innerR - 0.35, innerR + 0.35, 48);
    const haloInnerMesh = new THREE.Mesh(haloInnerGeo, haloMat);
    pulseGrp.add(haloInnerMesh);

    visualizerRoot.add(pulseGrp);

    // 2. WAVE RIBBON // 3D Curved Highway, Floor Reflection Grid, Mirror Spectrum, Horizon Beam & Peak Beads
    waveGrp = new THREE.Group();
    const waveN = 72;
    waveBars = [];
    waveMirrorBars = [];
    wavePeakBeads = [];
    wavePeakY = new Array(waveN).fill(0);

    // Cyber Highway Floor Grid
    waveFloor = new THREE.GridHelper(90, 22, thInit.color, 0x181826);
    waveFloor.position.set(0, -9.5, 4);
    waveFloor.rotation.x = 0.22;
    waveFloor.material.transparent = true;
    waveFloor.material.opacity = 0.35;
    waveGrp.add(waveFloor);

    // Smooth Cylindrical Wave Pillars
    const wavePillarGeo = new THREE.CylinderGeometry(0.55, 0.55, 1, 16);
    wavePillarGeo.translate(0, 0.5, 0);

    const waveMirrorGeo = new THREE.CylinderGeometry(0.55, 0.55, 1, 16);
    waveMirrorGeo.translate(0, -0.5, 0);

    const beadGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.15, 16);
    const beadMat = new THREE.MeshBasicMaterial({
        color: thInit.secondaryColor || thInit.color,
        transparent: true,
        opacity: 0.95
    });

    for (let i = 0; i < waveN; i++) {
        const norm = (i - waveN / 2) / (waveN / 2);
        const x = (i - waveN / 2) * 1.35;
        // Parabolic 3D curvature wrapping toward camera
        const z = -Math.pow(norm * 2.5, 2) * 1.4;

        // Upper frequency pillar
        const mUp = new THREE.Mesh(wavePillarGeo, makeMat(i, waveN));
        mUp.position.set(x, -5, z);
        waveGrp.add(mUp);
        waveBars.push(mUp);

        // Lower mirrored reflection pillar
        const mDown = new THREE.Mesh(waveMirrorGeo, makeMat(i, waveN));
        mDown.position.set(x, -5.2, z);
        waveGrp.add(mDown);
        waveMirrorBars.push(mDown);

        // Floating Studio Peak Bead
        const mBead = new THREE.Mesh(beadGeo, beadMat.clone());
        mBead.position.set(x, -4.6, z);
        waveGrp.add(mBead);
        wavePeakBeads.push(mBead);
    }

    // Glowing central horizon line
    const horizGeo = new THREE.BoxGeometry(waveN * 1.35 + 4, 0.18, 0.4);
    const horizMat = new THREE.MeshBasicMaterial({
        color: thInit.color,
        transparent: true,
        opacity: 0.55
    });
    waveHorizon = new THREE.Mesh(horizGeo, horizMat);
    waveHorizon.position.set(0, -5.1, -0.5);
    waveGrp.add(waveHorizon);

    waveGrp.visible = false;
    visualizerRoot.add(waveGrp);

    // 3. GEOMETRY MATRIX // 18x18 Kinetic Voxel Terrain & Floor Grid
    vgridGrp = new THREE.Group();
    vgridGrp.position.set(0, -6, 0);
    vgridGrp.rotation.x = 0.42;

    vgridFloor = new THREE.GridHelper(MATRIX_DIM * MATRIX_SPACING + 4, MATRIX_DIM, thInit.color, 0x1f1f2e);
    vgridFloor.position.y = -0.05;
    vgridFloor.material.transparent = true;
    vgridFloor.material.opacity = 0.35;
    vgridGrp.add(vgridFloor);

    // Smooth Cylindrical Architectural Audio Pillars
    const gridPillarGeo = new THREE.CylinderGeometry(0.92, 0.92, 1, 18);
    gridPillarGeo.translate(0, 0.5, 0);

    const colCenter = new THREE.Color(thInit.color);
    const colEdge = new THREE.Color(thInit.secondaryColor || thInit.color);

    const halfDim = (MATRIX_DIM - 1) / 2;
    for (let r = 0; r < MATRIX_DIM; r++) {
        for (let c = 0; c < MATRIX_DIM; c++) {
            const x = (c - halfDim) * MATRIX_SPACING;
            const z = (r - halfDim) * MATRIX_SPACING;
            const dist = Math.hypot(x, z);
            const normDist = clamp(dist / MATRIX_MAX_DIST, 0, 1);
            const angle = Math.atan2(z, x);

            const col = colCenter.clone().lerp(colEdge, normDist);
            const mat = new THREE.MeshStandardMaterial({
                color: col,
                emissive: col,
                emissiveIntensity: 0.4,
                roughness: 0.16,
                metalness: 0.84
            });

            const m = new THREE.Mesh(gridPillarGeo, mat);
            m.position.set(x, 0, z);
            m.userData = { x, z, dist, normDist, angle };
            vgridGrp.add(m);
            vgridBars.push(m);
        }
    }
    vgridGrp.visible = false;
    visualizerRoot.add(vgridGrp);

    // 4. PULSAR CYBER CORE // Deformed Geodesic Shell, Triple Gimbal Gyroscope, Equator Beacons & Orbiting Spark Cloud
    orbGrp = new THREE.Group();
    
    // Outer Deformed Wireframe Shell
    const sphereGeom = new THREE.IcosahedronGeometry(11, 3);
    const sphereMat = new THREE.MeshStandardMaterial({
        color: thInit.color,
        emissive: thInit.color,
        emissiveIntensity: 0.42,
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

    // Inner Glowing Pulsar Nucleus (Delicate wireframe energy diamond)
    const innerCoreGeo = new THREE.IcosahedronGeometry(2.5, 1);
    const innerCoreMat = new THREE.MeshStandardMaterial({
        color: thInit.color,
        emissive: thInit.secondaryColor || thInit.color,
        emissiveIntensity: 0.35,
        wireframe: true,
        roughness: 0.2,
        metalness: 0.8
    });
    orbInnerCore = new THREE.Mesh(innerCoreGeo, innerCoreMat);
    orbGrp.add(orbInnerCore);

    // Triple Gimbal Gyroscopic Rings (Yaw, Pitch, Roll)
    const ringMat1 = new THREE.MeshBasicMaterial({ color: thInit.color, transparent: true, opacity: 0.65 });
    orbRing1 = new THREE.Mesh(new THREE.TorusGeometry(14.2, 0.14, 16, 96), ringMat1);
    orbRing1.rotation.x = Math.PI / 4;
    orbRing1.rotation.y = Math.PI / 6;
    orbGrp.add(orbRing1);

    const ringMat2 = new THREE.MeshBasicMaterial({ color: thInit.secondaryColor || thInit.color, transparent: true, opacity: 0.55 });
    orbRing2 = new THREE.Mesh(new THREE.TorusGeometry(15.8, 0.12, 16, 96), ringMat2);
    orbRing2.rotation.x = -Math.PI / 3;
    orbRing2.rotation.y = -Math.PI / 4;
    orbGrp.add(orbRing2);

    const ringMat3 = new THREE.MeshBasicMaterial({ color: thInit.color, transparent: true, opacity: 0.45 });
    orbRing3 = new THREE.Mesh(new THREE.TorusGeometry(17.4, 0.11, 16, 96), ringMat3);
    orbRing3.rotation.z = Math.PI / 3;
    orbGrp.add(orbRing3);

    // Holographic Equatorial Satellites (32 beacons)
    orbEquatorBeacons = [];
    const beaconGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.6, 12);
    const beaconMat = new THREE.MeshStandardMaterial({
        color: thInit.color,
        emissive: thInit.color,
        emissiveIntensity: 0.45,
        roughness: 0.2,
        metalness: 0.8
    });
    const beaconCount = 32;
    for (let i = 0; i < beaconCount; i++) {
        const a = (i / beaconCount) * Math.PI * 2;
        const b = new THREE.Mesh(beaconGeo, beaconMat.clone());
        b.position.set(Math.cos(a) * 12.8, 0, Math.sin(a) * 12.8);
        b.rotation.y = -a;
        b.rotation.z = Math.PI / 2;
        orbGrp.add(b);
        orbEquatorBeacons.push(b);
    }

    // Orbiting Cosmic Particle Spark Cloud
    const partCount = 72;
    const partGeo = new THREE.BufferGeometry();
    const partPos = new Float32Array(partCount * 3);
    for (let i = 0; i < partCount; i++) {
        const phi = Math.acos(-1 + (2 * i) / partCount);
        const theta = Math.sqrt(partCount * Math.PI) * phi;
        const r = 18.5 + (Math.random() - 0.5) * 4;
        partPos[i * 3]     = r * Math.cos(theta) * Math.sin(phi);
        partPos[i * 3 + 1] = r * Math.sin(theta) * Math.sin(phi);
        partPos[i * 3 + 2] = r * Math.cos(phi);
    }
    partGeo.setAttribute('position', new THREE.BufferAttribute(partPos, 3));
    const partMat = new THREE.PointsMaterial({
        color: thInit.secondaryColor || thInit.color,
        size: 0.65,
        transparent: true,
        opacity: 0.85
    });
    orbParticles = new THREE.Points(partGeo, partMat);
    orbGrp.add(orbParticles);

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

function detectSongMoodAndGeometry(bassAvg, midAvg, trebleAvg) {
    const now = performance.now();
    if (now - lastMoodSwitchTime < 3500) return;

    let targetMood = 'phonk';
    let targetVis = 'pulse';

    if (bassAvg > 0.42 && (bassAvg - midAvg) > 0.08) {
        targetMood = 'phonk';
        targetVis = 'pulse';
    } else if (midAvg > 0.32 && trebleAvg > 0.20) {
        targetMood = 'comic';
        targetVis = 'grid';
    } else if (bassAvg < 0.28 && midAvg < 0.28) {
        targetMood = 'lofi';
        targetVis = 'wave';
    } else if (trebleAvg > 0.30) {
        targetMood = 'cyber';
        targetVis = 'orb';
    }

    if (targetMood !== autoDetectedMood) {
        autoDetectedMood = targetMood;
        lastMoodSwitchTime = now;

        const th = THEMES[currentTheme];
        if (th && th.isAuto) {
            const detectedTheme = THEMES[targetMood];
            if (detectedTheme) {
                document.documentElement.style.setProperty('--accent', detectedTheme.accent);
                document.documentElement.style.setProperty('--accent-glow', detectedTheme.accentGlow);
                document.documentElement.style.setProperty('--bg', detectedTheme.bg);
                document.documentElement.style.setProperty('--panel', detectedTheme.panelBg);
                document.documentElement.style.setProperty('--border', detectedTheme.border);
                
                const pl = scene?.children.find(c => c.isPointLight);
                if (pl) pl.color.setHex(detectedTheme.lightColor);
                if (bloomPass) bloomPass.strength = detectedTheme.bloomStrength;
            }

            if (currentVis !== targetVis) {
                currentVis = targetVis;
                pulseGrp.visible = currentVis === 'pulse';
                waveGrp.visible  = currentVis === 'wave';
                vgridGrp.visible = currentVis === 'grid';
                orbGrp.visible   = currentVis === 'orb';
                if (geometryBadge) geometryBadge.innerText = targetVis.toUpperCase();
                document.querySelectorAll('#style-segmented .seg-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.value === targetVis);
                });
            }

            if (telemetryMode) telemetryMode.innerText = `AUTO: ${targetMood.toUpperCase()}`;
        }
    }
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
        let bassSum = 0, midSum = 0, trebleSum = 0;
        const totalBins = dataArr.length;
        for (let i = 0; i < 12; i++) bassSum += dataArr[i];
        for (let i = 12; i < 48; i++) midSum += dataArr[i];
        for (let i = 48; i < totalBins; i++) trebleSum += dataArr[i];

        const bassAvg = (bassSum / 12) / 255;
        const midAvg = (midSum / 36) / 255;
        const trebleAvg = (trebleSum / (totalBins - 48)) / 255;
        bgBassLevel = bassAvg;

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

        detectSongMoodAndGeometry(bassAvg, midAvg, trebleAvg);

        const th = THEMES[currentTheme] || THEMES.phonk;
        if (th.isAuto) {
            const targetHue = (bassAvg * 0.05 + midAvg * 0.45 + trebleAvg * 0.85) % 1.0;
            autoHue = lerp(autoHue, targetHue, 0.06);
            const dynamicColor = new THREE.Color().setHSL(autoHue, 0.9, 0.55);
            const hexStr = '#' + dynamicColor.getHexString();

            if (frameCounter % 5 === 0) {
                document.documentElement.style.setProperty('--accent', hexStr);
                document.documentElement.style.setProperty('--accent-glow', `rgba(${Math.round(dynamicColor.r * 255)}, ${Math.round(dynamicColor.g * 255)}, ${Math.round(dynamicColor.b * 255)}, 0.4)`);
            }

            const pl = scene?.children.find(c => c.isPointLight);
            if (pl) pl.color.setHex(dynamicColor.getHex());
        }

        if (currentVis === 'pulse') {
            const half = pulseBars.length / 2;
            for (let i = 0; i < pulseBars.length; i++) {
                const sym = i < half ? i : pulseBars.length - 1 - i;
                const bin = Math.min(dataArr.length - 1, Math.floor((sym / half) * dataArr.length * 0.7));
                const val = dataArr[bin] || 0;
                pulseBars[i].scale.y += (Math.max(0.8, 1 + (val / 255) * 17) - pulseBars[i].scale.y) * 0.28;
                if (th.isAuto) {
                    const c = new THREE.Color().setHSL((autoHue + (i / pulseBars.length) * 0.25) % 1, 0.9, 0.55);
                    pulseBars[i].material.color.copy(c);
                    pulseBars[i].material.emissive.copy(c);
                }
            }

            // Inner Iris Spikes
            const innerHalf = pulseInnerBars.length / 2;
            for (let i = 0; i < pulseInnerBars.length; i++) {
                const sym = i < innerHalf ? i : pulseInnerBars.length - 1 - i;
                const bin = Math.min(dataArr.length - 1, Math.floor((sym / innerHalf) * 36));
                const val = dataArr[bin] || 0;
                pulseInnerBars[i].scale.y += (Math.max(0.6, 1 + (val / 255) * 12) - pulseInnerBars[i].scale.y) * 0.32;
                if (th.isAuto) {
                    const c = new THREE.Color().setHSL((autoHue + 0.45 + (i / pulseInnerBars.length) * 0.2) % 1, 0.9, 0.55);
                    pulseInnerBars[i].material.color.copy(c);
                    pulseInnerBars[i].material.emissive.copy(c);
                }
            }

            // Dual Counter-Rotating Aperture
            if (pulseOuterGrp) pulseOuterGrp.rotation.z += 0.003 + bgBassLevel * 0.008;
            if (pulseInnerGrp) pulseInnerGrp.rotation.z -= 0.005 + bgBassLevel * 0.012;

            if (pulseGyroCore) {
                pulseGyroCore.rotation.x += 0.02 + bgBassLevel * 0.04;
                pulseGyroCore.rotation.y += 0.025 + bgBassLevel * 0.05;
                const gyroScale = 1 + bgBassLevel * 0.55;
                pulseGyroCore.scale.set(gyroScale, gyroScale, gyroScale);
                pulseGyroCore.material.emissiveIntensity = 0.3 + bgBassLevel * 0.35;
                if (th.isAuto) {
                    const c = new THREE.Color().setHSL(autoHue, 0.9, 0.6);
                    pulseGyroCore.material.color.copy(c);
                    pulseGyroCore.material.emissive.copy(c);
                }
            }
        } else if (currentVis === 'wave') {
            for (let i = 0; i < waveBars.length; i++) {
                const bin = Math.floor((i / waveBars.length) * dataArr.length * 0.65);
                const val = dataArr[bin] || 0;
                const targetH = Math.max(0.6, 1 + (val / 255) * 19);
                waveBars[i].scale.y += (targetH - waveBars[i].scale.y) * 0.28;
                if (waveMirrorBars[i]) {
                    waveMirrorBars[i].scale.y += (targetH * 0.62 - waveMirrorBars[i].scale.y) * 0.28;
                }

                // Studio Peak Beads Gravity Physics
                if (wavePeakBeads[i]) {
                    const barTop = -5 + waveBars[i].scale.y;
                    if (barTop >= (wavePeakY[i] || -4.6)) {
                        wavePeakY[i] = barTop;
                    } else {
                        wavePeakY[i] = Math.max(-4.6, (wavePeakY[i] || -4.6) - 0.16);
                    }
                    wavePeakBeads[i].position.y = wavePeakY[i] + 0.26;
                }

                if (th.isAuto) {
                    const c = new THREE.Color().setHSL((autoHue + (i / waveBars.length) * 0.35) % 1, 0.9, 0.55);
                    waveBars[i].material.color.copy(c);
                    waveBars[i].material.emissive.copy(c);
                    if (waveMirrorBars[i]) {
                        waveMirrorBars[i].material.color.copy(c);
                        waveMirrorBars[i].material.emissive.copy(c);
                    }
                }
            }
        } else if (currentVis === 'grid') {
            matrixRipplePhase += 0.045 + bgBassLevel * 0.18;

            const nowMs = performance.now();
            if (bgBassLevel > 0.44 && nowMs - lastMatrixShockwaveTime > 320) {
                matrixShockwaves.push({
                    radius: 0,
                    speed: 0.95 + bgBassLevel * 1.5,
                    intensity: 1.0,
                    maxRadius: MATRIX_MAX_DIST + 6
                });
                lastMatrixShockwaveTime = nowMs;
            }

            matrixShockwaves.forEach(sw => {
                sw.radius += sw.speed;
                sw.intensity *= 0.94;
            });
            matrixShockwaves = matrixShockwaves.filter(sw => sw.radius < sw.maxRadius && sw.intensity > 0.05);

            const halfData = dataArr.length * 0.7;
            for (let i = 0; i < vgridBars.length; i++) {
                const b = vgridBars[i];
                const u = b.userData;
                const bin = Math.min(dataArr.length - 1, Math.floor(u.normDist * halfData));
                const audioVal = (dataArr[bin] || 0) / 255;
                const wave = Math.sin(u.dist * 0.55 - matrixRipplePhase);

                let shockBoost = 0;
                for (let j = 0; j < matrixShockwaves.length; j++) {
                    const sw = matrixShockwaves[j];
                    const diff = Math.abs(u.dist - sw.radius);
                    if (diff < 3.5) {
                        shockBoost += Math.exp(-Math.pow(diff / 1.8, 2)) * sw.intensity * 8.0;
                    }
                }

                const targetScaleY = Math.max(0.4, 0.8 + audioVal * 16 + wave * (0.8 + bgBassLevel * 3.5) + shockBoost);
                b.scale.y += (targetScaleY - b.scale.y) * 0.32;
                b.material.emissiveIntensity = 0.22 + audioVal * 0.45 + (shockBoost > 1 ? 0.35 : 0);

                if (th.isAuto) {
                    const c = new THREE.Color().setHSL((autoHue + u.normDist * 0.4) % 1, 0.9, 0.55);
                    b.material.color.copy(c);
                    b.material.emissive.copy(c);
                }
            }
        } else if (currentVis === 'orb' && orbMesh) {
            const pos = orbMesh.geometry.attributes.position;
            orbMesh.rotation.y += 0.01 + bgBassLevel * 0.03;
            orbMesh.rotation.x += 0.006;
            for (let i = 0; i < pos.count; i++) {
                const orig = orbVertices[i];
                const bin = (i * 3) % (dataArr.length - 1);
                const factor = 1 + ((dataArr[bin] || 0) / 255) * 0.75 + bgBassLevel * 0.35;
                pos.setXYZ(i, orig.x * factor, orig.y * factor, orig.z * factor);
            }
            pos.needsUpdate = true;

            if (orbInnerCore) {
                const coreScale = 1 + bgBassLevel * 0.5;
                orbInnerCore.scale.set(coreScale, coreScale, coreScale);
                orbInnerCore.rotation.y -= 0.015;
                orbInnerCore.rotation.x += 0.01;
            }

            // Triple Gyroscope Gimbals
            if (orbRing1) orbRing1.rotation.z += 0.012 + bgBassLevel * 0.02;
            if (orbRing2) orbRing2.rotation.y += 0.015 + bgBassLevel * 0.025;
            if (orbRing3) orbRing3.rotation.x += 0.01 + bgBassLevel * 0.018;

            // Equatorial Satellites
            if (orbEquatorBeacons) {
                for (let i = 0; i < orbEquatorBeacons.length; i++) {
                    const bin = (i * 4) % (dataArr.length - 1);
                    const val = (dataArr[bin] || 0) / 255;
                    const scaleY = 1 + val * 3.8 + bgBassLevel * 2.2;
                    orbEquatorBeacons[i].scale.y += (scaleY - orbEquatorBeacons[i].scale.y) * 0.3;
                }
            }

            // Cosmic Particle Spark Cloud
            if (orbParticles) {
                orbParticles.rotation.y += 0.006 + bgBassLevel * 0.015;
                orbParticles.rotation.x -= 0.003;
            }

            if (th.isAuto) {
                const c = new THREE.Color().setHSL(autoHue, 0.9, 0.55);
                orbMesh.material.color.copy(c);
                orbMesh.material.emissive.copy(c);
                if (orbInnerCore) {
                    orbInnerCore.material.color.copy(c);
                    orbInnerCore.material.emissive.copy(c);
                }
            }
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
            if (pulseInnerBars) {
                for (let i = 0; i < pulseInnerBars.length; i++) {
                    const a = (i / pulseInnerBars.length) * Math.PI * 2;
                    const h = Math.sin(a * 3 - time * 1.5) * 0.35;
                    const tgt = Math.max(0.6, 1.2 + h);
                    pulseInnerBars[i].scale.y += (tgt - pulseInnerBars[i].scale.y) * 0.12;
                }
            }
            if (pulseOuterGrp) pulseOuterGrp.rotation.z += 0.0015;
            if (pulseInnerGrp) pulseInnerGrp.rotation.z -= 0.0025;
            if (pulseGyroCore) {
                pulseGyroCore.rotation.x += 0.01;
                pulseGyroCore.rotation.y += 0.015;
                pulseGyroCore.scale.set(1, 1, 1);
            }
        } else if (currentVis === 'wave') {
            for (let i = 0; i < waveBars.length; i++) {
                const n = i / waveBars.length;
                const tgt = Math.max(0.7, 1.3 + Math.sin(n * Math.PI * 2 + time * 2) * 0.55);
                waveBars[i].scale.y += (tgt - waveBars[i].scale.y) * 0.12;
                if (waveMirrorBars[i]) {
                    waveMirrorBars[i].scale.y += (tgt * 0.6 - waveMirrorBars[i].scale.y) * 0.12;
                }
                if (wavePeakBeads[i]) {
                    wavePeakBeads[i].position.y = -5 + waveBars[i].scale.y + 0.26;
                }
            }
        } else if (currentVis === 'grid') {
            for (let i = 0; i < vgridBars.length; i++) {
                const b = vgridBars[i];
                const u = b.userData;
                const wave = Math.sin(u.dist * 0.45 - time * 2.5) * Math.cos(u.angle * 2 + time * 0.8);
                const tgt = Math.max(0.4, 1.2 + wave * 1.5);
                b.scale.y += (tgt - b.scale.y) * 0.14;
                b.material.emissiveIntensity = 0.45 + (wave * 0.35 + 0.35);
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
            if (orbInnerCore) orbInnerCore.rotation.y -= 0.006;
            if (orbRing1) orbRing1.rotation.z += 0.006;
            if (orbRing2) orbRing2.rotation.y += 0.008;
            if (orbRing3) orbRing3.rotation.x += 0.005;
            if (orbParticles) {
                orbParticles.rotation.y += 0.003;
            }
            if (orbEquatorBeacons) {
                for (let i = 0; i < orbEquatorBeacons.length; i++) {
                    const wave = Math.sin(time * 3 + i * 0.3) * 0.4;
                    orbEquatorBeacons[i].scale.y = 1 + wave;
                }
            }
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

let playlist = [
    { id: 'demo-1', title: 'Synthwave Pulse', artist: 'RetroWave Studio', src: '/audio/synthwave.mp3', thumb: 'favicon.svg', type: 'demo' },
    { id: 'demo-2', title: 'Lofi Chill Beats', artist: 'Lofi Studio', src: '/audio/lofi.mp3', thumb: 'favicon.svg', type: 'demo' },
    { id: 'demo-3', title: 'Acoustic Harmony', artist: 'Ambient Vibes', src: '/audio/chill.mp3', thumb: 'favicon.svg', type: 'demo' }
];
let currentTrackIdx = -1;
let isShuffle = false;
let repeatMode = 'off'; // 'off' | 'all' | 'one'

function renderPlaylistUI() {
    const box = document.getElementById('queue-list-box');
    const countEl = document.getElementById('queue-count');
    if (countEl) countEl.innerText = `${playlist.length}`;
    if (!box) return;

    if (playlist.length === 0) {
        box.innerHTML = '<div class="queue-empty-state">Queue is empty.<br>Drop files or add streams!</div>';
        return;
    }

    box.innerHTML = '';
    playlist.forEach((track, idx) => {
        const item = document.createElement('div');
        item.className = `queue-item ${idx === currentTrackIdx ? 'active' : ''}`;
        item.innerHTML = `
            <div class="queue-item-info">
                <span class="queue-item-title">${idx + 1}. ${track.title}</span>
                <span class="queue-item-sub">${track.artist || 'Audio Track'}</span>
            </div>
            <button class="queue-remove-btn" title="Remove track">&times;</button>
        `;
        item.querySelector('.queue-item-info').addEventListener('click', () => {
            playTrackAtIndex(idx);
        });
        item.querySelector('.queue-remove-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            removeFromPlaylist(idx);
        });
        box.appendChild(item);
    });
}

function addToPlaylist(track, playImmediately = false) {
    track.id = track.id || (Date.now() + Math.random());
    playlist.push(track);
    renderPlaylistUI();
    if (playImmediately || (playlist.length === 1 && (!curAudioEl || curAudioEl.paused))) {
        playTrackAtIndex(playlist.length - 1);
    } else {
        showToast(`Queued: ${track.title}`);
    }
}

function removeFromPlaylist(idx) {
    if (idx < 0 || idx >= playlist.length) return;
    playlist.splice(idx, 1);
    if (idx === currentTrackIdx) {
        if (playlist.length > 0) {
            currentTrackIdx = Math.min(idx, playlist.length - 1);
            playTrackAtIndex(currentTrackIdx);
        } else {
            currentTrackIdx = -1;
            if (curAudioEl) { curAudioEl.pause(); curAudioEl.src = ''; }
            updatePlayIcons(false);
            updateTrackInfo('No Track Playing', 'Queue is empty', null);
        }
    } else if (idx < currentTrackIdx) {
        currentTrackIdx--;
    }
    renderPlaylistUI();
}

function clearPlaylist() {
    playlist = [];
    currentTrackIdx = -1;
    renderPlaylistUI();
    showToast('Playlist cleared');
}

function playTrackAtIndex(idx) {
    if (idx < 0 || idx >= playlist.length) return;
    currentTrackIdx = idx;
    renderPlaylistUI();

    const track = playlist[idx];
    if (track.type === 'stream' || track.url) {
        playStream(track.url || track.src, track);
    } else {
        const t = (track.title || '').toLowerCase();
        if (t.includes('synth') || t.includes('cyber')) applyTheme('cyber');
        else if (t.includes('lofi') || t.includes('chill')) applyTheme('lofi');
        else if (t.includes('phonk') || t.includes('drift')) applyTheme('phonk');
        else if (t.includes('acoustic') || t.includes('piano')) applyTheme('serious');

        playDirectAudio(track.src, track.title, track.artist);
    }
}

function playNextTrack(auto = false) {
    if (playlist.length === 0) {
        updatePlayIcons(false);
        return;
    }

    if (repeatMode === 'one' && auto) {
        if (curAudioEl) { curAudioEl.currentTime = 0; curAudioEl.play(); }
        return;
    }

    if (isShuffle) {
        let nextIdx = Math.floor(Math.random() * playlist.length);
        if (playlist.length > 1 && nextIdx === currentTrackIdx) {
            nextIdx = (nextIdx + 1) % playlist.length;
        }
        playTrackAtIndex(nextIdx);
        return;
    }

    if (currentTrackIdx + 1 < playlist.length) {
        playTrackAtIndex(currentTrackIdx + 1);
    } else if (repeatMode === 'all') {
        playTrackAtIndex(0);
    } else {
        updatePlayIcons(false);
        if (!auto) showToast('Reached end of playlist');
    }
}

function playPrevTrack() {
    if (playlist.length === 0) return;
    if (curAudioEl && curAudioEl.currentTime > 3) {
        curAudioEl.currentTime = 0;
        return;
    }
    if (currentTrackIdx > 0) {
        playTrackAtIndex(currentTrackIdx - 1);
    } else {
        playTrackAtIndex(playlist.length - 1);
    }
}

let currentLyrics = [];
let activeLyricIdx = -1;
let isLyricsSynced = false;
let isLyricsOpen = false;

function parseLRC(text) {
    if (!text) return [];
    const lines = text.split('\n');
    const result = [];
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;
    for (const line of lines) {
        const m = line.match(timeRegex);
        if (m) {
            const min = parseInt(m[1], 10);
            const sec = parseInt(m[2], 10);
            const ms = parseFloat('0.' + m[3]);
            const time = min * 60 + sec + ms;
            const lyric = m[4].trim();
            if (lyric) {
                result.push({ time, text: lyric });
            }
        }
    }
    return result.sort((a, b) => a.time - b.time);
}

async function loadLyricsForTrack(title, artist) {
    const hudBody = document.getElementById('lyrics-hud-body');
    if (!hudBody) return;
    hudBody.innerHTML = '<div class="lyrics-empty-msg">Searching synchronized lyrics... 🎵</div>';
    currentLyrics = [];
    activeLyricIdx = -1;
    isLyricsSynced = false;

    try {
        const res = await fetch(`/api/lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist || '')}`);
        const data = await res.json();
        
        if (!data.found) {
            hudBody.innerHTML = `<div class="lyrics-empty-msg">No synchronized lyrics found for "${title}".<br><span style="opacity:0.6;font-size:9px;">Enjoy the visualizer!</span></div>`;
            return;
        }

        if (data.syncedLyrics) {
            isLyricsSynced = true;
            currentLyrics = parseLRC(data.syncedLyrics);
            if (currentLyrics.length === 0) {
                renderPlainLyrics(data.plainLyrics || data.syncedLyrics);
                return;
            }

            hudBody.innerHTML = '';
            currentLyrics.forEach((l, idx) => {
                const lineEl = document.createElement('div');
                lineEl.className = 'lyric-line';
                lineEl.dataset.idx = idx;
                lineEl.innerText = l.text;
                lineEl.addEventListener('click', () => {
                    if (curAudioEl) {
                        curAudioEl.currentTime = l.time;
                    }
                });
                hudBody.appendChild(lineEl);
            });
        } else if (data.plainLyrics) {
            renderPlainLyrics(data.plainLyrics);
        }
    } catch (err) {
        hudBody.innerHTML = '<div class="lyrics-empty-msg">Could not load lyrics.</div>';
    }
}

function renderPlainLyrics(plainText) {
    const hudBody = document.getElementById('lyrics-hud-body');
    if (!hudBody) return;
    isLyricsSynced = false;
    hudBody.innerHTML = '';
    const lines = plainText.split('\n');
    lines.forEach(line => {
        if (!line.trim()) return;
        const div = document.createElement('div');
        div.className = 'lyric-line';
        div.innerText = line;
        hudBody.appendChild(div);
    });
}

function updateLyricsProgress(currentTime) {
    if (!isLyricsSynced || currentLyrics.length === 0) return;
    
    let curIdx = -1;
    for (let i = 0; i < currentLyrics.length; i++) {
        if (currentTime >= currentLyrics[i].time) {
            curIdx = i;
        } else {
            break;
        }
    }

    if (curIdx !== activeLyricIdx) {
        activeLyricIdx = curIdx;
        const hudBody = document.getElementById('lyrics-hud-body');
        if (!hudBody) return;

        const lineEls = hudBody.querySelectorAll('.lyric-line');
        lineEls.forEach((el, idx) => {
            el.classList.toggle('active', idx === curIdx);
            el.classList.toggle('passed', idx < curIdx);
        });

        if (curIdx >= 0 && lineEls[curIdx]) {
            lineEls[curIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

function fmtTime(s) {
    if (!s || isNaN(s)) return '00:00';
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
        updateLyricsProgress(el.currentTime);
    };
    el.onended = () => {
        playNextTrack(true);
    };
}

function playDirectAudio(src, title, artist) {
    stopMic();
    const thisSession = ++currentAudioSessionId;
    updateTrackInfo(title, artist, null);
    if (sourceBadge) sourceBadge.innerText = 'PLAYING';

    if (curAudioEl) { curAudioEl.pause(); curAudioEl.src = ''; }

    curAudioEl = new Audio();
    curAudioEl.crossOrigin = 'anonymous';
    curAudioEl.src = src;
    curAudioEl.playbackRate = FX_SPEEDS[fxSpeedIdx];

    curAudioEl.oncanplay = () => {
        if (currentAudioSessionId !== thisSession) return;
        ensureAudioCtx();
        attachAudioElement(curAudioEl);
        curAudioEl.play().catch(() => {});
        updatePlayIcons(true);
    };
    curAudioEl.onerror = () => {
        if (currentAudioSessionId === thisSession && curAudioEl.error?.code !== 20) {
            updatePlayIcons(false);
        }
    };
    attachTimeEvents(curAudioEl);
}

async function playStream(query, presetMeta = null) {
    if (!query) return;

    stopMic();
    const thisSession = ++currentAudioSessionId;
    if (sourceBadge) sourceBadge.innerText = 'STREAM';
    updateTrackInfo(presetMeta?.title || query, presetMeta?.uploader || 'Streaming audio', presetMeta?.thumbnail);

    try {
        let meta = presetMeta;
        if (!meta) {
            const r = await fetch(`/metadata?url=${encodeURIComponent(query)}`);
            meta = await r.json();
        }
        if (currentAudioSessionId !== thisSession) return;
        updateTrackInfo(meta.title || query, meta.uploader || 'Unknown Artist', meta.thumbnail);

        if (curAudioEl) { curAudioEl.pause(); curAudioEl.src = ''; }
        curAudioEl = new Audio();
        curAudioEl.crossOrigin = 'anonymous';
        curAudioEl.src = `/stream?url=${encodeURIComponent(query)}`;
        curAudioEl.playbackRate = FX_SPEEDS[fxSpeedIdx];

        curAudioEl.oncanplay = () => {
            if (currentAudioSessionId !== thisSession) return;
            ensureAudioCtx();
            attachAudioElement(curAudioEl);
            curAudioEl.play().catch(() => {});
            updatePlayIcons(true);
        };
        curAudioEl.onerror = () => {
            if (currentAudioSessionId === thisSession && curAudioEl.error?.code !== 20) {
                updatePlayIcons(false);
                showToast('Stream buffer notice: Retrying or switch to Demos.');
            }
        };
        attachTimeEvents(curAudioEl);

    } catch (_) {
        if (currentAudioSessionId === thisSession) {
            updatePlayIcons(false);
            showToast('Stream connection notice: Use DEMOS or local MP3.');
        }
    }
}

function togglePlay() {
    if (isMicActive) return;
    if (!curAudioEl || !curAudioEl.src) {
        if (playlist.length > 0) {
            playTrackAtIndex(0);
        } else {
            playDirectAudio('/audio/synthwave.mp3', 'Synthwave Pulse', 'RetroWave Studio');
        }
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

document.getElementById('prev-track-btn')?.addEventListener('click', playPrevTrack);
document.getElementById('next-track-btn')?.addEventListener('click', () => playNextTrack(false));

const repeatBtn = document.getElementById('repeat-btn');
repeatBtn?.addEventListener('click', () => {
    if (repeatMode === 'off') {
        repeatMode = 'all';
        repeatBtn.classList.add('active');
        repeatBtn.title = 'Repeat Mode: ALL (L)';
        showToast('Repeat Mode: ALL');
    } else if (repeatMode === 'all') {
        repeatMode = 'one';
        repeatBtn.classList.add('active');
        repeatBtn.title = 'Repeat Mode: ONE (L)';
        showToast('Repeat Mode: SINGLE TRACK');
    } else {
        repeatMode = 'off';
        repeatBtn.classList.remove('active');
        repeatBtn.title = 'Repeat Mode: OFF (L)';
        showToast('Repeat Mode: OFF');
    }
});

const shuffleBtn = document.getElementById('shuffle-btn');
shuffleBtn?.addEventListener('click', () => {
    isShuffle = !isShuffle;
    shuffleBtn.classList.toggle('active', isShuffle);
    showToast(`Shuffle Mode: ${isShuffle ? 'ON' : 'OFF'}`);
});

document.getElementById('clear-queue-btn')?.addEventListener('click', clearPlaylist);

document.getElementById('queue-all-presets-btn')?.addEventListener('click', () => {
    const demos = [
        { title: 'Synthwave Pulse', artist: 'RetroWave Studio', src: '/audio/synthwave.mp3', thumb: 'favicon.svg', type: 'demo' },
        { title: 'Lofi Chill Beats', artist: 'Lofi Studio', src: '/audio/lofi.mp3', thumb: 'favicon.svg', type: 'demo' },
        { title: 'Acoustic Harmony', artist: 'Ambient Vibes', src: '/audio/chill.mp3', thumb: 'favicon.svg', type: 'demo' }
    ];
    demos.forEach(d => addToPlaylist(d, false));
    showToast('Enqueued all 3 demo stems!');
});

document.querySelectorAll('.deck-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.deck-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.tab;
        document.getElementById('tab-presets').style.display = target === 'presets' ? 'block' : 'none';
        document.getElementById('tab-search').style.display  = target === 'search'  ? 'block' : 'none';
        document.getElementById('tab-queue').style.display   = target === 'queue'   ? 'block' : 'none';
        document.getElementById('tab-upload').style.display  = target === 'upload'  ? 'block' : 'none';
        if (target === 'queue') renderPlaylistUI();
    });
});

document.querySelectorAll('.preset-row').forEach(row => {
    row.addEventListener('click', () => {
        document.querySelectorAll('.preset-row').forEach(r => r.classList.remove('active'));
        row.classList.add('active');
        const trackObj = {
            title: row.dataset.title || 'Demo Track',
            artist: row.dataset.artist || 'Studio',
            src: row.dataset.src,
            thumb: 'favicon.svg',
            type: 'demo'
        };
        addToPlaylist(trackObj, true);
    });
});

async function handlePlaylistUrl(url) {
    showToast('Resolving playlist tracks...');
    try {
        const res = await fetch('/api/playlist?url=' + encodeURIComponent(url));
        const data = await res.json();
        if (data.tracks && data.tracks.length > 0) {
            playlist = data.tracks.map((t, idx) => ({
                id: 'pl-' + idx + '-' + Date.now(),
                title: t.title,
                artist: t.artist || data.title || 'Stream Track',
                url: t.url,
                thumb: t.thumbnail || data.thumbnail || 'favicon.svg',
                type: 'stream'
            }));
            currentTrackIdx = 0;
            renderPlaylistUI();
            
            document.querySelector('.deck-tab[data-tab="queue"]')?.click();
            playTrackAtIndex(0);
            showToast(`Loaded ${data.tracks.length} tracks from ${data.title || 'playlist'}!`);
            return true;
        } else {
            showToast('No tracks found in playlist. Streaming as single track.');
            return false;
        }
    } catch (e) {
        showToast('Playlist resolve error. Streaming as single track.');
        return false;
    }
}

let suggTimer;
const doSearch = async () => {
    const q = searchInp.value.trim();
    if (!q) return;

    searchInp.value = '';
    if (suggBox) suggBox.style.display = 'none';

    const isPlaylistUrl = q.includes('list=') ||
                          q.includes('playlist') ||
                          q.includes('spotify.com/album') ||
                          q.includes('music.youtube.com/playlist');

    if (isPlaylistUrl && q.startsWith('http')) {
        const ok = await handlePlaylistUrl(q);
        if (ok) return;
    }

    addToPlaylist({ title: q, artist: 'YouTube Stream', url: q, thumb: 'favicon.svg', type: 'stream' }, true);
};
searchBtn?.addEventListener('click', doSearch);
searchInp?.addEventListener('keypress', e => { if (e.key === 'Enter') doSearch(); });

searchInp?.addEventListener('input', () => {
    clearTimeout(suggTimer);
    const q = searchInp.value.trim();
    if (!q || q.length < 2) { if (suggBox) suggBox.style.display = 'none'; return; }
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
                    ${item.thumbnail ? `<img class="suggestion-thumb" src="${item.thumbnail}" alt="" onerror="this.style.display='none'">` : `<div class="suggestion-thumb" style="display:flex;align-items:center;justify-content:center;color:var(--accent);font-size:12px;">♪</div>`}
                    <div class="suggestion-info">
                        <div class="suggestion-title">${item.title}</div>
                        <div class="suggestion-channel">${item.uploader || 'YouTube Stream'}</div>
                    </div>
                `;
                card.onclick = () => {
                    suggBox.style.display = 'none';
                    searchInp.value = '';
                    const trackObj = {
                        title: item.title,
                        artist: item.uploader || 'YouTube Artist',
                        url: item.url,
                        thumb: item.thumbnail,
                        type: 'stream'
                    };
                    addToPlaylist(trackObj, true);
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

function loadLocalFiles(filesList) {
    if (!filesList || filesList.length === 0) return;
    stopMic();
    const files = Array.from(filesList).filter(f => f.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac)$/i.test(f.name));
    if (files.length === 0) return;

    files.forEach((file, idx) => {
        const title = file.name.replace(/\.[^/.]+$/, '');
        const trackObj = {
            id: Date.now() + Math.random(),
            title: title,
            artist: 'Local Audio',
            src: URL.createObjectURL(file),
            thumb: 'favicon.svg',
            type: 'local'
        };
        addToPlaylist(trackObj, idx === 0 && (!curAudioEl || curAudioEl.paused));
    });

    if (sourceBadge) sourceBadge.innerText = 'LOCAL';
    showToast(`Added ${files.length} track(s) to playlist`);
}

fileUpload?.addEventListener('change', e => {
    loadLocalFiles(e.target.files);
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
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
        loadLocalFiles(files);
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

function updateAllBarMaterials() {
    const th = THEMES[currentTheme] || THEMES.phonk;
    const colCenter = new THREE.Color(th.color);
    const colEdge = new THREE.Color(th.secondaryColor || th.color);

    const updateMat = (arr, total) => arr.forEach((b, idx) => {
        const col = th.getColor ? th.getColor(idx, total) : th.color;
        b.material.color.setHex(col);
        b.material.emissive.setHex(col);
    });
    updateMat(pulseBars, pulseBars.length);
    if (pulseInnerBars) updateMat(pulseInnerBars, pulseInnerBars.length);
    updateMat(waveBars, waveBars.length);
    if (waveMirrorBars) updateMat(waveMirrorBars, waveMirrorBars.length);

    if (wavePeakBeads) {
        wavePeakBeads.forEach(b => {
            b.material.color.copy(colEdge);
        });
    }

    if (waveHorizon && waveHorizon.material) {
        waveHorizon.material.color.copy(colCenter);
    }
    if (waveFloor && waveFloor.material) {
        waveFloor.material.color.copy(colCenter);
    }

    if (pulseFloor && pulseFloor.material) {
        pulseFloor.material.color.copy(colCenter);
    }
    if (pulseGyroCore && pulseGyroCore.material) {
        pulseGyroCore.material.color.copy(colCenter);
        pulseGyroCore.material.emissive.copy(colCenter);
    }
    if (pulseHalo && pulseHalo.material) {
        pulseHalo.material.color.copy(colCenter);
    }

    vgridBars.forEach(b => {
        const t = b.userData ? clamp(b.userData.normDist, 0, 1) : 0;
        const col = colCenter.clone().lerp(colEdge, t);
        b.material.color.copy(col);
        b.material.emissive.copy(col);
    });

    if (vgridFloor && vgridFloor.material) {
        vgridFloor.material.color.copy(colCenter);
    }

    if (orbMesh) {
        orbMesh.material.color.setHex(th.color);
        orbMesh.material.emissive.setHex(th.color);
    }
    if (orbInnerCore) {
        orbInnerCore.material.color.copy(colCenter);
        orbInnerCore.material.emissive.copy(colEdge);
    }
    if (orbRing1 && orbRing1.material) {
        orbRing1.material.color.copy(colCenter);
    }
    if (orbRing2 && orbRing2.material) {
        orbRing2.material.color.copy(colEdge);
    }
    if (orbRing3 && orbRing3.material) {
        orbRing3.material.color.copy(colCenter);
    }
    if (orbEquatorBeacons) {
        orbEquatorBeacons.forEach(b => {
            b.material.color.copy(colCenter);
            b.material.emissive.copy(colCenter);
        });
    }
    if (orbParticles && orbParticles.material) {
        orbParticles.material.color.copy(colEdge);
    }
}

function applyTheme(themeKey, skipToast = false) {
    if (!THEMES[themeKey]) return;
    currentTheme = themeKey;
    const th = THEMES[themeKey];

    document.querySelectorAll('.vibe-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.theme === themeKey);
    });

    const root = document.documentElement;
    root.style.setProperty('--accent', th.accent);
    root.style.setProperty('--accent-glow', th.accentGlow);
    root.style.setProperty('--accent-dim', th.accentDim);
    root.style.setProperty('--bg', th.bg);
    root.style.setProperty('--panel', th.panelBg);
    root.style.setProperty('--border', th.border);
    root.style.setProperty('--border-hover', th.borderHover);

    const pl = scene?.children.find(c => c.isPointLight);
    if (pl) pl.color.setHex(th.lightColor);
    if (bloomPass) bloomPass.strength = th.bloomStrength;

    updateAllBarMaterials();
    if (!skipToast) showToast(`Aesthetic Vibe: ${th.name.toUpperCase()}`);
}

document.querySelectorAll('.vibe-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        applyTheme(btn.dataset.theme);
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

const lyricsHud = document.getElementById('lyrics-hud');
const lyricsBtn = document.getElementById('lyrics-btn');
lyricsBtn?.addEventListener('click', () => {
    isLyricsOpen = !isLyricsOpen;
    lyricsBtn.classList.toggle('active', isLyricsOpen);
    if (lyricsHud) lyricsHud.style.display = isLyricsOpen ? 'flex' : 'none';
});
document.getElementById('lyrics-close-btn')?.addEventListener('click', () => {
    isLyricsOpen = false;
    lyricsBtn?.classList.remove('active');
    if (lyricsHud) lyricsHud.style.display = 'none';
});

window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    else if (e.code === 'KeyM') muteBtn?.click();
    else if (e.code === 'KeyY') lyricsBtn?.click();
    else if (e.code === 'KeyR') document.getElementById('reset-cam-btn')?.click();
    else if (e.code === 'KeyF') document.getElementById('fullscreen-btn')?.click();
    else if (e.code === 'KeyU') fxMufflerBtn?.click();
    else if (e.code === 'KeyB') fxBassBtn?.click();
    else if (e.code === 'KeyJ') playPrevTrack();
    else if (e.code === 'KeyK') playNextTrack(false);
    else if (e.code === 'KeyL') document.getElementById('repeat-btn')?.click();
    else if (e.code === 'KeyS') document.getElementById('shuffle-btn')?.click();
    else if (e.code === 'KeyT') {
        const keys = Object.keys(THEMES);
        const nextIdx = (keys.indexOf(currentTheme) + 1) % keys.length;
        applyTheme(keys[nextIdx]);
    }
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

renderPlaylistUI();
initThree();
applyTheme(currentTheme, true);
applyThemeMode(isLightMode);
