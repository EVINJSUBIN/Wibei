const express = require('express');
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const https = require('https');
const yts = require('yt-search');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

function getExec() {
    const cmds = process.platform === 'win32' 
        ? [['python', '-m', 'yt_dlp'], ['yt-dlp'], ['python3', '-m', 'yt_dlp']]
        : [['yt-dlp'], ['python3', '-m', 'yt_dlp'], ['python', '-m', 'yt_dlp']];
    for (const [cmd, ...prefix] of cmds) {
        try {
            const res = spawnSync(cmd, ['--version'], { stdio: 'ignore' });
            if (res.status === 0 || !res.error) {
                return { cmd, prefix };
            }
        } catch (e) {}
    }
    return { cmd: process.platform === 'win32' ? 'python' : 'python3', prefix: ['-m', 'yt_dlp'] };
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

app.get('/stream', async (req, res) => {
    let url = req.query.url;
    if (!url) return res.status(400).send('URL is required');

    let targetUrl = url;
    if (url.includes('spotify.com/track')) {
        try {
            const title = await getSpotifyTitle(url);
            if (title) targetUrl = `ytsearch1:${title} audio`;
        } catch (e) {}
    } else if (!url.startsWith('http')) {
        targetUrl = `ytsearch1:${url} audio`;
    }

    const { cmd, prefix } = getExec();
    const args = [
        ...prefix,
        '-f', 'bestaudio[ext=m4a]/bestaudio',
        '--js-runtimes', 'node',
        '--remote-components', 'ejs:github',
        '-o', '-',
        '-q',
        targetUrl
    ];

    const ytdlp = spawn(cmd, args);

    res.setHeader('Content-Type', 'audio/mp4');
    ytdlp.stdout.pipe(res);

    ytdlp.stderr.on('data', () => {});

    ytdlp.on('error', (err) => {
        console.error('yt-dlp stream error:', err.message);
        if (!res.headersSent) res.status(500).send('Stream error');
    });

    req.on('close', () => {
        try {
            ytdlp.kill();
        } catch (e) {}
    });
});

app.get('/api/search', async (req, res) => {
    const q = req.query.q;
    if (!q) return res.json([]);
    try {
        const searchResults = await yts(q);
        const videos = (searchResults.videos || []).slice(0, 5);
        const items = videos.map(v => ({
            title: v.title,
            uploader: v.author?.name || 'Unknown Artist',
            url: v.url,
            thumbnail: v.thumbnail || null,
            duration: v.seconds || 0
        }));
        res.json(items);
    } catch (e) {
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
    }).on('error', () => res.json([]));
});

app.get('/metadata', (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).send('URL required');
  
    let targetUrl = url;
    if (!url.startsWith('http')) targetUrl = `ytsearch1:${url} audio`;
  
    const { cmd, prefix } = getExec();
    const args = [...prefix, '-j', '--no-warnings', targetUrl];
    const ytdlp = spawn(cmd, args);

    let out = '';
    ytdlp.stdout.on('data', d => out += d);

    ytdlp.on('error', (err) => {
        console.error('yt-dlp metadata error:', err.message);
        if (!res.headersSent) res.json({ title: 'Unknown', uploader: 'Unknown', thumbnail: null });
    });

    ytdlp.on('close', () => {
        try {
            const data = JSON.parse(out);
            res.json({ title: data.title, uploader: data.uploader, thumbnail: data.thumbnail, duration: data.duration });
        } catch (e) {
            res.json({ title: 'Unknown', uploader: 'Unknown', thumbnail: null });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
