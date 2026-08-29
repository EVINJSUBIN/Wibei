const fs = require('fs');
const path = require('path');
const https = require('https');

const binDir = path.join(__dirname, '..', 'bin');
if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
}

const isWin = process.platform === 'win32';
const binName = isWin ? 'yt-dlp.exe' : 'yt-dlp';
const binPath = path.join(binDir, binName);

if (fs.existsSync(binPath)) {
    console.log(`yt-dlp already exists at: ${binPath}`);
    process.exit(0);
}

const url = isWin
    ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
    : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

console.log(`Downloading standalone yt-dlp binary from ${url}...`);

function download(url, dest, cb) {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
            return download(res.headers.location, dest, cb);
        }
        res.pipe(file);
        file.on('finish', () => {
            file.close(() => {
                if (!isWin) {
                    fs.chmodSync(dest, '755');
                }
                console.log(`Downloaded yt-dlp successfully to ${dest}`);
                if (cb) cb();
            });
        });
    }).on('error', (err) => {
        fs.unlink(dest, () => {});
        console.error('Download error:', err.message);
    });
}

download(url, binPath);
