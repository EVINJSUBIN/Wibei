(function() {
    let scene, camera, renderer, particlesMesh;
    const canvas = document.getElementById('hero-webgl-canvas');
    let mouseX = 0, mouseY = 0;
    let windowHalfX = window.innerWidth / 2;
    let windowHalfY = window.innerHeight / 2;

    function initWebGL() {
        if (!canvas) return;
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 2000);
        camera.position.z = 700;

        const particleCount = 1400;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);

        const colorGold = new THREE.Color(0xfacc15);
        const colorCyan = new THREE.Color(0x06b6d4);
        const colorRose = new THREE.Color(0xf43f5e);

        for (let i = 0; i < particleCount; i++) {
            const x = (Math.random() - 0.5) * 1600;
            const y = (Math.random() - 0.5) * 1200;
            const z = (Math.random() - 0.5) * 1200;

            positions[i * 3]     = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;

            const mixedColor = Math.random() > 0.5 ? colorGold : (Math.random() > 0.5 ? colorCyan : colorRose);
            colors[i * 3]     = mixedColor.r;
            colors[i * 3 + 1] = mixedColor.g;
            colors[i * 3 + 2] = mixedColor.b;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 4,
            vertexColors: true,
            transparent: true,
            opacity: 0.65,
            blending: THREE.AdditiveBlending
        });

        particlesMesh = new THREE.Points(geometry, material);
        scene.add(particlesMesh);

        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        window.addEventListener('resize', onResize);
        window.addEventListener('mousemove', onMouseMove);
        animate();
    }

    function onResize() {
        windowHalfX = window.innerWidth / 2;
        windowHalfY = window.innerHeight / 2;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function onMouseMove(event) {
        mouseX = (event.clientX - windowHalfX) * 0.15;
        mouseY = (event.clientY - windowHalfY) * 0.15;
    }

    function animate() {
        requestAnimationFrame(animate);
        const time = performance.now() * 0.0006;
        
        if (particlesMesh) {
            particlesMesh.rotation.y = time * 0.2;
            particlesMesh.rotation.x = Math.sin(time * 0.3) * 0.1;
        }

        camera.position.x += (mouseX - camera.position.x) * 0.05;
        camera.position.y += (-mouseY - camera.position.y) * 0.05;
        camera.lookAt(scene.position);

        renderer.render(scene, camera);
    }

    let demoCtx, demoOsc, demoGain, demoFilter;
    let isPlayingDemo = false;
    let currentDemoMode = 'none';

    function initDemoAudio() {
        if (!demoCtx) {
            demoCtx = new (window.AudioContext || window.webkitAudioContext)();
            demoFilter = demoCtx.createBiquadFilter();
            demoGain = demoCtx.createGain();
            demoGain.gain.value = 0.15;

            demoFilter.connect(demoGain);
            demoGain.connect(demoCtx.destination);
        }
        if (demoCtx.state === 'suspended') {
            demoCtx.resume();
        }
    }

    function playSynthChord(mode) {
        initDemoAudio();
        currentDemoMode = mode;

        if (mode === 'muffler') {
            demoFilter.type = 'lowpass';
            demoFilter.frequency.setTargetAtTime(450, demoCtx.currentTime, 0.05);
            demoFilter.Q.value = 2.0;
        } else if (mode === 'bass') {
            demoFilter.type = 'lowshelf';
            demoFilter.frequency.setTargetAtTime(140, demoCtx.currentTime, 0.05);
            demoFilter.gain.value = 14;
        } else {
            demoFilter.type = 'allpass';
            demoFilter.frequency.setTargetAtTime(20000, demoCtx.currentTime, 0.05);
        }

        const notes = [130.81, 164.81, 196.00, 246.94];
        notes.forEach((freq, idx) => {
            const osc = demoCtx.createOscillator();
            const noteGain = demoCtx.createGain();

            osc.type = mode === 'bass' ? 'sawtooth' : 'sine';
            osc.frequency.setValueAtTime(freq, demoCtx.currentTime);

            noteGain.gain.setValueAtTime(0, demoCtx.currentTime);
            noteGain.gain.linearRampToValueAtTime(0.12, demoCtx.currentTime + 0.08);
            noteGain.gain.exponentialRampToValueAtTime(0.0001, demoCtx.currentTime + 1.6 + idx * 0.1);

            osc.connect(noteGain);
            noteGain.connect(demoFilter);

            osc.start();
            osc.stop(demoCtx.currentTime + 1.8);
        });
    }

    document.querySelectorAll('.dsp-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.dsp-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const mode = chip.dataset.mode;
            playSynthChord(mode);
        });
    });

    initWebGL();
})();
