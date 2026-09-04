let playlist = [
    { id: 'demo-1', title: 'Synthwave Pulse', artist: 'RetroWave Studio', album: 'Neon Horizon', genre: 'Synthwave', bpm: 128, src: '/audio/synthwave.mp3', thumb: '/images/demo-synthwave.svg', type: 'demo' },
    { id: 'demo-2', title: 'Lofi Chill Beats', artist: 'Lofi Studio', album: 'Midnight Coffee', genre: 'Lofi', bpm: 85, src: '/audio/lofi.mp3', thumb: '/images/demo-lofi.svg', type: 'demo' },
    { id: 'demo-3', title: 'Acoustic Harmony', artist: 'Ambient Vibes', album: 'Celestial Waves', genre: 'Ambient', bpm: 100, src: '/audio/chill.mp3', thumb: '/images/demo-chill.svg', type: 'demo' }
];
let currentTrackIdx = -1;
let currentAudioSessionId = 0;

const trackTitle = document.getElementById('track-title');
const trackArtist = document.getElementById('track-artist');
const albumArt = document.getElementById('album-art');
const playBtn = document.getElementById('play-btn');
const iconPlay = document.querySelector('.icon-play');
const iconPause = document.querySelector('.icon-pause');
const seekSlider = document.getElementById('seek-slider');
const progressFill = document.querySelector('.progress-fill');
const timeCurrent = document.getElementById('time-current');
const timeTotal = document.getElementById('time-total');
const searchInp = document.getElementById('search-inp');
const searchBtn = document.getElementById('search-btn');
const suggBox = document.getElementById('suggestions-box');
const telemetryMode = document.getElementById('telemetry-mode');
const telemetryFps = document.getElementById('telemetry-fps');

function updatePlayIcons(playing) {
    isPlaying = playing;
    if (iconPlay)  iconPlay.style.display  = playing ? 'none'  : 'block';
    if (iconPause) iconPause.style.display = playing ? 'block' : 'none';
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
        if (thumb && (thumb.startsWith('http') || thumb.startsWith('/') || thumb.startsWith('blob:') || thumb.startsWith('data:'))) {
            albumArt.src = thumb;
        } else {
            albumArt.src = 'favicon.svg';
        }
    }
    
    if (typeof setPulseCenterArt === 'function') {
        setPulseCenterArt(thumb);
    }

    if (title && !title.includes('Connecting') && !title.includes('Loading') && !title.includes('Error')) {
        loadLyricsForTrack(title, artist);
    }
}

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
            <img class="queue-thumb" src="${track.thumb || 'favicon.svg'}" alt="" onerror="this.src='favicon.svg'">
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

        playDirectAudio(track.src, track.title, track.artist, track.thumb);
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

function attachTimeEvents(el) {
    el.ontimeupdate = () => {
        if (!el.duration) return;
        const pct = (el.currentTime / el.duration) * 100;
        if (seekSlider) seekSlider.value = pct;
        if (progressFill) progressFill.style.width = pct + '%';
        if (timeCurrent) timeCurrent.innerText = formatTime(el.currentTime);
        if (timeTotal) timeTotal.innerText = formatTime(el.duration);
        updateLyricsProgress(el.currentTime);
    };
    el.onended = () => {
        playNextTrack(true);
    };
}

function playDirectAudio(src, title, artist, thumb = null) {
    stopMic();
    const thisSession = ++currentAudioSessionId;
    updateTrackInfo(title, artist, thumb);
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
    
    const initTitle = presetMeta?.title || query;
    const initArtist = presetMeta?.artist || presetMeta?.uploader || 'Streaming audio';
    const initThumb = presetMeta?.thumbnail || presetMeta?.thumb;
    updateTrackInfo(initTitle, initArtist, initThumb);

    try {
        let meta = presetMeta;
        if (!meta || !meta.artist || meta.artist === 'YouTube Stream' || meta.artist === 'YouTube Artist') {
            const r = await fetch(`/metadata?url=${encodeURIComponent(query)}`);
            meta = await r.json();
        }
        if (currentAudioSessionId !== thisSession) return;
        updateTrackInfo(meta.title || query, meta.artist || meta.uploader || 'Unknown Artist', meta.thumbnail || initThumb);

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
            playDirectAudio('/audio/synthwave.mp3', 'Synthwave Pulse', 'RetroWave Studio', '/images/demo-synthwave.svg');
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

const doSearch = async () => {
    if (!searchInp) return;
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

async function loadLocalFiles(filesList) {
    if (!filesList || filesList.length === 0) return;
    stopMic();
    const files = Array.from(filesList).filter(f => f.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac)$/i.test(f.name));
    if (files.length === 0) return;

    for (let idx = 0; idx < files.length; idx++) {
        const file = files[idx];
        const rawName = file.name.replace(/\.[^/.]+$/, '');
        let title = rawName;
        let artist = 'Local Audio';
        const split = rawName.split(/\s*[-–—]\s*/);
        if (split.length >= 2) {
            artist = split[0].trim();
            title = split.slice(1).join(' - ').trim();
        }

        let thumb = 'favicon.svg';
        if (window.readAudioMetadata) {
            try {
                const meta = await window.readAudioMetadata(file);
                if (meta) {
                    if (meta.title && meta.title.trim()) title = meta.title.trim();
                    if (meta.artist && meta.artist.trim()) artist = meta.artist.trim();
                    if (meta.pictureUrl) thumb = meta.pictureUrl;
                }
            } catch (_) {}
        }

        const trackObj = {
            id: Date.now() + Math.random(),
            title: title,
            artist: artist,
            src: URL.createObjectURL(file),
            thumb: thumb,
            type: 'local'
        };
        addToPlaylist(trackObj, idx === 0 && (!curAudioEl || curAudioEl.paused));
    }

    if (sourceBadge) sourceBadge.innerText = 'LOCAL';
    showToast(`Added ${files.length} track(s) to playlist`);
}
