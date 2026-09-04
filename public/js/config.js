const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function hexToRgba(hex, alpha = 1.0) {
    if (!hex) return `rgba(255, 255, 255, ${alpha})`;
    if (hex.startsWith('rgba')) return hex;
    if (hex.startsWith('rgb')) return hex.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(ch => ch + ch).join('');
    const num = parseInt(c, 16);
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

const FX_SPEEDS = [1.0, 1.25, 0.85];

const MATRIX_DIM = 18;
const MATRIX_SPACING = 2.15;
const MATRIX_MAX_DIST = Math.hypot((MATRIX_DIM / 2) * MATRIX_SPACING, (MATRIX_DIM / 2) * MATRIX_SPACING);

let audioCtx, analyser, dataArr, audioSrc, curAudioEl;
let biquadMuffler, biquadBass, masterGain;
let isPlaying = false;
let isMicActive = false;
let micStream = null;
let queue = [];

let fxMuffler = false;
let fxBassBoost = false;
let fxSpeedIdx = 0;

let scene, camera, renderer, composer, bloomPass, bgTexture;
let visualizerRoot, shockwaveGroup;
let pulseGrp, waveGrp, vgridGrp, orbGrp;
let vgridFloor, pulseFloor, waveFloor;
let pulseBars = [], waveBars = [], waveMirrorBars = [], vgridBars = [], orbVertices = [];
let orbMesh, orbWireMesh, orbInnerCore, orbRing1, orbRing2;
let pulseGyroCore, pulseHalo, waveHorizon;
let pulseArtDiscGrp, pulseArtDiscMesh, pulseArtBorder, pulseArtBackdrop, pulseTextureLoader;

let matrixRipplePhase = 0;
let matrixShockwaves = [];
let lastMatrixShockwaveTime = 0;

let pulseRipplePhase = 0;
let pulseShockwaves = [];
let lastPulseShockwaveTime = 0;

let waveRipplePhase = 0;
let waveShockwaves = [];
let lastWaveShockwaveTime = 0;

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

let currentTheme = 'serious';
let autoHue = 0;
let currentVis = 'pulse';
let currentBg = 'vibe';
let isAutoCam = false;
let autoCamAngle = 0;
let bgBassLevel = 0;
let lastBassEnergy = 0;

let mouseX = 0, mouseY = 0;
let targetRotX = 0, targetRotY = 0;
let isDragging = false;
let prevMouse = { x: 0, y: 0 };

let lastFpsTime = performance.now();
let frameCounter = 0;
let currentFps = 60;

let isLyricsOpen = false;
let lyricsData = [];
let lyricsCurrentLine = -1;

let toastTimer = null;
let suggTimer = null;
let repeatMode = 'none';
let isShuffle = false;

let isLightMode = localStorage.getItem('wibei_theme_mode') === 'light';

function showToast(msg, duration = 2400) {
    let t = document.getElementById('toast-notification');
    if (!t) {
        t = document.createElement('div');
        t.id = 'toast-notification';
        t.className = 'toast-notification';
        document.body.appendChild(t);
    }
    t.innerText = msg;
    t.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        t.classList.remove('visible');
    }, duration);
}

function getActiveAccentColor() {
    const th = THEMES[currentTheme] || THEMES.phonk;
    if (th.isAuto) {
        return '#' + new THREE.Color().setHSL(autoHue, 0.9, 0.55).getHexString();
    }
    return th.accent;
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

    if (typeof updateAllBarMaterials === 'function') {
        updateAllBarMaterials();
    }
    if (!skipToast) showToast(`Aesthetic Vibe: ${th.name.toUpperCase()}`);
}

function applyThemeMode(light) {
    isLightMode = light;
    document.body.classList.toggle('light-mode', light);
    const themeSunIcon = document.querySelector('.theme-sun-icon');
    const themeMoonIcon = document.querySelector('.theme-moon-icon');
    if (themeSunIcon && themeMoonIcon) {
        themeSunIcon.style.display = light ? 'block' : 'none';
        themeMoonIcon.style.display = light ? 'none' : 'block';
    }
    if (bloomPass) {
        bloomPass.threshold = light ? 0.88 : 0.82;
        bloomPass.strength = light ? 0.38 : 0.45;
    }
    localStorage.setItem('wibei_theme_mode', light ? 'light' : 'dark');
}
