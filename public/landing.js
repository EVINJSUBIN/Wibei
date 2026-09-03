(function() {
    let scene, camera, renderer, particlesMesh;
    const canvas = document.getElementById('hero-webgl-canvas');
    let mouseX = 0, mouseY = 0;

    function initWebGL() {
        if (!canvas) return;
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 2000);
        camera.position.z = 650;

        const count = 1200;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);

        const c1 = new THREE.Color(0xfacc15);
        const c2 = new THREE.Color(0x333333);

        for (let i = 0; i < count; i++) {
            positions[i * 3]     = (Math.random() - 0.5) * 1800;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 1200;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 1200;

            const col = Math.random() > 0.8 ? c1 : c2;
            colors[i * 3]     = col.r;
            colors[i * 3 + 1] = col.g;
            colors[i * 3 + 2] = col.b;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 3,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });

        particlesMesh = new THREE.Points(geometry, material);
        scene.add(particlesMesh);

        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        window.addEventListener('resize', onResize);
        window.addEventListener('mousemove', onMouseMove);
        
        animate();
    }

    function onResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function onMouseMove(event) {
        mouseX = (event.clientX - window.innerWidth / 2) * 0.1;
        mouseY = (event.clientY - window.innerHeight / 2) * 0.1;
    }

    function animate() {
        requestAnimationFrame(animate);
        const time = performance.now() * 0.0005;
        
        if (particlesMesh) {
            particlesMesh.rotation.y = time * 0.15;
            particlesMesh.rotation.x = Math.sin(time * 0.1) * 0.05;
        }

        camera.position.x += (mouseX - camera.position.x) * 0.05;
        camera.position.y += (-mouseY - camera.position.y) * 0.05;
        camera.lookAt(scene.position);

        renderer.render(scene, camera);
    }

    // Audio context for the DSP preview
    let audioCtx;
    function getAudioCtx() {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return audioCtx;
    }

    function playAuditionTone(mode) {
        const ctx = getAudioCtx();
        const now = ctx.currentTime;

        const mainGain = ctx.createGain();
        mainGain.gain.setValueAtTime(0.2, now);
        mainGain.connect(ctx.destination);

        const filterNode = ctx.createBiquadFilter();

        if (mode === 'muffler') {
            filterNode.type = 'lowpass';
            filterNode.frequency.setValueAtTime(450, now);
            filterNode.Q.setValueAtTime(2.5, now);
        } else if (mode === 'bass') {
            filterNode.type = 'lowshelf';
            filterNode.frequency.setValueAtTime(140, now);
            filterNode.gain.setValueAtTime(16, now);
        } else if (mode === 'nightcore') {
            filterNode.type = 'highshelf';
            filterNode.frequency.setValueAtTime(2000, now);
            filterNode.gain.setValueAtTime(6, now);
        } else {
            filterNode.type = 'allpass';
            filterNode.frequency.setValueAtTime(20000, now);
        }

        filterNode.connect(mainGain);

        let freqs = [261.63, 329.63, 392.00];
        let oscType = 'sine';

        if (mode === 'bass') { freqs = [55, 110]; oscType = 'sawtooth'; }
        else if (mode === 'nightcore') { freqs = [523.25, 783.99, 1046.50]; oscType = 'triangle'; }
        else if (mode === 'muffler') { freqs = [130.81, 164.81]; oscType = 'square'; }

        freqs.forEach((f, i) => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            
            osc.type = oscType;
            osc.frequency.setValueAtTime(f, now + (i * 0.1));
            
            const start = now + (i * 0.1);
            g.gain.setValueAtTime(0, start);
            g.gain.linearRampToValueAtTime(0.15, start + 0.05);
            g.gain.exponentialRampToValueAtTime(0.001, start + 1.2);
            
            osc.connect(g);
            g.connect(filterNode);
            
            osc.start(start);
            osc.stop(start + 1.5);
        });
    }

    document.querySelectorAll('.sound-demo-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.sound-demo-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            playAuditionTone(btn.dataset.mode);
        });
    });

    // Polaroid stem audio preview
    let stemAudio = null;
    let currentStemCard = null;

    document.querySelectorAll('.polaroid-card').forEach(card => {
        card.addEventListener('click', () => {
            const src = card.dataset.src;
            if (!src) return;

            if (currentStemCard === card && stemAudio && !stemAudio.paused) {
                stemAudio.pause();
                card.classList.remove('playing');
                currentStemCard = null;
                return;
            }

            document.querySelectorAll('.polaroid-card').forEach(c => c.classList.remove('playing'));

            if (stemAudio) {
                stemAudio.pause();
                stemAudio = null;
            }

            stemAudio = new Audio(src);
            stemAudio.volume = 0.5;
            stemAudio.play().then(() => {
                card.classList.add('playing');
                currentStemCard = card;
            }).catch(() => {});

            stemAudio.onended = () => {
                card.classList.remove('playing');
                currentStemCard = null;
            };
        });
    });

    // Boot
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWebGL);
    } else {
        initWebGL();
    }
})();
