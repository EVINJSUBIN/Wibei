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

function getSpotifyTitle(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const match = data.match(/<title>(.*?)<\/title>/);
                if (match && match[1]) {
                    let title = match[1].split('|')[0].replace('- song and lyrics by', '').trim();
                    resolve(title);
                } else {
                    resolve(null);
                }
            });
        }).on('error', err => reject(err));
    });
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

function parseArtistAndTitle(rawTitle = '', rawArtist = '') {
    let clean = (str = '') => {
        return str
            .replace(/\(official\s*(music\s*)?(video|audio|visualizer|lyric\s*video|hd|4k|clip)\)/gi, '')
            .replace(/\[official\s*(music\s*)?(video|audio|visualizer|lyric\s*video|hd|4k|clip)\]/gi, '')
            .replace(/\((visualizer|lyrics?|audio|video|official|hd|4k|remastered|extended)\)/gi, '')
            .replace(/\[(visualizer|lyrics?|audio|video|official|hd|4k|remastered|extended)\]/gi, '')
            .replace(/\(feat\.?[^)]*\)/gi, '')
            .replace(/\[feat\.?[^\]]*\]/gi, '')
            .replace(/ft\.?\s+[a-zA-Z0-9_\s]+/gi, '')
            .replace(/\(prod\.?[^)]*\)/gi, '')
            .replace(/\[prod\.?[^\]]*\]/gi, '')
            .replace(/\(slowed(\s*\+\s*reverb)?\)/gi, '')
            .replace(/\[slowed(\s*\+\s*reverb)?\]/gi, '')
            .replace(/\(bass\s*boosted\)/gi, '')
            .replace(/\[bass\s*boosted\]/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
    };

    let title = clean(rawTitle);
    let artist = clean(rawArtist);

    // If title has "Artist - Track" or "Artist : Track"
    const separators = [' - ', ' – ', ' — ', ' : '];
    for (const sep of separators) {
        if (title.includes(sep)) {
            const parts = title.split(sep);
            if (parts.length >= 2) {
                const possibleArtist = parts[0].trim();
                const possibleTitle = parts.slice(1).join(sep).trim();
                if (possibleArtist.length > 0 && possibleTitle.length > 0) {
                    artist = clean(possibleArtist);
                    title = clean(possibleTitle);
                    break;
                }
            }
        }
    }

    // Clean up VEVO or Topic suffixes in artist names
    artist = artist.replace(/vevo$/i, '').replace(/\s*-\s*topic$/i, '').trim();

    return { title, artist, rawTitle, rawArtist };
}

function fetchLyrics(rawTitle, rawArtist) {
    return new Promise((resolve) => {
        const { title, artist } = parseArtistAndTitle(rawTitle, rawArtist);

        const tryDirect = (t, a) => {
            return new Promise((res) => {
                if (!t) return res(null);
                const targetUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(t)}${a ? `&artist_name=${encodeURIComponent(a)}` : ''}`;
                https.get(targetUrl, {
                    headers: { 'User-Agent': 'WibeiVisualizer/2.0 (https://github.com/evinjsubin/wibei)' }
                }, (r) => {
                    let d = '';
                    r.on('data', c => d += c);
                    r.on('end', () => {
                        try {
                            const j = JSON.parse(d);
                            if (j && (j.syncedLyrics || j.plainLyrics)) {
                                res(j);
                            } else {
                                res(null);
                            }
                        } catch (_) { res(null); }
                    });
                }).on('error', () => res(null));
            });
        };

        const trySearch = (q) => {
            return new Promise((res) => {
                if (!q || !q.trim()) return res(null);
                const targetUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(q.trim())}`;
                https.get(targetUrl, {
                    headers: { 'User-Agent': 'WibeiVisualizer/2.0 (https://github.com/evinjsubin/wibei)' }
                }, (r) => {
                    let d = '';
                    r.on('data', c => d += c);
                    r.on('end', () => {
                        try {
                            const list = JSON.parse(d);
                            if (Array.isArray(list) && list.length > 0) {
                                // Prefer synced lyrics
                                const match = list.find(item => item.syncedLyrics) || list.find(item => item.plainLyrics) || list[0];
                                res(match);
                            } else {
                                res(null);
                            }
                        } catch (_) { res(null); }
                    });
                }).on('error', () => res(null));
            });
        };

        // Multi-stage cascading query strategy
        (async () => {
            // Stage 1: Exact track + artist
            let result = await tryDirect(title, artist);
            if (result && (result.syncedLyrics || result.plainLyrics)) return resolve(result);

            // Stage 2: Combined search string
            if (artist && title) {
                result = await trySearch(`${artist} ${title}`);
                if (result && (result.syncedLyrics || result.plainLyrics)) return resolve(result);
            }

            // Stage 3: Title-only search
            result = await trySearch(title);
            if (result && (result.syncedLyrics || result.plainLyrics)) return resolve(result);

            // Stage 4: Direct track-only without artist
            result = await tryDirect(title, '');
            if (result && (result.syncedLyrics || result.plainLyrics)) return resolve(result);

            // Stage 5: Fallback on raw original title
            if (rawTitle && rawTitle !== title) {
                result = await trySearch(rawTitle);
                if (result && (result.syncedLyrics || result.plainLyrics)) return resolve(result);
            }

            resolve(null);
        })();
    });
}

function enrichMetadataWithITunes(title, artist) {
    return new Promise((resolve) => {
        const { title: cleanT, artist: cleanA } = parseArtistAndTitle(title, artist);
        const query = cleanA && cleanT ? `${cleanA} ${cleanT}` : (cleanT || title || '');
        if (!query.trim()) return resolve(null);

        const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=1`;
        https.get(itunesUrl, { headers: { 'User-Agent': 'WibeiVisualizer/2.0' } }, (r) => {
            let d = '';
            r.on('data', c => d += c);
            r.on('end', () => {
                try {
                    const json = JSON.parse(d);
                    const item = json.results?.[0];
                    if (item) {
                        let highResArt = item.artworkUrl100 || null;
                        if (highResArt) {
                            highResArt = highResArt.replace('100x100bb', '600x600bb');
                        }
                        const year = item.releaseDate ? item.releaseDate.slice(0, 4) : null;
                        return resolve({
                            title: item.trackName || cleanT,
                            artist: item.artistName || cleanA,
                            album: item.collectionName || null,
                            genre: item.primaryGenreName || null,
                            year: year,
                            thumbnail: highResArt,
                            duration: Math.round((item.trackTimeMillis || 0) / 1000)
                        });
                    }
                    resolve(null);
                } catch (_) { resolve(null); }
            });
        }).on('error', () => resolve(null));
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
                plainLyrics: lyricsData.plainLyrics || null
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

app.get('/api/meta-enrich', async (req, res) => {
    const { title, artist } = req.query;
    if (!title && !artist) return res.json({ enriched: false });

    try {
        const data = await enrichMetadataWithITunes(title, artist);
        if (data) {
            return res.json({ enriched: true, ...data });
        }
        res.json({ enriched: false });
    } catch (e) {
        res.json({ enriched: false, error: e.message });
    }
});

app.get('/metadata', async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).send('URL required');
  
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

    ytdlp.on('error', async (err) => {
        log('METADATA-ERR', `Failed to fetch metadata: ${err.message}`);
        // Attempt fast iTunes fallback
        const itunesFallback = await enrichMetadataWithITunes(url, '');
        if (!res.headersSent) {
            res.json(itunesFallback || { title: url, uploader: 'Unknown', thumbnail: null });
        }
    });

    ytdlp.on('close', async () => {
        try {
            const data = JSON.parse(out);
            const { title: cleanT, artist: cleanA } = parseArtistAndTitle(data.title, data.uploader);
            log('METADATA', `Resolved: "${data.title}" by ${data.uploader}`);

            // Enrich in parallel with iTunes for 600x600 artwork and official genre
            let enriched = null;
            try {
                enriched = await enrichMetadataWithITunes(cleanT, cleanA);
            } catch (_) {}

            res.json({
                title: enriched?.title || cleanT || data.title,
                uploader: enriched?.artist || cleanA || data.uploader,
                thumbnail: enriched?.thumbnail || data.thumbnail,
                duration: enriched?.duration || data.duration,
                genre: enriched?.genre || data.genre || null,
                album: enriched?.album || data.album || null,
                year: enriched?.year || (data.upload_date ? data.upload_date.slice(0, 4) : null)
            });
        } catch (e) {
            const fallback = await enrichMetadataWithITunes(url, '');
            res.json(fallback || { title: url, uploader: 'Unknown', thumbnail: null });
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
