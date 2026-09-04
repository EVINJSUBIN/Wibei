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

function setPulseCenterArt(thumbUrl) {
    if (!pulseArtDiscGrp || !pulseArtDiscMesh) return;

    const isValid = thumbUrl && 
                    typeof thumbUrl === 'string' && 
                    thumbUrl !== 'favicon.svg' && 
                    (thumbUrl.startsWith('http') || thumbUrl.startsWith('/') || thumbUrl.startsWith('blob:') || thumbUrl.startsWith('data:'));

    if (isValid) {
        if (!pulseTextureLoader) pulseTextureLoader = new THREE.TextureLoader();
        pulseTextureLoader.load(
            thumbUrl,
            (tex) => {
                tex.colorSpace = THREE.SRGBColorSpace;
                pulseArtDiscMesh.material.map = tex;
                pulseArtDiscMesh.material.needsUpdate = true;
                pulseArtDiscGrp.visible = true;
                if (pulseGyroCore) {
                    pulseGyroCore.scale.set(1.55, 1.55, 1.55);
                }
            },
            undefined,
            () => {
                pulseArtDiscGrp.visible = false;
                if (pulseGyroCore) pulseGyroCore.scale.set(1, 1, 1);
            }
        );
    } else {
        pulseArtDiscGrp.visible = false;
        if (pulseGyroCore) pulseGyroCore.scale.set(1, 1, 1);
    }
}

function updateAllBarMaterials() {
    const th = THEMES[currentTheme] || THEMES.phonk;
    const colCenter = new THREE.Color(th.color);
    const colEdge = new THREE.Color(th.secondaryColor || th.color);

    pulseBars.forEach(b => {
        const a = b.userData?.angle !== undefined ? b.userData.angle : 0;
        const t = Math.abs(Math.sin(a));
        const col = colCenter.clone().lerp(colEdge, t);
        b.material.color.copy(col);
        b.material.emissive.copy(col);
    });

    waveBars.forEach((b, idx) => {
        const absNorm = Math.abs(b.userData?.norm || 0);
        const col = colCenter.clone().lerp(colEdge, absNorm);
        b.material.color.copy(col);
        b.material.emissive.copy(col);
        if (waveMirrorBars && waveMirrorBars[idx]) {
            waveMirrorBars[idx].material.color.copy(col);
            waveMirrorBars[idx].material.emissive.copy(col);
        }
    });

    if (pulseFloor && pulseFloor.material) {
        pulseFloor.material.color.copy(colCenter);
    }

    if (waveFloor && waveFloor.material) {
        waveFloor.material.color.copy(colCenter);
    }

    if (waveHorizon && waveHorizon.material) {
        waveHorizon.material.color.copy(colCenter);
    }

    if (pulseGyroCore && pulseGyroCore.material) {
        pulseGyroCore.material.color.copy(colCenter);
        pulseGyroCore.material.emissive.copy(colCenter);
    }
    if (pulseHalo && pulseHalo.material) {
        pulseHalo.material.color.copy(colCenter);
    }
    if (pulseArtBorder && pulseArtBorder.material) {
        pulseArtBorder.material.color.copy(colCenter);
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
}

function initThree() {
    const container = document.getElementById('threejs-container');
    scene = new THREE.Scene();
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
    bloomPass.strength = 0.45;
    bloomPass.radius = 0.25;

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

    const ringRodGeo = new THREE.CylinderGeometry(0.38, 0.58, 1, 16);
    ringRodGeo.translate(0, 0.5, 0);

    function makeMat(idx = 0, total = 128) {
        const th = THEMES[currentTheme] || THEMES.phonk;
        const col = th.getColor ? th.getColor(idx, total) : th.color;
        return new THREE.MeshStandardMaterial({
            color: col,
            emissive: col,
            emissiveIntensity: 0.42,
            roughness: 0.18,
            metalness: 0.82,
        });
    }

    pulseGrp = new THREE.Group();
    const ringCount = 128, ringR = 22;
    for (let i = 0; i < ringCount; i++) {
        const m = new THREE.Mesh(ringRodGeo, makeMat(i, ringCount));
        const a = (i / ringCount) * Math.PI * 2;
        m.position.set(Math.cos(a) * ringR, Math.sin(a) * ringR, 0);
        m.rotation.z = a - Math.PI / 2;
        m.userData = { index: i, angle: a };
        pulseGrp.add(m);
        pulseBars.push(m);
    }

    const thInit = THEMES[currentTheme] || THEMES.phonk;

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

    pulseArtDiscGrp = new THREE.Group();
    pulseArtDiscGrp.position.set(0, 0, 0);

    const artGeo = new THREE.CircleGeometry(4.2, 64);
    const artMat = new THREE.MeshBasicMaterial({
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.96
    });
    pulseArtDiscMesh = new THREE.Mesh(artGeo, artMat);
    pulseArtDiscGrp.add(pulseArtDiscMesh);

    const backdropGeo = new THREE.CircleGeometry(4.35, 64);
    const backdropMat = new THREE.MeshStandardMaterial({
        color: 0x070709,
        roughness: 0.2,
        metalness: 0.8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7
    });
    pulseArtBackdrop = new THREE.Mesh(backdropGeo, backdropMat);
    pulseArtBackdrop.position.z = -0.04;
    pulseArtDiscGrp.add(pulseArtBackdrop);

    const borderGeo = new THREE.RingGeometry(4.2, 4.45, 64);
    const borderMat = new THREE.MeshBasicMaterial({
        color: thInit.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
    });
    pulseArtBorder = new THREE.Mesh(borderGeo, borderMat);
    pulseArtBorder.position.z = 0.02;
    pulseArtDiscGrp.add(pulseArtBorder);

    pulseArtDiscGrp.visible = false;
    pulseGrp.add(pulseArtDiscGrp);

    const haloGeo = new THREE.RingGeometry(ringR - 0.4, ringR + 0.4, 64);
    const haloMat = new THREE.MeshBasicMaterial({
        color: thInit.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.35
    });
    pulseHalo = new THREE.Mesh(haloGeo, haloMat);
    pulseGrp.add(pulseHalo);

    pulseFloor = new THREE.GridHelper(56, 20, thInit.color, 0x1f1f2e);
    pulseFloor.position.set(0, -9, 0);
    pulseFloor.material.transparent = true;
    pulseFloor.material.opacity = 0.32;
    pulseGrp.add(pulseFloor);

    visualizerRoot.add(pulseGrp);

    waveGrp = new THREE.Group();
    const waveN = 72;
    waveBars = [];
    waveMirrorBars = [];

    const wavePillarGeo = new THREE.CylinderGeometry(0.58, 0.58, 1, 16);
    wavePillarGeo.translate(0, 0.5, 0);

    const waveMirrorGeo = new THREE.CylinderGeometry(0.58, 0.58, 1, 16);
    waveMirrorGeo.translate(0, -0.5, 0);

    for (let i = 0; i < waveN; i++) {
        const norm = (i - waveN / 2) / (waveN / 2);
        const x = (i - waveN / 2) * 1.35;
        const z = -Math.pow(norm * 2.6, 2) * 1.1;

        const mUp = new THREE.Mesh(wavePillarGeo, makeMat(i, waveN));
        mUp.position.set(x, -5, z);
        mUp.userData = { index: i, norm: norm, x: x };
        waveGrp.add(mUp);
        waveBars.push(mUp);

        const mDown = new THREE.Mesh(waveMirrorGeo, makeMat(i, waveN));
        mDown.position.set(x, -5.2, z);
        mDown.userData = { index: i, norm: norm, x: x };
        waveGrp.add(mDown);
        waveMirrorBars.push(mDown);
    }

    const horizGeo = new THREE.BoxGeometry(waveN * 1.35 + 4, 0.18, 0.4);
    const horizMat = new THREE.MeshBasicMaterial({
        color: thInit.color,
        transparent: true,
        opacity: 0.55
    });
    waveHorizon = new THREE.Mesh(horizGeo, horizMat);
    waveHorizon.position.set(0, -5.1, -1);
    waveGrp.add(waveHorizon);

    waveFloor = new THREE.GridHelper(waveN * 1.35 + 8, 20, thInit.color, 0x1f1f2e);
    waveFloor.position.set(0, -8.5, -1);
    waveFloor.material.transparent = true;
    waveFloor.material.opacity = 0.32;
    waveGrp.add(waveFloor);

    waveGrp.visible = false;
    visualizerRoot.add(waveGrp);

    vgridGrp = new THREE.Group();
    vgridGrp.position.set(0, -6, 0);
    vgridGrp.rotation.x = 0.42;

    vgridFloor = new THREE.GridHelper(MATRIX_DIM * MATRIX_SPACING + 4, MATRIX_DIM, thInit.color, 0x1f1f2e);
    vgridFloor.position.y = -0.05;
    vgridFloor.material.transparent = true;
    vgridFloor.material.opacity = 0.35;
    vgridGrp.add(vgridFloor);

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

    orbGrp = new THREE.Group();

    const sphereGeom = new THREE.IcosahedronGeometry(12, 3);
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

    const innerCoreGeo = new THREE.IcosahedronGeometry(2.4, 1);
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

    const ringGeo = new THREE.TorusGeometry(15.5, 0.14, 16, 80);
    const ringMat1 = new THREE.MeshBasicMaterial({ color: thInit.color, transparent: true, opacity: 0.65 });
    orbRing1 = new THREE.Mesh(ringGeo, ringMat1);
    orbRing1.rotation.x = Math.PI / 4;
    orbRing1.rotation.y = Math.PI / 6;
    orbGrp.add(orbRing1);

    const ringMat2 = new THREE.MeshBasicMaterial({ color: thInit.secondaryColor || thInit.color, transparent: true, opacity: 0.55 });
    orbRing2 = new THREE.Mesh(ringGeo, ringMat2);
    orbRing2.rotation.x = -Math.PI / 3;
    orbRing2.rotation.y = -Math.PI / 4;
    orbGrp.add(orbRing2);

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
            prevMouse = { x: e.clientX, y: e.clientY };
        }
    });
    window.addEventListener('mouseup', () => { isDragging = false; });

    window.addEventListener('resize', () => {
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight);
        composer.setSize(innerWidth, innerHeight);
    });

    setPulseCenterArt('/images/demo-synthwave.svg');
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
                waveGrp.visible = currentVis === 'wave';
                vgridGrp.visible = currentVis === 'grid';
                orbGrp.visible = currentVis === 'orb';
                const geometryBadge = document.getElementById('geometry-badge');
                if (geometryBadge) geometryBadge.innerText = targetVis.toUpperCase();
                document.querySelectorAll('#style-segmented .seg-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.value === targetVis);
                });
            }

            const telemetryMode = document.getElementById('telemetry-mode');
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
        const telemetryFps = document.getElementById('telemetry-fps');
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
            pulseRipplePhase += 0.05 + bgBassLevel * 0.18;

            const nowMs = performance.now();
            if (bgBassLevel > 0.44 && nowMs - lastPulseShockwaveTime > 300) {
                pulseShockwaves.push({
                    radius: 0,
                    speed: 0.08 + bgBassLevel * 0.14,
                    intensity: 1.0,
                    maxRadius: Math.PI + 0.2
                });
                lastPulseShockwaveTime = nowMs;
            }

            pulseShockwaves.forEach(sw => {
                sw.radius += sw.speed;
                sw.intensity *= 0.94;
            });
            pulseShockwaves = pulseShockwaves.filter(sw => sw.radius < sw.maxRadius && sw.intensity > 0.05);

            const half = pulseBars.length / 2;
            const colCenter = new THREE.Color(th.color);
            const colEdge = new THREE.Color(th.secondaryColor || th.color);

            for (let i = 0; i < pulseBars.length; i++) {
                const b = pulseBars[i];
                const a = (b.userData && b.userData.angle !== undefined) ? b.userData.angle : (i / pulseBars.length) * Math.PI * 2;
                const sym = i < half ? i : pulseBars.length - 1 - i;
                const bin = Math.min(dataArr.length - 1, Math.floor((sym / half) * dataArr.length * 0.7));
                const audioVal = (dataArr[bin] || 0) / 255;

                const ripple = Math.sin(a * 4 - pulseRipplePhase) * (0.8 + bgBassLevel * 3.5);

                let shockBoost = 0;
                for (let j = 0; j < pulseShockwaves.length; j++) {
                    const sw = pulseShockwaves[j];
                    const distFromOrigin = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
                    const diff = Math.abs(distFromOrigin - sw.radius);
                    if (diff < 0.6) {
                        shockBoost += Math.exp(-Math.pow(diff / 0.3, 2)) * sw.intensity * 7.5;
                    }
                }

                const targetScaleY = Math.max(0.8, 1 + audioVal * 18 + ripple + shockBoost);
                b.scale.y += (targetScaleY - b.scale.y) * 0.32;
                b.material.emissiveIntensity = 0.22 + audioVal * 0.45 + (shockBoost > 1 ? 0.35 : 0);

                if (th.isAuto) {
                    const c = new THREE.Color().setHSL((autoHue + (i / pulseBars.length) * 0.35) % 1, 0.9, 0.55);
                    b.material.color.copy(c);
                    b.material.emissive.copy(c);
                } else {
                    const t = Math.abs(Math.sin(a));
                    const col = colCenter.clone().lerp(colEdge, t);
                    b.material.color.copy(col);
                    b.material.emissive.copy(col);
                }
            }

            if (pulseArtDiscGrp && pulseArtDiscGrp.visible) {
                pulseArtDiscMesh.rotation.z += (isPlaying ? (0.01 + bgBassLevel * 0.02) : 0.002);
                pulseArtDiscGrp.rotation.y = Math.sin(time * 0.8) * 0.16;
                pulseArtDiscGrp.rotation.x = Math.cos(time * 0.6) * 0.12;
                const discScale = 1 + bgBassLevel * 0.22;
                pulseArtDiscGrp.scale.set(discScale, discScale, discScale);
                if (pulseArtBorder && pulseArtBorder.material) {
                    pulseArtBorder.material.opacity = 0.5 + bgBassLevel * 0.45;
                    if (th.isAuto) {
                        const c = new THREE.Color().setHSL(autoHue, 0.9, 0.6);
                        pulseArtBorder.material.color.copy(c);
                    }
                }
            }

            if (pulseGyroCore) {
                pulseGyroCore.rotation.x += 0.02 + bgBassLevel * 0.04;
                pulseGyroCore.rotation.y += 0.025 + bgBassLevel * 0.05;
                const baseScale = pulseArtDiscGrp?.visible ? 1.55 : 1.0;
                const gyroScale = baseScale + bgBassLevel * 0.65;
                pulseGyroCore.scale.set(gyroScale, gyroScale, gyroScale);
                pulseGyroCore.material.emissiveIntensity = 0.3 + bgBassLevel * 0.4;
                if (th.isAuto) {
                    const c = new THREE.Color().setHSL(autoHue, 0.9, 0.6);
                    pulseGyroCore.material.color.copy(c);
                    pulseGyroCore.material.emissive.copy(c);
                }
            }
            if (pulseHalo) {
                const haloScale = 1 + bgBassLevel * 0.12;
                pulseHalo.scale.set(haloScale, haloScale, 1);
                pulseHalo.material.opacity = 0.25 + bgBassLevel * 0.35;
            }
        } else if (currentVis === 'wave') {
            waveRipplePhase += 0.055 + bgBassLevel * 0.20;

            const nowMs = performance.now();
            if (bgBassLevel > 0.44 && nowMs - lastWaveShockwaveTime > 320) {
                waveShockwaves.push({
                    radius: 0,
                    speed: 0.06 + bgBassLevel * 0.09,
                    intensity: 1.0,
                    maxRadius: 1.2
                });
                lastWaveShockwaveTime = nowMs;
            }

            waveShockwaves.forEach(sw => {
                sw.radius += sw.speed;
                sw.intensity *= 0.94;
            });
            waveShockwaves = waveShockwaves.filter(sw => sw.radius < sw.maxRadius && sw.intensity > 0.05);

            const colCenter = new THREE.Color(th.color);
            const colEdge = new THREE.Color(th.secondaryColor || th.color);

            for (let i = 0; i < waveBars.length; i++) {
                const b = waveBars[i];
                const norm = (b.userData && b.userData.norm !== undefined) ? b.userData.norm : (i - waveBars.length / 2) / (waveBars.length / 2);
                const absNorm = Math.abs(norm);
                const bin = Math.floor((i / waveBars.length) * dataArr.length * 0.65);
                const audioVal = (dataArr[bin] || 0) / 255;

                const ripple = Math.sin(norm * 6 - waveRipplePhase) * (0.8 + bgBassLevel * 3.5);

                let shockBoost = 0;
                for (let j = 0; j < waveShockwaves.length; j++) {
                    const sw = waveShockwaves[j];
                    const diff = Math.abs(absNorm - sw.radius);
                    if (diff < 0.25) {
                        shockBoost += Math.exp(-Math.pow(diff / 0.12, 2)) * sw.intensity * 7.5;
                    }
                }

                const targetH = Math.max(0.6, 1 + audioVal * 19 + ripple + shockBoost);
                b.scale.y += (targetH - b.scale.y) * 0.32;
                b.material.emissiveIntensity = 0.22 + audioVal * 0.45 + (shockBoost > 1 ? 0.35 : 0);

                if (waveMirrorBars[i]) {
                    waveMirrorBars[i].scale.y += (targetH * 0.62 - waveMirrorBars[i].scale.y) * 0.32;
                    waveMirrorBars[i].material.emissiveIntensity = 0.18 + audioVal * 0.35;
                }

                if (th.isAuto) {
                    const c = new THREE.Color().setHSL((autoHue + (i / waveBars.length) * 0.35) % 1, 0.9, 0.55);
                    b.material.color.copy(c);
                    b.material.emissive.copy(c);
                    if (waveMirrorBars[i]) {
                        waveMirrorBars[i].material.color.copy(c);
                        waveMirrorBars[i].material.emissive.copy(c);
                    }
                } else {
                    const col = colCenter.clone().lerp(colEdge, absNorm);
                    b.material.color.copy(col);
                    b.material.emissive.copy(col);
                    if (waveMirrorBars[i]) {
                        waveMirrorBars[i].material.color.copy(col);
                        waveMirrorBars[i].material.emissive.copy(col);
                    }
                }
            }

            if (waveHorizon && waveHorizon.material) {
                waveHorizon.material.opacity = 0.4 + bgBassLevel * 0.4;
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
                const factor = 1 + ((dataArr[bin] || 0) / 255) * 0.85 + bgBassLevel * 0.4;
                pos.setXYZ(i, orig.x * factor, orig.y * factor, orig.z * factor);
            }
            pos.needsUpdate = true;

            if (orbInnerCore) {
                const coreScale = 1 + bgBassLevel * 0.55;
                orbInnerCore.scale.set(coreScale, coreScale, coreScale);
                orbInnerCore.rotation.y -= 0.015;
                orbInnerCore.rotation.x += 0.01;
            }

            if (orbRing1 && orbRing2) {
                orbRing1.rotation.z += 0.012 + bgBassLevel * 0.02;
                orbRing2.rotation.y += 0.015 + bgBassLevel * 0.025;
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
                const b = pulseBars[i];
                const a = (b.userData && b.userData.angle !== undefined) ? b.userData.angle : (i / pulseBars.length) * Math.PI * 2;
                const wave = Math.sin(a * 4 - time * 2.2) * Math.cos(a * 2 + time * 1.1);
                const tgt = Math.max(0.6, 1.25 + wave * 1.4);
                b.scale.y += (tgt - b.scale.y) * 0.14;
                b.material.emissiveIntensity = 0.32 + (wave * 0.22 + 0.22);
            }
            if (pulseArtDiscGrp && pulseArtDiscGrp.visible) {
                pulseArtDiscMesh.rotation.z += 0.003;
                pulseArtDiscGrp.rotation.y = Math.sin(time * 0.5) * 0.1;
                pulseArtDiscGrp.rotation.x = Math.cos(time * 0.4) * 0.08;
                pulseArtDiscGrp.scale.set(1, 1, 1);
            }
            if (pulseGyroCore) {
                pulseGyroCore.rotation.x += 0.01;
                pulseGyroCore.rotation.y += 0.015;
                const baseScale = pulseArtDiscGrp?.visible ? 1.55 : 1.0;
                pulseGyroCore.scale.set(baseScale, baseScale, baseScale);
            }
            if (pulseHalo) {
                pulseHalo.scale.set(1, 1, 1);
                pulseHalo.material.opacity = 0.35;
            }
        } else if (currentVis === 'wave') {
            for (let i = 0; i < waveBars.length; i++) {
                const b = waveBars[i];
                const norm = (b.userData && b.userData.norm !== undefined) ? b.userData.norm : (i - waveBars.length / 2) / (waveBars.length / 2);
                const wave = Math.sin(norm * 5 - time * 2.5);
                const tgt = Math.max(0.5, 1.2 + wave * 1.4);
                b.scale.y += (tgt - b.scale.y) * 0.14;
                b.material.emissiveIntensity = 0.32 + (wave * 0.22 + 0.22);
                if (waveMirrorBars[i]) {
                    waveMirrorBars[i].scale.y += (tgt * 0.6 - waveMirrorBars[i].scale.y) * 0.14;
                    waveMirrorBars[i].material.emissiveIntensity = 0.22 + (wave * 0.16 + 0.16);
                }
            }
            if (waveHorizon && waveHorizon.material) {
                waveHorizon.material.opacity = 0.45;
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
        }
    }

    composer.render();
}
