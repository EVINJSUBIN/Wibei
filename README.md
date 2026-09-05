# wibei

a 3d webgl audio spectrograph and real-time dsp synthesizer built with three.js and the web audio api for hack club stardance.

**live site:** [https://wibei.onrender.com](https://wibei.onrender.com) (backup: [https://wibei-production.up.railway.app/](https://wibei-production.up.railway.app/))

![Wibei Preview](public/preview.png)

---

### why i made this
i wanted to build an interactive audio visualizer where you can manipulate live sound DSP filters in real-time, orbit around in 3D space, and watch frequencies and beat drops drive particle shockwaves and geometry deformations.

---

### features
- **4 geometry modes:** 128-bar Radial Pulse Ring, Waveform Ribbon, 3D Voxel Matrix, and the new **Pulsar Sphere** (harmonic geodesic mesh).
- **sound shaper dsp rack:**
  - **muffler:** lowpass biquad filter (underwater / club bathroom vibe).
  - **bass boost:** low-shelf overdrive EQ (+10dB boost).
  - **speed & pitch:** instant speed switching (1.0x Normal, 1.25x Nightcore, 0.85x Slowed Vibe).
- **beat drop shockwave:** real-time transient energy detector that spawns expanding 3D shockwave rings on heavy bass drops.
- **cinematic auto-cam:** drone orbit camera choreography that dynamically moves with track intensity.
- **fullscreen drag & drop:** drop any `.mp3` or `.wav` file anywhere on screen to load and visualize instantly.
- **color spectra:** Solar Amber, Cyber Cyan, Neon Rose, and Full Dynamic Rainbow gradient.
- **frosted light & dark themes:** complete aesthetic toggle with persistent state.

---

### how to try it out
- **quick demos (recommended):** click any track in the left panel (Synthwave Pulse, Lofi Chill Beats, or Acoustic Harmony) — loads instantly with 0ms buffering.
- **drag & drop or upload:** drop any audio file anywhere onto the window or click Choose File.
- **live microphone:** click Use Live Microphone to pipe acoustic room sound through the FFT visualizer.
- **youtube stream:** search any song or artist in the Stream tab.

> **note about youtube search on cloud servers:**  
> because the live app is hosted on cloud servers (render/railway), youtube occasionally flags datacenter IPs with bot-check challenges (429).  
> if a specific query gets rate-limited by youtube, simply click any of the **built-in demos** or drop in a local audio file.

---

### keyboard shortcuts
- `space` - play / pause
- `1` / `2` / `3` / `4` - switch geometry mode (ring, wave, grid, orb)
- `u` - toggle underwater muffler filter
- `b` - toggle bass boost overdrive
- `a` - toggle cinematic auto-cam orbit
- `r` - reset 3d viewport
- `m` - mute / unmute
- `f` - toggle fullscreen

---

### how to run locally
```bash
git clone https://github.com/EVINJSUBIN/Wibei.git
cd Wibei
npm install
npm start
```
open `http://localhost:3000` in your browser.

---

### project structure
```text
Wibei/
├── bin/                 # Local yt-dlp binary (gitignored)
├── docs/                # Devlog & Stardance roadmap documentation
│   ├── DEVLOG.md
│   └── stardance_roadmap.md
├── public/              # Web application root (statically served)
│   ├── audio/           # Royalty-free local demo tracks
│   ├── css/             # Stylesheets (app glassmorphism & landing)
│   ├── images/          # Track vector artwork & visual assets
│   ├── js/              # Modular ES audio, 3D visualizer & UI scripts
│   ├── app.html         # 3D Audio Spectrograph Studio cockpit
│   ├── favicon.svg      # App icon
│   ├── index.html       # VOID aesthetic landing page
│   └── preview.png      # Application UI preview snapshot
├── scripts/             # Build and deployment binary installer
│   └── install-ytdlp.js
├── CODEBASE.md          # Comprehensive directory-by-directory architecture guide
├── Dockerfile           # Production container build definition
├── nixpacks.toml        # Nixpacks deployment environment configuration
├── package.json         # NPM dependencies & lifecycle scripts
├── README.md            # Main overview
├── render.yaml          # Render.com auto-deployment configuration
└── server.js            # Express API, audio streamer & static file server
```
For deep-dive documentation on every single directory, see [CODEBASE.md](CODEBASE.md).

---

### tech stack
- **frontend:** vanilla javascript, three.js, web audio api (fft analyser, biquad lowpass/lowshelf filters)
- **backend:** node.js, express, yt-search, yt-dlp
- **hosting:** docker, render.com, railway

built for [Hack Club Stardance](https://stardance.hackclub.com)
