const fs = require('fs');
const path = require('path');
const https = require('https');

const binDir = path.join(__dirname, '..', 'bin');
if (!fs.existsSync(binDir)) {
    try { fs.mkdirSync(binDir, { recursive: true }); } catch (e) {}
}

const isWin = process.platform === 'win32';
const binName = isWin ? 'yt-dlp.exe' : 'yt-dlp';
const binPath = path.join(binDir, binName);

if (fs.existsSync(binPath)) {
    console.log(`[INSTALL] yt-dlp standalone binary found at: ${binPath}`);
    process.exit(0);
}

const url = isWin
    ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
    : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

console.log(`[INSTALL] Fetching standalone yt-dlp binary from ${url}...`);

function download(targetUrl, dest, redirectCount = 0) {
    if (redirectCount > 5) {
        console.warn('[INSTALL] Too many redirects downloading yt-dlp');
        return;
    }
    const req = https.get(targetUrl, { headers: { 'User-Agent': 'Wibei-Installer' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
            return download(res.headers.location, dest, redirectCount + 1);
        }
        if (res.statusCode !== 200) {
            console.warn(`[INSTALL] Failed with HTTP ${res.statusCode}`);
            return;
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => {
            file.close(() => {
                try {
                    if (!isWin) fs.chmodSync(dest, '755');
                    console.log(`[INSTALL] Successfully installed yt-dlp binary to ${dest}`);
                } catch (err) {
                    console.warn('[INSTALL] Chmod error:', err.message);
                }
            });
        });
        file.on('error', (err) => {
            try { fs.unlinkSync(dest); } catch (e) {}
            console.warn('[INSTALL] Write error:', err.message);
        });
    });

    req.on('error', (err) => {
        console.warn('[INSTALL] Network error downloading yt-dlp:', err.message);
    });
}

download(url, binPath);
