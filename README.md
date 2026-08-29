# Wibei - 3D WebGL Music Visualizer

Wibei is a real-time 3D music visualizer featuring a glassmorphism interface, WebGL rendering via Three.js with UnrealBloom post-processing, and interactive 3D camera controls.

![Wibei Visualizer](public/favicon.svg)

## ✨ Features

- **3D WebGL Audio Reactivity**: 
  - Dynamic **Pulse Ring** (128 circular reactive bars with symmetrical frequency distribution).
  - Linear **Waveform** and **3D Matrix Grid** visualizer modes.
  - Symmetrical organic harmonic breathing idle animations.
  - UnrealBloom glow effects with customizable neon themes (Gold, Cyan, Magenta).
- **Interactive 3D Controls**:
  - Mouse parallax camera tilt following the cursor.
  - Click & drag 3D scene orbit to inspect the visualizer from any perspective.
  - "← Back" button to reset the 3D viewing angle.
- **Multiple Audio Sources**:
  - **YouTube / Spotify Streaming**: Search by song name or paste a direct link.
  - **Accurate Search Suggestions**: Real-time song search previews with thumbnail album art and channel details.
  - **Microphone Input (🎤)**: Live audio visualizer driven by your microphone with intelligent noise-gating.
  - **Local Audio Upload (📁)**: Instant playback of your own `.mp3` and `.wav` files.
- **Player & Queue System**:
  - Seek bar with smooth timeline scrubber.
  - Auto-play queue for continuous music playback.
  - Live system activity logs toggle.

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Python 3](https://www.python.org/) with `yt-dlp` (for YouTube audio streaming)

### Installation
```bash
# Clone the repository
git clone https://github.com/EVINJSUBIN/Wibei.git
cd Wibei

# Install dependencies
npm install

# Start the web server
npm start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

## 📦 Ready to Ship / Deployment

Wibei is built with an Express.js backend serving optimized static assets and API routes.

### Deploying to Render, Railway, or Heroku:
1. Push your repository to GitHub.
2. Link your repository on [Render](https://render.com/) or [Railway](https://railway.app/) as a **Web Service**.
3. Build command: `npm install`
4. Start command: `npm start`
5. The service will be live with full WebGL support across all modern desktop and mobile browsers!
