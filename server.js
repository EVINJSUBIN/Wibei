const express = require('express');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const yts = require('yt-search');

const app = express();
const PORT = process.env.PORT || 3000;

function log(tag, message, ...args) {
    const timestamp = new Date().toISOString().substring(11, 19);
    console.log(`[${timestamp}] [${tag}] ${message}`, ...args);
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

function getExec() {
    const isWin = process.platform === 'win32';
    const localBin = path.join(__dirname, 'bin', isWin ? 'yt-dlp.exe' : 'yt-dlp');
    if (fs.existsSync(localBin)) {
        return { cmd: localBin, prefix: [], source: 'local-standalone-binary' };
    }

    const cmds = isWin 
        ? [['python', '-m', 'yt_dlp'], ['yt-dlp'], ['python3', '-m', 'yt_dlp']]
        : [['yt-dlp'], ['python3', '-m', 'yt_dlp'], ['python', '-m', 'yt_dlp']];
    for (const [cmd, ...prefix] of cmds) {
        try {
            const res = spawnSync(cmd, ['--version'], { stdio: 'ignore' });
            if (res.status === 0 || !res.error) {
                return { cmd, prefix, source: `system (${cmd})` };
            }
        } catch (e) {}
    }
    return { cmd: isWin ? 'python' : 'python3', prefix: ['-m', 'yt_dlp'], source: 'default-fallback' };
}

function getSpotifyMetadata(url) {
    return new Promise((resolve) => {
        https.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const titleMatch = data.match(/<title>(.*?)<\/title>/i);
                const ogTitleMatch = data.match(/<meta property="og:title" content="(.*?)"/i);
                const ogImageMatch = data.match(/<meta property="og:image" content="(.*?)"/i);
                const ogDescMatch = data.match(/<meta property="og:description" content="(.*?)"/i);

                let rawTitle = (ogTitleMatch && ogTitleMatch[1]) || (titleMatch && titleMatch[1]) || '';
                let title = rawTitle.split('|')[0].replace(/- song and lyrics by.*/i, '').trim();
                let artist = '';
                if (ogDescMatch && ogDescMatch[1]) {
                    const parts = ogDescMatch[1].split('·').map(s => s.trim());
                    if (parts.length > 1) artist = parts[1];
                }
                const thumbnail = ogImageMatch ? ogImageMatch[1] : null;
                resolve({ title: title || null, artist: artist || null, thumbnail });
            });
        }).on('error', () => resolve({ title: null, artist: null, thumbnail: null }));
    });
}

function getSpotifyTitle(url) {
    return getSpotifyMetadata(url).then(m => m.title);
}

app.get(['/app', '/visualizer', '/studio'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

app.get('/stream', async (req, res) => {
    let url = req.query.url;
    if (!url) {
        log('STREAM-ERR', 'Missing query URL parameter');
        return res.status(400).send('URL is required');
    }

    if (url.startsWith('/audio/') || url.startsWith('audio/')) {
        const localPath = path.join(__dirname, 'public', url.startsWith('/') ? url.slice(1) : url);
        if (fs.existsSync(localPath)) {
            log('STREAM', `Serving direct audio file: ${localPath}`);
            return res.sendFile(localPath);
        }
    }

    let targetUrl = url;
    if (url.includes('spotify.com/track')) {
        try {
            const title = await getSpotifyTitle(url);
            if (title) {
                log('STREAM', `Resolved Spotify link to: "${title}"`);
                targetUrl = `ytsearch1:${title} audio`;
            }
        } catch (e) {
            log('STREAM-WARN', `Failed to parse Spotify track: ${e.message}`);
        }
    } else if (!url.startsWith('http')) {
        targetUrl = `ytsearch1:${url} audio`;
    }

    const { cmd, prefix, source } = getExec();
    const args = [
        ...prefix,
        '-f', 'bestaudio[ext=m4a]/bestaudio/best',
        '--extractor-args', 'youtube:player_client=android,ios,mweb',
        '--no-check-certificates',
        '--no-warnings',
        '-o', '-',
        '-q',
        targetUrl
    ];

    log('STREAM', `Starting stream using [${source}] for query: "${url}"`);

    const ytdlp = spawn(cmd, args);
    let bytesSent = 0;
    let firstChunk = true;

    res.setHeader('Content-Type', 'audio/mp4');
    res.setHeader('Transfer-Encoding', 'chunked');

    ytdlp.stdout.on('data', (chunk) => {
        if (firstChunk) {
            log('STREAM', `First audio chunk received (${chunk.length} bytes), piping to client`);
            firstChunk = false;
        }
        bytesSent += chunk.length;
    });

    ytdlp.stdout.pipe(res);

    ytdlp.stderr.on('data', (d) => {
        log('STREAM-WARN', d.toString().trim());
    });

    ytdlp.on('error', (err) => {
        log('STREAM-ERR', `yt-dlp process spawn error: ${err.message}`);
        if (!res.headersSent) res.status(500).send('Stream error');
    });

    ytdlp.on('close', (code) => {
        log('STREAM', `Stream finished (code: ${code}, total bytes: ${(bytesSent / 1024 / 1024).toFixed(2)} MB)`);
    });

    req.on('close', () => {
        log('STREAM', `Client disconnected. Terminating yt-dlp PID ${ytdlp.pid}`);
        try {
            ytdlp.kill();
        } catch (e) {}
    });
});

app.get('/api/search', async (req, res) => {
    const q = req.query.q;
    if (!q) return res.json([]);
    log('SEARCH', `Query: "${q}"`);
    try {
        const searchResults = await yts(q);
        const videos = (searchResults.videos || []).slice(0, 6);
        const items = videos.map(v => ({
            title: v.title,
            uploader: v.author?.name || 'Unknown Artist',
            url: v.url,
            thumbnail: v.thumbnail || null,
            duration: v.seconds || 0
        }));
        log('SEARCH', `Found ${items.length} results for: "${q}"`);
        res.json(items);
    } catch (e) {
        log('SEARCH-ERR', `Search failed for "${q}": ${e.message}`);
        res.json([]);
    }
});

app.get('/api/suggest', (req, res) => {
    const q = req.query.q;
    if (!q) return res.json([]);
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(q)}`;
    https.get(url, (r) => {
        let d = '';
        r.on('data', chunk => d += chunk);
        r.on('end', () => {
            try {
                const json = JSON.parse(d);
                res.json(json[1] || []);
            } catch (e) { 
                res.json([]); 
            }
        });
    }).on('error', (err) => {
        log('SUGGEST-ERR', err.message);
        res.json([]);
    });
});

function getSpotifyPlaylistTracks(url) {
    return new Promise((resolve) => {
        let embedUrl = url;
        if (!embedUrl.includes('/embed/')) {
            embedUrl = embedUrl.replace('spotify.com/playlist/', 'spotify.com/embed/playlist/')
                               .replace('spotify.com/album/', 'spotify.com/embed/album/');
        }
        https.get(embedUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    const scriptMatch = data.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
                    if (scriptMatch) {
                        const json = JSON.parse(scriptMatch[1]);
                        const entity = json.props?.pageProps?.state?.data?.entity;
                        if (entity?.trackList) {
                            const tracks = entity.trackList.map(t => ({
                                title: t.title,
                                artist: t.subtitle || entity.name || 'Spotify Track',
                                url: `ytsearch1:${t.title} ${t.subtitle || ''} audio`,
                                duration: Math.round((t.duration || 0) / 1000),
                                thumbnail: entity.coverArt?.sources?.[0]?.url || null,
                                type: 'stream'
                            }));
                            return resolve({
                                title: entity.name || entity.title || 'Spotify Playlist',
                                count: tracks.length,
                                thumbnail: entity.coverArt?.sources?.[0]?.url || null,
                                tracks
                            });
                        }
                    }
                    resolve({ title: 'Spotify Playlist', count: 0, tracks: [] });
                } catch (e) {
                    resolve({ title: 'Spotify Playlist', count: 0, tracks: [] });
                }
            });
        }).on('error', () => resolve({ title: 'Spotify Playlist', count: 0, tracks: [] }));
    });
}

function getYouTubePlaylistTracks(url) {
    return new Promise((resolve) => {
        const { cmd, prefix, source } = getExec();
        const args = [
            ...prefix,
            '--flat-playlist',
            '-J',
            '--playlist-items', '1:40',
            '--no-check-certificates',
            '--no-warnings',
            url
        ];

        log('PLAYLIST', `Resolving playlist via [${source}] for: "${url}"`);
        const ytdlp = spawn(cmd, args);
        let out = '';
        ytdlp.stdout.on('data', d => out += d);
        ytdlp.on('error', (err) => {
            log('PLAYLIST-ERR', `yt-dlp error: ${err.message}`);
            resolve({ title: 'YouTube Playlist', count: 0, tracks: [] });
        });
        ytdlp.on('close', () => {
            try {
                const data = JSON.parse(out);
                const entries = data.entries || [];
                const tracks = entries.filter(e => e && e.title).map(e => ({
                    title: e.title,
                    artist: e.uploader || e.artist || data.title || 'YouTube Artist',
                    url: e.url || (e.id ? `https://www.youtube.com/watch?v=${e.id}` : `ytsearch1:${e.title} audio`),
                    duration: e.duration || 0,
                    thumbnail: e.thumbnails?.[0]?.url || e.thumbnail || null,
                    type: 'stream'
                }));
                log('PLAYLIST', `Resolved "${data.title || 'Playlist'}" with ${tracks.length} tracks`);
                resolve({
                    title: data.title || 'YouTube Playlist',
                    count: tracks.length,
                    thumbnail: data.thumbnails?.[0]?.url || null,
                    tracks
                });
            } catch (e) {
                log('PLAYLIST-ERR', `Parse error: ${e.message}`);
                resolve({ title: 'YouTube Playlist', count: 0, tracks: [] });
            }
        });
    });
}

app.get('/api/playlist', async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'URL required', tracks: [] });

    log('PLAYLIST-REQ', `Resolving playlist URL: "${url}"`);
    try {
        if (url.includes('spotify.com/playlist') || url.includes('spotify.com/album')) {
            const data = await getSpotifyPlaylistTracks(url);
            return res.json(data);
        }

        const data = await getYouTubePlaylistTracks(url);
        return res.json(data);
    } catch (err) {
        log('PLAYLIST-ERR', `Failed to parse playlist: ${err.message}`);
        res.status(500).json({ error: 'Failed to parse playlist', tracks: [] });
    }
});

function cleanVideoNoise(str) {
    if (!str) return '';
    return str
        .replace(/\((?:official\s*)?(?:music\s*)?(?:video|audio|visualizer|lyric\s*video|hd|4k|clip|mv|remastered|performance|live)\)/gi, '')
        .replace(/\[(?:official\s*)?(?:music\s*)?(?:video|audio|visualizer|lyric\s*video|hd|4k|clip|mv|remastered|performance|live)\]/gi, '')
        .replace(/\((?:lyrics?|audio|visualizer|hq|official)\)/gi, '')
        .replace(/\[(?:lyrics?|audio|visualizer|hq|official)\]/gi, '')
        .replace(/\b(ft\.?|feat\.?|featuring)\s+[^\(\)\[\]]+/gi, '')
        .replace(/\(prod\.?\s*(?:by)?\s+[^\)]+\)/gi, '')
        .replace(/\[prod\.?\s*(?:by)?\s+[^\]]+\]/gi, '')
        .replace(/\s*\|\s*.*$/g, '')
        .replace(/\s*-\s*Topic$/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function parseTrackAndArtist(rawTitle = '', rawArtist = '') {
    let title = cleanVideoNoise(rawTitle);
    let artist = cleanVideoNoise(rawArtist);

    const separators = [' - ', ' – ', ' — ', ' // '];
    for (const sep of separators) {
        if (title.includes(sep)) {
            const parts = title.split(sep);
            if (parts.length >= 2) {
                const candidateArtist = parts[0].trim();
                const candidateTrack = parts.slice(1).join(' ').trim();
                if (candidateArtist && candidateTrack) {
                    return {
                        track: cleanVideoNoise(candidateTrack),
                        artist: cleanVideoNoise(candidateArtist)
                    };
                }
            }
        }
    }

    return {
        track: title,
        artist: artist
    };
}

const GENRE_RULES = [
    {
        genre: 'phonk',
        label: 'PHONK // DRIFT',
        mood: 'High-Voltage / Aggressive',
        theme: 'phonk',
        color: '#ef4444',
        accentHex: 0xef4444,
        regex: /\b(phonk|drift|cowbell|memphis|kordhell|playaphonk|dxrk|lxst cxntury|interworld|shadowraze|mishashi|montagem|automotivo|brazilian funk|funk rj|funk mandelao|sp funk|funk brasileiro|wave phonk|drift phonk|aggregressive phonk|speed up phonk|prod\.?\s*by\s*lxst)\b/i,
        weight: 2.6
    },
    {
        genre: 'cyber',
        label: 'CYBER // SYNTHWAVE',
        mood: 'Futuristic / Electronic',
        theme: 'cyber',
        color: '#10b981',
        accentHex: 0x10b981,
        regex: /\b(synthwave|retrowave|cyberpunk|cyber|darksynth|electronic|edm|techno|trance|dubstep|dnb|drum and bass|drum & bass|future bass|house music|electro|industrial|glitch|chiptune|eurobeat|hardstyle|carpenter brut|perturbator|kavinsky|daft punk|skrillex|deadmau5|avicii|nightcall)\b/i,
        weight: 2.3
    },
    {
        genre: 'lofi',
        label: 'LOFI // CHILL',
        mood: 'Cozy / Nostalgic',
        theme: 'lofi',
        color: '#fb923c',
        accentHex: 0xfb923c,
        regex: /\b(lofi|lo-fi|chillhop|chill hop|study beats|chill beats|relaxing beats|sleep beats|coffee shop|cozy|rainy day|jazz hop|mellow|nostalgic|bedroom pop|downtempo|ambient chill|lofi girl|chilledcow|sleepy beats|quiet night|peaceful)\b/i,
        weight: 2.3
    },
    {
        genre: 'comic',
        label: 'POP // ENERGETIC',
        mood: 'Vibrant / Dance',
        theme: 'comic',
        color: '#facc15',
        accentHex: 0xfacc15,
        regex: /\b(pop|dance pop|hyperpop|k-pop|kpop|j-pop|jpop|anime|kawaii|vocaloid|hatsune miku|funk|disco|groove|upbeat|cheerful|party|happy|blackpink|bts|twice|newjeans|aespa|taylor swift|dua lipa|ariana grande|charli xcx|billie eilish|the weeknd|bruno mars)\b/i,
        weight: 2.1
    },
    {
        genre: 'serious',
        label: 'SERIOUS // ACOUSTIC',
        mood: 'Deep / Cinematic',
        theme: 'serious',
        color: '#f8fafc',
        accentHex: 0xf8fafc,
        regex: /\b(classical|piano solo|piano|acoustic|orchestra|symphony|cinematic|film score|soundtrack|hans zimmer|chopin|beethoven|mozart|bach|debussy|ludovico einaudi|max richter|philip glass|violin|cello|meditation|dark ambient|drone|minimalist|neoclassical|instrumental acoustic)\b/i,
        weight: 2.2
    },
    {
        genre: 'hiphop',
        label: 'TRAP // HIP-HOP',
        mood: 'Heavy 808 / Rhythm',
        theme: 'phonk',
        color: '#a855f7',
        accentHex: 0xa855f7,
        regex: /\b(hip hop|hip-hop|rap|trap|drill|boombap|boom bap|freestyle|bars|808 mafia|metro boomin|travis scott|drake|kendrick|kanye|eminem|future|21 savage|playboi carti|lil uzi|gunna|lil baby|central cee)\b/i,
        weight: 2.2
    }
];

function classifyMusic({ title = '', artist = '', album = '', tags = [], categories = [], channel = '', uploader = '', description = '' }) {
    const primaryText = `${title} ${artist} ${album}`;
    const secondaryText = `${uploader} ${channel} ${(categories || []).join(' ')} ${(tags || []).slice(0, 15).join(' ')} ${(description || '').slice(0, 300)}`;
    
    let best = null;
    let maxScore = 0;

    for (const rule of GENRE_RULES) {
        const primaryMatches = (primaryText.match(new RegExp(rule.regex, 'gi')) || []).length;
        const secondaryMatches = (secondaryText.match(new RegExp(rule.regex, 'gi')) || []).length;
        const score = (primaryMatches * rule.weight * 2.0) + (secondaryMatches * rule.weight * 0.8);

        if (score > maxScore) {
            maxScore = score;
            best = rule;
        }
    }

    if (best && maxScore >= 1.5) {
        return {
            genre: best.genre,
            label: best.label,
            mood: best.mood,
            theme: best.theme,
            color: best.color,
            accentHex: best.accentHex,
            confidence: Math.min(1.0, +(maxScore / 5.0).toFixed(2))
        };
    }

    return {
        genre: 'cyber',
        label: 'NEO // ELECTRONIC',
        mood: 'Dynamic Spectrum',
        theme: 'cyber',
        color: '#10b981',
        accentHex: 0x10b981,
        confidence: 0.5
    };
}

function fetchLyrics(title, artist) {
    return new Promise((resolve) => {
        const parsed = parseTrackAndArtist(title, artist);
        const cleanTrack = parsed.track;
        const cleanArtist = parsed.artist;

        const requestJson = (url) => {
            return new Promise((res) => {
                https.get(url, {
                    headers: { 'User-Agent': 'WibeiVisualizer/2.0 (https://github.com/evinjsubin/wibei)' }
                }, (r) => {
                    let d = '';
                    r.on('data', c => d += c);
                    r.on('end', () => {
                        try {
                            const j = JSON.parse(d);
                            res(j);
                        } catch (_) { res(null); }
                    });
                }).on('error', () => res(null));
            });
        };

        const tryLrclibExact = async (t, a) => {
            if (!t) return null;
            const targetUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(t)}${a ? `&artist_name=${encodeURIComponent(a)}` : ''}`;
            const j = await requestJson(targetUrl);
            if (j && (j.syncedLyrics || j.plainLyrics)) return j;
            return null;
        };

        const tryLrclibSearch = async (q) => {
            if (!q) return null;
            const targetUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(q)}`;
            const list = await requestJson(targetUrl);
            if (Array.isArray(list) && list.length > 0) {
                return list.find(item => item.syncedLyrics) || list.find(item => item.plainLyrics) || list[0];
            }
            return null;
        };

        const tryLyricsOvh = async (t, a) => {
            if (!t || !a) return null;
            const targetUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(a)}/${encodeURIComponent(t)}`;
            const j = await requestJson(targetUrl);
            if (j && j.lyrics) {
                return {
                    trackName: t,
                    artistName: a,
                    syncedLyrics: null,
                    plainLyrics: j.lyrics,
                    source: 'lyrics.ovh'
                };
            }
            return null;
        };

        (async () => {
            // 1. Direct LRCLIB exact match
            let res = await tryLrclibExact(cleanTrack, cleanArtist);
            if (res) return resolve(res);

            // 2. Try reversed if both present
            if (cleanTrack && cleanArtist) {
                res = await tryLrclibExact(cleanArtist, cleanTrack);
                if (res) return resolve(res);
            }

            // 3. LRCLIB general search query
            if (cleanTrack && cleanArtist) {
                res = await tryLrclibSearch(`${cleanTrack} ${cleanArtist}`);
                if (res) return resolve(res);
            }

            // 4. LRCLIB track-only search
            if (cleanTrack) {
                res = await tryLrclibSearch(cleanTrack);
                if (res) return resolve(res);
            }

            // 5. Secondary fallback: lyrics.ovh
            if (cleanTrack && cleanArtist) {
                res = await tryLyricsOvh(cleanTrack, cleanArtist);
                if (res) return resolve(res);
            }

            resolve(null);
        })();
    });
}

app.get('/api/lyrics', async (req, res) => {
    const { title, artist } = req.query;
    if (!title) return res.status(400).json({ found: false, error: 'Title required' });

    log('LYRICS', `Searching lyrics for: "${title}" by "${artist || 'Unknown'}"`);
    try {
        const lyricsData = await fetchLyrics(title, artist);
        if (lyricsData && (lyricsData.syncedLyrics || lyricsData.plainLyrics)) {
            log('LYRICS', `Found lyrics for "${lyricsData.trackName || title}" (${lyricsData.syncedLyrics ? 'Synced' : 'Plain'})`);
            res.json({
                found: true,
                trackName: lyricsData.trackName || title,
                artistName: lyricsData.artistName || artist,
                syncedLyrics: lyricsData.syncedLyrics || null,
                plainLyrics: lyricsData.plainLyrics || null,
                isSynced: !!lyricsData.syncedLyrics,
                source: lyricsData.source || 'lrclib'
            });
        } else {
            log('LYRICS', `No lyrics found for: "${title}"`);
            res.json({ found: false });
        }
    } catch (e) {
        log('LYRICS-ERR', `Failed to fetch lyrics: ${e.message}`);
        res.json({ found: false, error: e.message });
    }
});

app.get('/api/classify', (req, res) => {
    const { title, artist, album, tags } = req.query;
    const tagArray = tags ? tags.split(',') : [];
    const classification = classifyMusic({
        title: title || '',
        artist: artist || '',
        album: album || '',
        tags: tagArray
    });
    res.json(classification);
});

app.get('/metadata', async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).send('URL required');

    if (url.includes('spotify.com/track/')) {
        try {
            const spMeta = await getSpotifyMetadata(url);
            if (spMeta && spMeta.title) {
                const classification = classifyMusic({
                    title: spMeta.title,
                    artist: spMeta.artist
                });
                return res.json({
                    title: spMeta.title,
                    rawTitle: spMeta.title,
                    artist: spMeta.artist || 'Spotify Artist',
                    uploader: spMeta.artist || 'Spotify Artist',
                    thumbnail: spMeta.thumbnail,
                    duration: 0,
                    classification
                });
            }
        } catch (e) {
            log('METADATA-WARN', `Spotify metadata fallback: ${e.message}`);
        }
    }

    let targetUrl = url;
    if (!url.startsWith('http')) targetUrl = `ytsearch1:${url} audio`;

    const { cmd, prefix, source } = getExec();
    const args = [
        ...prefix,
        '--extractor-args', 'youtube:player_client=android,ios,mweb',
        '--no-check-certificates',
        '--no-warnings',
        '-j',
        targetUrl
    ];

    log('METADATA', `Fetching track metadata via [${source}] for: "${url}"`);
    const ytdlp = spawn(cmd, args);

    let out = '';
    ytdlp.stdout.on('data', d => out += d);

    ytdlp.on('error', (err) => {
        log('METADATA-ERR', `Failed to fetch metadata: ${err.message}`);
        if (!res.headersSent) res.json({ title: 'Unknown Track', artist: 'Unknown Artist', uploader: 'Unknown', thumbnail: null, classification: classifyMusic({}) });
    });

    ytdlp.on('close', () => {
        try {
            const data = JSON.parse(out);
            const parsed = parseTrackAndArtist(data.title, data.uploader);
            const cleanTrackTitle = data.track || parsed.track;
            const cleanArtistName = data.artist || (data.creator || (data.uploader ? data.uploader.replace(/ - Topic$/i, '') : parsed.artist));

            let bestThumbnail = data.thumbnail;
            if (Array.isArray(data.thumbnails) && data.thumbnails.length > 0) {
                const sorted = [...data.thumbnails].sort((a, b) => (b.width || 0) - (a.width || 0));
                if (sorted[0] && sorted[0].url) {
                    bestThumbnail = sorted[0].url;
                }
            }

            const classification = classifyMusic({
                title: cleanTrackTitle,
                artist: cleanArtistName,
                album: data.album,
                tags: data.tags,
                categories: data.categories,
                channel: data.channel,
                uploader: data.uploader,
                description: data.description
            });

            log('METADATA', `Resolved: "${cleanTrackTitle}" by ${cleanArtistName} [${classification.label}]`);
            res.json({
                title: cleanTrackTitle,
                rawTitle: data.title,
                artist: cleanArtistName,
                uploader: data.uploader,
                album: data.album || null,
                releaseYear: data.release_year || (data.upload_date ? data.upload_date.slice(0, 4) : null),
                thumbnail: bestThumbnail,
                duration: data.duration || 0,
                genre: data.genre || (data.categories ? data.categories[0] : null),
                tags: (data.tags || []).slice(0, 10),
                classification: classification
            });
        } catch (e) {
            res.json({ title: 'Unknown', artist: 'Unknown Artist', uploader: 'Unknown', thumbnail: null, classification: classifyMusic({}) });
        }
    });
});

app.get('/health', (req, res) => {
    const execInfo = getExec();
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        platform: process.platform,
        node: process.version,
        ytdlpSource: execInfo.source,
        timestamp: new Date().toISOString()
    });
});

const execInfo = getExec();
const server = app.listen(PORT, () => {
    console.log('====================================================');
    log('SERVER', `Wibei Visualizer online at http://localhost:${PORT}`);
    log('SERVER', `Environment: Node ${process.version} on ${process.platform}`);
    log('SERVER', `yt-dlp Engine: [${execInfo.source}] -> ${execInfo.cmd}`);
    console.log('====================================================');
});

process.on('SIGTERM', () => {
    log('SERVER', 'SIGTERM signal received. Gracefully closing HTTP server...');
    server.close(() => {
        log('SERVER', 'HTTP server closed cleanly');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    log('SERVER', 'SIGINT signal received. Gracefully closing HTTP server...');
    server.close(() => {
        log('SERVER', 'HTTP server closed cleanly');
        process.exit(0);
    });
});
