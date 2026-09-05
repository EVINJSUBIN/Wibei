# 📁 Wibei Codebase Directory Guide

This document provides a comprehensive, directory-by-directory architectural breakdown of the **Wibei** 3D Audio Spectrograph & Real-Time DSP Lab codebase.

---

## 🗺️ High-Level Directory Map

```text
Wibei/
├── bin/                                # Local yt-dlp standalone binaries (gitignored)
├── docs/                               # Developer logs & Stardance roadmap
│   ├── DEVLOG.md                       # Hack Club Stardance sprint devlog
│   └── stardance_roadmap.md            # Hack Club Stardance shipping goals
├── public/                             # Client-side web root statically served by Express
│   ├── audio/                          # Built-in royalty-free demonstration tracks
│   │   ├── chill.mp3                   # Acoustic Harmony demo
│   │   ├── lofi.mp3                    # Lofi Chill Beats demo
│   │   └── synthwave.mp3               # Synthwave Pulse demo
│   ├── css/                            # Application and landing page stylesheets
│   │   ├── landing.css                 # Minimalist VOID landing page style
│   │   └── style.css                   # Studio cockpit glassmorphism & HUD styles
│   ├── images/                         # Vector illustrations & demo album artwork
│   │   ├── demo-chill.svg              # Ambient wave SVG artwork
│   │   ├── demo-lofi.svg               # Midnight coffee SVG artwork
│   │   └── demo-synthwave.svg          # Neon horizon synthwave SVG artwork
│   ├── js/                             # Modular client-side JavaScript components
│   │   ├── app.js                      # Master bootstrap orchestrator
│   │   ├── audio.js                    # Web Audio API context & node routing
│   │   ├── background.js               # Dynamic 2D canvas particle & nebula engine
│   │   ├── config.js                   # Application state, math utils & themes
│   │   ├── id3.js                      # Zero-dependency binary ID3 tag & APIC parser
│   │   ├── landing.js                  # VOID WebGL 3D preview engine for landing page
│   │   ├── player.js                   # Playlist queue, LRC lyrics & audio streaming
│   │   ├── ui.js                       # DOM event bindings, keyboard shortcuts & DSP
│   │   └── visualizer.js               # Three.js 3D scene, geometries & bloom pipeline
│   ├── app.html                        # Main 3D Spectrograph Studio application
│   ├── favicon.svg                     # Vector wave logo / browser favicon
│   ├── index.html                      # VOID aesthetic landing page
│   └── preview.png                     # Application screenshot
├── scripts/                            # Build & lifecycle automation scripts
│   └── install-ytdlp.js                # Cross-platform yt-dlp binary installer
├── .gitignore                          # Git exclude rules (node_modules, bin, logs)
├── CODEBASE.md                         # This file (directory architecture documentation)
├── Dockerfile                          # Multi-stage production container manifest
├── nixpacks.toml                       # Nixpacks cloud deployment configuration
├── package.json                        # NPM package manifest & npm scripts
├── README.md                           # Public repository overview
├── render.yaml                         # Render.com web service deployment spec
└── server.js                           # Express audio streaming backend & static server
```

---

## 📂 Directory Breakdown

### 1. `bin/`
* **Path:** `bin/`
* **Purpose:** Stores the platform-specific standalone binary of [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) used on local workstations (Windows `yt-dlp.exe` or Linux `yt-dlp`).
* **Source & Generation:** Automatically created by `scripts/install-ytdlp.js` during `npm install` (via the `postinstall` hook) if a system-level Python `yt-dlp` is absent.
* **Git Status:** Gitignored (`bin/` in `.gitignore`) to keep the repository lightweight and avoid checking in platform-dependent executables.

---

### 2. `docs/`
* **Path:** `docs/`
* **Purpose:** Centralized project documentation, devlogs, and submission material for Hack Club Stardance.
* **Contents:**
  - `DEVLOG.md`: Detailed engineering log covering the design of the 3D mood engine, 6 aesthetic presets, Web Audio DSP pipelines, and frequency band classifiers.
  - `stardance_roadmap.md`: Hack Club Stardance checklist, shipping milestones, and R&D logs.

---

### 3. `public/`
* **Path:** `public/`
* **Purpose:** The web application root directory served statically by Express via `express.static(path.join(__dirname, 'public'))`.
* **Root Files:**
  - `index.html`: The minimal VOID landing page introducing Wibei, featuring a dynamic 3D celestial starfield preview, live DSP audition buttons, and links into the studio.
  - `app.html`: The complete glassmorphism 3D Audio Spectrograph Studio workspace containing the Three.js viewport, playlist deck, audio telemetry meters, DSP sound shaper rack, and lyrics HUD.
  - `favicon.svg`: Monochromatic sinusoidal frequency wave icon used for browser tabs and fallback album art.
  - `preview.png`: High-resolution visual snapshot of the 3D cockpit for documentation and social metadata.

#### 3.1 `public/audio/`
* **Purpose:** Bundled, zero-buffering royalty-free demo tracks that allow immediate audio visualization without requiring network streaming or local file selection.
* **Files:**
  - `chill.mp3`: Acoustic / ambient downtempo demo track (100 BPM).
  - `lofi.mp3`: Late-night lofi chill beat (85 BPM).
  - `synthwave.mp3`: Energetic 80s retrowave synthwave track (128 BPM).

#### 3.2 `public/css/`
* **Purpose:** Contains all presentation styles, typography rules, glassmorphism filters, and animations.
* **Files:**
  - `landing.css`: Dark-mode minimalist styles for `index.html`, utilizing JetBrains Mono, translucent card overlays, and subtle button borders.
  - `style.css`: Comprehensive design system for `app.html`. Defines CSS custom properties (`--bg`, `--accent`, `--border`), glassmorphism frosted backdrops (`backdrop-filter: blur()`), deck transitions, rotary knobs, VU meters, toast popups, and lyrics synchronization styling.

#### 3.3 `public/images/`
* **Purpose:** Visual media assets, vector album art thumbnails for the built-in demo tracks, and UI graphics.
* **Files:**
  - `demo-chill.svg`: Ambient gradient artwork for "Acoustic Harmony".
  - `demo-lofi.svg`: Midnight coffee illustration for "Lofi Chill Beats".
  - `demo-synthwave.svg`: Neon horizon synthwave grid artwork for "Synthwave Pulse".

#### 3.4 `public/js/`
* **Purpose:** Modular JavaScript client code running in the browser. Zero build step or bundling required.
* **Component Architecture:**
  - `config.js`: Math helper routines (`lerp`, `clamp`, `formatTime`), shared global state variables (`audioCtx`, `scene`, `camera`, `analyser`), toast notifications, and the 6 aesthetic theme definitions (`THEMES`).
  - `audio.js`: Initializes and manages the Web Audio `AudioContext`, attaches `<audio>` media elements with node-reuse protection, routes through the Biquad filter chain, and exposes the microphone feed.
  - `background.js`: Dynamic 2D background canvas renderer simulating deep space starfields, reactive sub-bass shockwave rings, comic pop rays, and theme ambient visual effects.
  - `visualizer.js`: Three.js scene setup, perspective camera, `EffectComposer` bloom pipeline (`UnrealBloomPass`), and the 4 procedural geometries:
    1. **Pulse:** 128 radial towers scaling with sub-bass kick transients & rotating center holographic album art disc.
    2. **Wave:** 64-band mirrored kinetic ribbon highway.
    3. **Grid:** 16x16 spatial voxel matrix pulsing to harmonic shockwaves.
    4. **Orb:** Harmonic geodesic icosahedron deformed by acoustic frequency bins with dual gyro gimbal rings.
  - `player.js`: Track queue manager, track switching, seek bar scrubbing, synchronized LRC lyrics parsing, streaming resolver, and local file loader with embedded ID3 metadata extraction.
  - `id3.js`: Zero-dependency binary ID3 tag parser (ID3v2.3, ID3v2.4, ID3v1). Extracts title, artist, album, and APIC embedded album artwork directly into browser Object URLs.
  - `landing.js`: Standalone lightweight Three.js experience driving the background starfield and interactive gyro core on `index.html`.
  - `ui.js`: DOM event binder for transport buttons, deck tabs, presets, search autocomplete, drag-and-drop file loading, DSP toggles, and keyboard shortcuts.
  - `app.js`: Minimal orchestrator entry point that bootstraps modules in sequence on `DOMContentLoaded`.

---

### 4. `scripts/`
* **Path:** `scripts/`
* **Purpose:** Server build and deployment utility scripts.
* **Files:**
  - `install-ytdlp.js`: Cross-platform Node.js downloader that fetches the latest official standalone `yt-dlp` executable from GitHub Releases and places it in `bin/`. Configures executable permissions (`chmod 755`) on Unix-based hosts.

---

### 5. Root Configuration & Server Files

* `server.js`: The Express.js backend server. Handles static file serving, YouTube video search via `yt-search`, audio stream pipe via `yt-dlp` stdout, Spotify title scrapers, and health endpoints.
* `package.json`: NPM package metadata, start script (`node server.js`), and `postinstall` binary download trigger.
* `Dockerfile`: Production Debian Bookworm container image with Node 20, Python 3, FFmpeg, and direct standalone `yt-dlp` installation.
* `render.yaml`: Cloud deployment blueprint for Render.com deploying Wibei as a containerized web service.
* `nixpacks.toml`: Alternative deployment configuration for Nixpacks-based cloud platforms (e.g. Railway).
* `.gitignore`: Prevents checking in `node_modules/`, `bin/`, `.npm/`, and `*.log` files.
* `README.md`: Public-facing introduction, feature matrix, keyboard controls, and local development instructions.
