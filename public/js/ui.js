const fxMufflerBtn = document.getElementById('fx-muffler-btn');
const fxBassBtn = document.getElementById('fx-bass-btn');
const fxSpeedBtn = document.getElementById('fx-speed-btn');
const fxSpeedStatus = document.getElementById('fx-speed-status');
const autoCamBtn = document.getElementById('autocam-btn');
const volSlider = document.getElementById('vol-slider');
const muteBtn = document.getElementById('mute-btn');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const themeSunIcon = document.querySelector('.theme-sun-icon');
const themeMoonIcon = document.querySelector('.theme-moon-icon');
const guideModal = document.getElementById('guide-modal');
const lyricsHud = document.getElementById('lyrics-hud');
const lyricsBtn = document.getElementById('lyrics-btn');

function initUIEvents() {
    playBtn?.addEventListener('click', togglePlay);

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
            { title: 'Synthwave Pulse', artist: 'RetroWave Studio', album: 'Neon Horizon', genre: 'Synthwave', bpm: 128, src: '/audio/synthwave.mp3', thumb: '/images/demo-synthwave.svg', type: 'demo' },
            { title: 'Lofi Chill Beats', artist: 'Lofi Studio', album: 'Midnight Coffee', genre: 'Lofi', bpm: 85, src: '/audio/lofi.mp3', thumb: '/images/demo-lofi.svg', type: 'demo' },
            { title: 'Acoustic Harmony', artist: 'Ambient Vibes', album: 'Celestial Waves', genre: 'Ambient', bpm: 100, src: '/audio/chill.mp3', thumb: '/images/demo-chill.svg', type: 'demo' }
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
                album: row.dataset.album || 'Demo Album',
                genre: row.dataset.genre || 'Electronic',
                bpm: row.dataset.bpm || '120',
                src: row.dataset.src,
                thumb: row.dataset.thumb || '/images/demo-synthwave.svg',
                type: 'demo'
            };
            addToPlaylist(trackObj, true);
        });
    });

    searchBtn?.addEventListener('click', doSearch);
    searchInp?.addEventListener('keypress', e => { if (e.key === 'Enter') doSearch(); });

    searchInp?.addEventListener('input', () => {
        clearTimeout(suggTimer);
        const q = searchInp.value.trim();
        if (!q || q.length < 2) { if (suggBox) suggBox.style.display = 'none'; return; }
        suggTimer = setTimeout(async () => {
            try {
                const res = await fetch('/api/search?q=' + encodeURIComponent(q));
                const data = await res.json();
                if (!suggBox) return;
                suggBox.innerHTML = '';
                if (!data?.length) { suggBox.style.display = 'none'; return; }
                data.forEach(item => {
                    const card = document.createElement('div');
                    card.className = 'suggestion-card';
                    const displayArtist = item.artist || item.uploader || 'YouTube Stream';
                    card.innerHTML = `
                        ${item.thumbnail ? `<img class="suggestion-thumb" src="${item.thumbnail}" alt="" onerror="this.style.display='none'">` : `<div class="suggestion-thumb" style="display:flex;align-items:center;justify-content:center;color:var(--accent);font-size:12px;">♪</div>`}
                        <div class="suggestion-info">
                            <div class="suggestion-title">${item.title}</div>
                            <div class="suggestion-channel">${displayArtist}</div>
                        </div>
                    `;
                    card.onclick = () => {
                        suggBox.style.display = 'none';
                        searchInp.value = '';
                        const trackObj = {
                            title: item.title,
                            artist: displayArtist,
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
            const geometryBadge = document.getElementById('geometry-badge');
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

    document.getElementById('guide-btn')?.addEventListener('click',        () => { if (guideModal) guideModal.style.display = 'flex'; });
    document.getElementById('close-guide-btn')?.addEventListener('click',  () => { if (guideModal) guideModal.style.display = 'none'; });
    document.getElementById('dismiss-guide-btn')?.addEventListener('click',() => { if (guideModal) guideModal.style.display = 'none'; });
    guideModal?.addEventListener('click', e => { if (e.target === guideModal) guideModal.style.display = 'none'; });

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

    themeToggleBtn?.addEventListener('click', () => {
        applyThemeMode(!isLightMode);
    });
}
