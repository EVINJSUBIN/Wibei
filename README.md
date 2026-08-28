# Wibei Visualizer

Wibei is a stunning, real-time music visualizer using WebGL, WebAudio API, and Glassmorphism design. It pulls audio streams from YouTube/Spotify directly and generates beautiful 3D particle and waveform animations.

## Features
- Real-time WebGL audio visualization using Three.js
- Glassmorphism user interface
- Stream audio from any YouTube or Spotify URL
- Multiple visualizer shapes (Pulse Ring, Wave, Crystal Prism, Spectrum Grid)
- Multiple themes (Cyberpunk, Synth Grid, Dark Blocks)

## Getting Started (Local Development)

### Prerequisites
- [Node.js](https://nodejs.org/) (v16+)

### Installation
```bash
# Install dependencies
npm install

# Start the server
npm start
```
Open `http://localhost:3000` in your browser.

## Ready to Ship

Wibei is built as a lightweight, pure Node.js website (with Express). Because it fetches streaming audio directly from YouTube to bypass browser CORS rules, it requires a backend server.

You can easily deploy this website for free using standard Node.js hosting platforms:

### Deploying to Render / Railway / Heroku
1. Push this repository to GitHub.
2. Go to [Render](https://render.com/) or [Railway](https://railway.app/).
3. Create a new "Web Service" and connect your GitHub repository.
4. The platform will automatically detect it as a Node.js app, run `npm install`, and start it via `npm start`.
5. Your Wibei visualizer is now live on the internet!

