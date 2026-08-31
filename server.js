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

// Stream Endpoint
app.get('/stream', async (req, res) => {
    let url = req.query.url;
    if (!url) {
        log('STREAM-ERR', 'Missing query URL parameter');
        return res.status(400).send('URL is required');
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
        '-f', 'bestaudio[ext=m4a]/bestaudio',
        '--js-runtimes', 'node',
        '--remote-components', 'ejs:github',
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

// Search API
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

// Auto-suggestions API
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

// Metadata API
app.get('/metadata', (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).send('URL required');
  
    let targetUrl = url;
    if (!url.startsWith('http')) targetUrl = `ytsearch1:${url} audio`;
  
    const { cmd, prefix, source } = getExec();
    const args = [...prefix, '-j', '--no-warnings', targetUrl];
    
    log('METADATA', `Fetching track metadata via [${source}] for: "${url}"`);
    const ytdlp = spawn(cmd, args);

    let out = '';
    ytdlp.stdout.on('data', d => out += d);

    ytdlp.on('error', (err) => {
        log('METADATA-ERR', `Failed to fetch metadata: ${err.message}`);
        if (!res.headersSent) res.json({ title: 'Unknown', uploader: 'Unknown', thumbnail: null });
    });

    ytdlp.on('close', () => {
        try {
            const data = JSON.parse(out);
            log('METADATA', `Resolved: "${data.title}" by ${data.uploader}`);
            res.json({ title: data.title, uploader: data.uploader, thumbnail: data.thumbnail, duration: data.duration });
        } catch (e) {
            res.json({ title: 'Unknown', uploader: 'Unknown', thumbnail: null });
        }
    });
});

// Health check endpoint for uptime monitors
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
