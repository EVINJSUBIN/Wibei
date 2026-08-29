const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const https = require('https');
const play = require('play-dl');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

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
        } catch (e) {
            console.error(e);
        }
    } else if (!url.startsWith('http')) {
        targetUrl = `ytsearch1:${url} audio`;
    }

    const ytdlp = spawn('python', [
        '-m', 'yt_dlp', 
        '-f', 'bestaudio[ext=m4a]/bestaudio', 
        '--js-runtimes', 'node',
        '--remote-components', 'ejs:github',
        '-o', '-', 
        '-q', 
        targetUrl
    ]);

    res.setHeader('Content-Type', 'audio/mp4');
    ytdlp.stdout.pipe(res);

    ytdlp.stderr.on('data', (data) => {
        console.error(`yt-dlp error: ${data}`);
    });

    ytdlp.on('error', (err) => {
        console.error('Failed to start python yt-dlp:', err);
    });

    req.on('close', () => {
        ytdlp.kill();
    });
});

app.get('/api/search', async (req, res) => {
    const q = req.query.q;
    if (!q) return res.json([]);
    try {
        const results = await play.search(q, { limit: 5, source: { youtube: "video" } });
        const items = results.map(x => ({
            title: x.title,
            uploader: x.channel?.name || 'Unknown Artist',
            url: x.url,
            thumbnail: x.thumbnails?.[0]?.url || null,
            duration: x.durationInSec || 0
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
            } catch(e) { 
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
  
    const ytdlp = spawn('python', ['-m', 'yt_dlp', '-j', '--no-warnings', targetUrl]);
    let out = '';
    ytdlp.stdout.on('data', d => out += d);
    ytdlp.on('close', () => {
        try {
            const data = JSON.parse(out);
            res.json({ title: data.title, uploader: data.uploader, thumbnail: data.thumbnail, duration: data.duration });
        } catch(e) {
            res.json({ title: 'Unknown', uploader: 'Unknown', thumbnail: null });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
