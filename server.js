const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const https = require('https');

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname)));
app.use(express.json());

// Helper function to extract Spotify title from its web page
function getSpotifyTitle(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                // Try to find the title tag
                const match = data.match(/<title>(.*?)<\/title>/);
                if (match && match[1]) {
                    // Spotify titles usually look like "Song Name - song and lyrics by Artist | Spotify"
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

    console.log(`Requested stream for: ${url}`);

    let targetUrl = url;

    // Handle Spotify URLs by scraping title and converting to a YouTube search
    if (url.includes('spotify.com/track')) {
        try {
            console.log('Detected Spotify URL, extracting title...');
            const title = await getSpotifyTitle(url);
            if (title) {
                console.log(`Found title: ${title}`);
                targetUrl = `ytsearch1:${title} audio`;
            } else {
                return res.status(400).send('Could not extract Spotify metadata');
            }
        } catch (e) {
            console.error(e);
            return res.status(500).send('Error fetching Spotify metadata');
        }
    }

    // Use yt-dlp to stream audio to stdout
    // -f bestaudio: best audio format
    // -o -: output to stdout
    // -q: quiet (no logs to stdout)
    const ytdlp = spawn('python', ['-m', 'yt_dlp', '-f', 'bestaudio', '-o', '-', '-q', targetUrl]);

    res.setHeader('Content-Type', 'audio/webm'); // Usually webm or mp4 audio

    ytdlp.stdout.pipe(res);

    ytdlp.stderr.on('data', (data) => {
        console.error(`yt-dlp error: ${data}`);
    });

    ytdlp.on('close', (code) => {
        console.log(`yt-dlp process exited with code ${code}`);
    });

    req.on('close', () => {
        console.log('Client closed connection, killing yt-dlp...');
        ytdlp.kill();
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
