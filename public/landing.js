(function() {
    let scene, camera, renderer, particlesMesh;
    const canvas = document.getElementById('hero-webgl-canvas');
    let mouseX = 0, mouseY = 0;
    let windowHalfX = window.innerWidth / 2;
    let windowHalfY = window.innerHeight / 2;
    let scrollY = 0;

    function initWebGL() {
        if (!canvas) return;
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 2000);
        camera.position.z = 650;

        const count = 1600;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);

        const gold = new THREE.Color(0xfacc15);
        const cyan = new THREE.Color(0x38bdf8);
        const rose = new THREE.Color(0xfb7185);

        for (let i = 0; i < count; i++) {
            const x = (Math.random() - 0.5) * 1800;
            const y = (Math.random() - 0.5) * 1200;
            const z = (Math.random() - 0.5) * 1200;

            positions[i * 3]     = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;

            const col = Math.random() > 0.6 ? gold : (Math.random() > 0.3 ? cyan : rose);
            colors[i * 3]     = col.r;
            colors[i * 3 + 1] = col.g;
            colors[i * 3 + 2] = col.b;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 4.5,
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
        window.addEventListener('scroll', () => {
            scrollY = window.scrollY || window.pageYOffset;
        });
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
        mouseX = (event.clientX - windowHalfX) * 0.12;
        mouseY = (event.clientY - windowHalfY) * 0.12;
    }

    function animate() {
        requestAnimationFrame(animate);
        const time = performance.now() * 0.0005;
        
        if (particlesMesh) {
            particlesMesh.rotation.y = time * 0.25 + scrollY * 0.0004;
            particlesMesh.rotation.x = Math.sin(time * 0.2) * 0.1 + scrollY * 0.0002;
        }

        camera.position.x += (mouseX - camera.position.x) * 0.05;
        camera.position.y += (-mouseY - scrollY * 0.15 - camera.position.y) * 0.05;
        camera.lookAt(scene.position);

        renderer.render(scene, camera);
    }

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

        let frequencies = [];
        let noteSpacing = 0.08;
        let noteLength = 1.4;
        let oscType = 'sawtooth';

        if (mode === 'bass') {
            frequencies = [55, 110, 55, 82.4];
            oscType = 'sawtooth';
            noteSpacing = 0.18;
            noteLength = 1.2;
        } else if (mode === 'nightcore') {
            frequencies = [523.25, 659.25, 783.99, 1046.50, 1318.51];
            oscType = 'triangle';
            noteSpacing = 0.06;
            noteLength = 0.9;
        } else if (mode === 'muffler') {
            frequencies = [130.81, 164.81, 196.00, 246.94, 293.66];
            oscType = 'sawtooth';
            noteSpacing = 0.09;
            noteLength = 1.8;
        } else {
            frequencies = [261.63, 329.63, 392.00, 493.88, 587.33];
            oscType = 'sine';
            noteSpacing = 0.07;
            noteLength = 1.5;
        }

        frequencies.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const noteGain = ctx.createGain();

            osc.type = oscType;
            osc.frequency.setValueAtTime(freq, now + idx * noteSpacing);

            const startTime = now + idx * noteSpacing;
            noteGain.gain.setValueAtTime(0, startTime);
            noteGain.gain.linearRampToValueAtTime(0.18, startTime + 0.04);
            noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + noteLength);

            osc.connect(noteGain);
            noteGain.connect(filterNode);

            osc.start(startTime);
            osc.stop(startTime + noteLength + 0.1);
        });
    }

    document.querySelectorAll('.sound-demo-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.sound-demo-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const mode = btn.dataset.mode;
            playAuditionTone(mode);
        });
    });

    function initScrollObserver() {
        const observerOptions = {
            root: null,
            rootMargin: '0px',
            threshold: 0.12
        };

        const revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                }
            });
        }, observerOptions);

        document.querySelectorAll('.reveal, .reveal-stagger').forEach(el => {
            revealObserver.observe(el);
        });
    }

    function initCardSpotlights() {
        document.querySelectorAll('.bento-card, .engine-tile, .gh-stat-card, .contributor-card').forEach(card => {
            card.addEventListener('mousemove', e => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                card.style.background = `radial-gradient(400px circle at ${x}px ${y}px, rgba(250, 204, 21, 0.06), rgba(15, 23, 42, 0.7) 60%)`;
            });
            card.addEventListener('mouseleave', () => {
                card.style.background = '';
            });
        });
    }

    async function fetchGitHubStats() {
        try {
            const repoRes = await fetch('https://api.github.com/repos/EVINJSUBIN/Wibei');
            if (repoRes.ok) {
                const repoData = await repoRes.json();
                const starsEl = document.getElementById('gh-stars-count');
                const prsEl = document.getElementById('gh-prs-count');
                if (starsEl && repoData.stargazers_count !== undefined) {
                    starsEl.innerText = `${repoData.stargazers_count} ★`;
                }
                if (prsEl && repoData.open_issues_count !== undefined) {
                    prsEl.innerText = `${repoData.open_issues_count}+`;
                }
            }

            const contribRes = await fetch('https://api.github.com/repos/EVINJSUBIN/Wibei/contributors');
            if (contribRes.ok) {
                const contribs = await contribRes.json();
                const countEl = document.getElementById('gh-contributors-count');
                if (countEl && Array.isArray(contribs)) {
                    countEl.innerText = `${contribs.length}`;
                }
            }
        } catch (e) {
            console.log('[Wibei] Using local GitHub telemetry cache.');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initWebGL();
            initScrollObserver();
            initCardSpotlights();
            fetchGitHubStats();
        });
    } else {
        initWebGL();
        initScrollObserver();
        initCardSpotlights();
        fetchGitHubStats();
    }
})();
