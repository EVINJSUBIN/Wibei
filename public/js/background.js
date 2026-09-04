const bgCanvas = document.getElementById('bg-canvas');
const bgCtx = bgCanvas ? bgCanvas.getContext('2d') : null;

let particles = [];
let rings = [];
let ringSpawnTimer = 0;
let comicGlyphs = [];
let cyberDrops = [];
let lofiOrbs = [];
let lightningBolts = [];
let voidStars = [];
let autoDetectedMood = 'phonk';

function resizeCanvas() {
    if (!bgCanvas) return;
    bgCanvas.width = window.innerWidth;
    bgCanvas.height = window.innerHeight;
    if (bgTexture) bgTexture.needsUpdate = true;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function spawnParticle(randomY) {
    if (!bgCanvas) return;
    particles.push({
        x: Math.random() * bgCanvas.width,
        y: randomY ? Math.random() * bgCanvas.height : bgCanvas.height + 4,
        r: 0.8 + Math.random() * 1.6,
        speed: 0.2 + Math.random() * 0.35,
        drift: (Math.random() - 0.5) * 0.3,
        alpha: 0.05 + Math.random() * 0.12,
    });
}
for (let i = 0; i < 100; i++) spawnParticle(true);

function spawnRing() {
    if (!bgCanvas) return;
    rings.push({
        cx: bgCanvas.width / 2 + (Math.random() - 0.5) * 60,
        cy: bgCanvas.height / 2 + (Math.random() - 0.5) * 40,
        r: 0,
        alpha: 0.2
    });
}
spawnRing();

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
    if (!bgCanvas) return;
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
    if (!bgCanvas) return;
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

function drawDotsFrame() {
    if (!bgCtx || !bgCanvas) return;
    const accentCol = getActiveAccentColor();
    const boost = 1 + bgBassLevel * 1.8;
    particles.forEach(p => {
        p.y -= p.speed * boost;
        p.x += p.drift;
        if (p.y < -4) { p.y = bgCanvas.height + 4; p.x = Math.random() * bgCanvas.width; }
        if (p.x < -4 || p.x > bgCanvas.width + 4) p.x = Math.random() * bgCanvas.width;
        bgCtx.beginPath();
        bgCtx.arc(p.x, p.y, p.r * (1 + bgBassLevel * 0.6), 0, Math.PI * 2);
        bgCtx.fillStyle = accentCol;
        bgCtx.globalAlpha = p.alpha * (1 + bgBassLevel * 0.7);
        bgCtx.fill();
    });
}

function drawRingsFrame() {
    if (!bgCtx || !bgCanvas) return;
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
        ring.r += expandSpeed;
        ring.alpha = Math.max(0, ring.alpha - 0.0009 - bgBassLevel * 0.002);
        bgCtx.beginPath();
        bgCtx.arc(ring.cx, ring.cy, ring.r, 0, Math.PI * 2);
        bgCtx.lineWidth = 1.2 + bgBassLevel * 1.5;
        bgCtx.globalAlpha = ring.alpha;
        bgCtx.stroke();
    });
}

function drawComicFrame() {
    if (!bgCtx || !bgCanvas) return;
    const w = bgCanvas.width, h = bgCanvas.height;
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

function drawPhonkFrame() {
    if (!bgCtx || !bgCanvas) return;
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

function drawLofiFrame() {
    if (!bgCtx || !bgCanvas) return;
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

function drawCyberFrame() {
    if (!bgCtx || !bgCanvas) return;
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

function drawAtmosphericAura() {
    if (!bgCtx || !bgCanvas) return;
    const w = bgCanvas.width, h = bgCanvas.height;
    const cx = w / 2, cy = h / 2;
    const th = THEMES[currentTheme] || THEMES.phonk;
    const accentCol = getActiveAccentColor();
    const secCol = th.secondaryColor ? ('#' + new THREE.Color(th.secondaryColor).getHexString()) : accentCol;

    bgCtx.fillStyle = th.bg || '#070709';
    bgCtx.fillRect(0, 0, w, h);

    const maxR = Math.max(w, h) * 0.45;
    const auraGrad = bgCtx.createRadialGradient(cx, cy, 10, cx, cy, maxR);
    const coreAlpha = 0.04 + bgBassLevel * 0.05;
    const midAlpha = 0.015 + bgBassLevel * 0.02;
    auraGrad.addColorStop(0, hexToRgba(accentCol, coreAlpha));
    auraGrad.addColorStop(0.45, hexToRgba(secCol, midAlpha));
    auraGrad.addColorStop(0.85, hexToRgba(accentCol, 0.003));
    auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    bgCtx.fillStyle = auraGrad;
    bgCtx.fillRect(0, 0, w, h);

    const vigGrad = bgCtx.createRadialGradient(cx, cy, Math.min(w, h) * 0.4, cx, cy, Math.max(w, h) * 0.72);
    vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vigGrad.addColorStop(1, 'rgba(0, 0, 0, 0.68)');
    bgCtx.fillStyle = vigGrad;
    bgCtx.fillRect(0, 0, w, h);
}

function drawSeriousFrame() {
    if (!bgCtx) return;
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
    if (!bgCtx || !bgCanvas) return;
    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    bgCtx.globalAlpha = 1;

    drawAtmosphericAura();

    if (currentBg === 'vibe') drawVibeFrame();
    else if (currentBg === 'dots') drawDotsFrame();
    else if (currentBg === 'rings') drawRingsFrame();
    bgCtx.globalAlpha = 1;

    if (bgTexture) bgTexture.needsUpdate = true;
}
animateBg();
