/**
 * Wibei Landing Page - VOID Theme WebGL Experience & DSP Audition Engine
 */
(function() {
    'use strict';

    let scene, camera, renderer;
    let starsMesh, starPositions, starBaseColors;
    let gyroRing, gyroCore, gyroOuterCage;
    let shockwavePulse = 0;
    let mouseX = 0, mouseY = 0;
    let targetCameraX = 0, targetCameraY = 0;
    const canvas = document.getElementById('hero-webgl-canvas');

    function initWebGL() {
        if (!canvas) return;

        scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x050507, 0.0012);

        camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 3000);
        camera.position.set(0, 0, 700);

        // 1. VOID Celestial Starfield Lattice
        const starCount = 1800;
        const starGeo = new THREE.BufferGeometry();
        starPositions = new Float32Array(starCount * 3);
        const starColors = new Float32Array(starCount * 3);
        starBaseColors = new Float32Array(starCount * 3);

        const colPureWhite = new THREE.Color(0xffffff);
        const colPlatinum  = new THREE.Color(0xf8fafc);
        const colSlate     = new THREE.Color(0x64748b);
        const colDeepSlate = new THREE.Color(0x334155);

        for (let i = 0; i < starCount; i++) {
            const r = 200 + Math.random() * 1200;
            const theta = Math.random() * Math.PI * 2;
            const phi = (Math.random() - 0.5) * Math.PI;

            starPositions[i * 3]     = r * Math.cos(phi) * Math.cos(theta);
            starPositions[i * 3 + 1] = r * Math.sin(phi);
            starPositions[i * 3 + 2] = r * Math.cos(phi) * Math.sin(theta);

            const rnd = Math.random();
            let c = colSlate;
            if (rnd > 0.85) c = colPureWhite;
            else if (rnd > 0.6) c = colPlatinum;
            else if (rnd < 0.25) c = colDeepSlate;

            starColors[i * 3]     = c.r;
            starColors[i * 3 + 1] = c.g;
            starColors[i * 3 + 2] = c.b;

            starBaseColors[i * 3]     = c.r;
            starBaseColors[i * 3 + 1] = c.g;
            starBaseColors[i * 3 + 2] = c.b;
        }

        starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
        starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

        const starMat = new THREE.PointsMaterial({
            size: 2.4,
            vertexColors: true,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending
        });

        starsMesh = new THREE.Points(starGeo, starMat);
        scene.add(starsMesh);

        // 2. Signature VOID Central Gimbal Ring & Gyro-Core
        const coreGroup = new THREE.Group();
        coreGroup.position.set(0, 0, -50);

        // Outer Ring
        const ringGeo = new THREE.RingGeometry(110, 112, 64);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.35,
            wireframe: false
        });
        gyroRing = new THREE.Mesh(ringGeo, ringMat);
        coreGroup.add(gyroRing);

        // Secondary Dashed Outer Ring
        const ringGeo2 = new THREE.RingGeometry(135, 136, 48);
        const ringMat2 = new THREE.MeshBasicMaterial({
            color: 0x94a3b8,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.2,
            wireframe: true
        });
        const gyroRing2 = new THREE.Mesh(ringGeo2, ringMat2);
        coreGroup.add(gyroRing2);

        // Inner Gyro Octahedron
        const octaGeo = new THREE.OctahedronGeometry(45, 1);
        const octaMat = new THREE.MeshBasicMaterial({
            color: 0xf8fafc,
            wireframe: true,
            transparent: true,
            opacity: 0.55
        });
        gyroCore = new THREE.Mesh(octaGeo, octaMat);
        coreGroup.add(gyroCore);

        // Outer Geodesic Icosahedron Cage
        const cageGeo = new THREE.IcosahedronGeometry(78, 1);
        const cageMat = new THREE.MeshBasicMaterial({
            color: 0x64748b,
            wireframe: true,
            transparent: true,
            opacity: 0.22
        });
        gyroOuterCage = new THREE.Mesh(cageGeo, cageMat);
        coreGroup.add(gyroOuterCage);

        scene.add(coreGroup);

        // 3. Renderer Setup
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        window.addEventListener('resize', onResize);
        window.addEventListener('mousemove', onMouseMove);

        animate();
    }

    function onResize() {
        if (!camera || !renderer) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function onMouseMove(e) {
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        mouseX = (e.clientX - cx) / cx;
        mouseY = (e.clientY - cy) / cy;
        targetCameraX = mouseX * 120;
        targetCameraY = -mouseY * 80;
    }

    function triggerShockwave(intensity = 1.0) {
        shockwavePulse = Math.max(shockwavePulse, intensity);
    }

    function animate() {
        requestAnimationFrame(animate);
        const time = performance.now() * 0.001;

        // Camera damping
        camera.position.x += (targetCameraX - camera.position.x) * 0.05;
        camera.position.y += (targetCameraY - camera.position.y) * 0.05;
        camera.lookAt(0, 0, 0);

        // Stars gentle rotation
        if (starsMesh) {
            starsMesh.rotation.y = time * 0.02;
            starsMesh.rotation.x = Math.sin(time * 0.015) * 0.02;
        }

        // Gyro core motion
        if (gyroCore) {
            gyroCore.rotation.x += 0.008 + shockwavePulse * 0.025;
            gyroCore.rotation.y += 0.012 + shockwavePulse * 0.035;
            const coreScale = 1.0 + shockwavePulse * 0.35;
            gyroCore.scale.set(coreScale, coreScale, coreScale);
            gyroCore.material.opacity = 0.4 + Math.sin(time * 2) * 0.15 + shockwavePulse * 0.45;
        }

        if (gyroOuterCage) {
            gyroOuterCage.rotation.x -= 0.006;
            gyroOuterCage.rotation.z += 0.008;
            const cageScale = 1.0 + shockwavePulse * 0.2;
            gyroOuterCage.scale.set(cageScale, cageScale, cageScale);
        }

        if (gyroRing) {
            gyroRing.rotation.z = time * 0.04;
            gyroRing.rotation.x = Math.sin(time * 0.5) * 0.25;
            gyroRing.rotation.y = Math.cos(time * 0.4) * 0.2;
            const ringScale = 1.0 + shockwavePulse * 0.25;
            gyroRing.scale.set(ringScale, ringScale, ringScale);
            gyroRing.material.opacity = 0.25 + shockwavePulse * 0.5;
        }

        // Decay shockwave
        if (shockwavePulse > 0.001) {
            shockwavePulse *= 0.92;
        } else {
            shockwavePulse = 0;
        }

        renderer.render(scene, camera);
    }

    // ==========================================
    // Real-Time Web Audio DSP Audition Engine
    // ==========================================
    let audioCtx;
    function getAudioCtx() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    function playAuditionTone(mode) {
        const ctx = getAudioCtx();
        const now = ctx.currentTime;

        const mainGain = ctx.createGain();
        mainGain.gain.setValueAtTime(0.18, now);
        mainGain.connect(ctx.destination);

        const filterNode = ctx.createBiquadFilter();

        let freqs = [261.63, 329.63, 392.00];
        let oscType = 'sine';
        let shockIntensity = 0.8;

        if (mode === 'muffler') {
            filterNode.type = 'lowpass';
            filterNode.frequency.setValueAtTime(450, now);
            filterNode.Q.setValueAtTime(3.0, now);
            freqs = [130.81, 164.81];
            oscType = 'triangle';
            shockIntensity = 0.6;
        } else if (mode === 'bass') {
            filterNode.type = 'lowshelf';
            filterNode.frequency.setValueAtTime(140, now);
            filterNode.gain.setValueAtTime(16, now);
            freqs = [55, 110, 165];
            oscType = 'sawtooth';
            shockIntensity = 1.3;
        } else if (mode === 'nightcore') {
            filterNode.type = 'highshelf';
            filterNode.frequency.setValueAtTime(2200, now);
            filterNode.gain.setValueAtTime(7, now);
            freqs = [523.25, 659.25, 783.99, 1046.50];
            oscType = 'sine';
            shockIntensity = 1.0;
        } else {
            // Clean / linear
            filterNode.type = 'allpass';
            filterNode.frequency.setValueAtTime(20000, now);
            shockIntensity = 0.7;
        }

        filterNode.connect(mainGain);
        triggerShockwave(shockIntensity);

        freqs.forEach((f, i) => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();

            osc.type = oscType;
            osc.frequency.setValueAtTime(f, now + (i * 0.07));

            const start = now + (i * 0.07);
            g.gain.setValueAtTime(0, start);
            g.gain.linearRampToValueAtTime(0.16, start + 0.04);
            g.gain.exponentialRampToValueAtTime(0.001, start + 1.1);

            osc.connect(g);
            g.connect(filterNode);

            osc.start(start);
            osc.stop(start + 1.3);
        });
    }

    // Attach button listeners
    document.querySelectorAll('.sound-demo-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.sound-demo-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            playAuditionTone(btn.dataset.mode);
        });
    });

    // Boot
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWebGL);
    } else {
        initWebGL();
    }
})();
