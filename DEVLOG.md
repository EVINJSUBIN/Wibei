# ⚡ Wibei — Devlog: Building a Music-Reactive Mood Engine in 3D

> **Project:** Wibei (Open-Source 3D Audio Spectrograph & Real-Time DSP Lab)  
> **Built for:** Hack Club Stardance  
> **Creators:** [@EVINJSUBIN](https://github.com/EVINJSUBIN) & [@aamosm](https://github.com/aamosm)  
> **Repo:** [github.com/EVINJSUBIN/Wibei](https://github.com/EVINJSUBIN/Wibei) | **Live:** [wibei.onrender.com](https://wibei.onrender.com)

---

### 💡 The Problem: Why do most audio visualizers feel static?

When we first shipped Wibei, we had functional WebGL spectrograph bars and real-time Web Audio DSP filters (lowpass muffler, bass boost overdrive, nightcore speed clock). But after gathering feedback, we realized something crucial:

**A visualizer shouldn't look the same whether you're playing aggressive phonk or chill bedroom lofi.** 

Static color palettes or generic audio bars make every song feel identical. We wanted the **entire visualizer atmosphere** — background particle density, bloom lighting, deck panel borders, typography accents, and 3D geometry colors — to transform based on the music's energy and vibe.

---

### 🛠️ What We Engineered:

#### 1. Real-Time Acoustic Mood Engine (`Auto Mood`)
Using the native Web Audio API `AnalyserNode` (256 FFT / 128 frequency bands), we built a client-side frequency band classifier that runs every frame:
- **Sub-Bass Energy (0–250 Hz):** Tracks 808s and kick transients to trigger expanding 3D shockwave particle rings.
- **Mid-Band Acoustic Energy (250 Hz–2.5 kHz):** Measures melodic vocals and instruments.
- **High-Frequency Air (2.5 kHz–16 kHz):** Detects hi-hats, percussive transients, and synth air.

We calculate the **spectral centroid** and **bass dominance ratio** in real-time. In `AUTO MOOD`, this continuously interpolates through an HSL color-space that dynamically morphs CSS custom variables (`--accent`, `--bg`, `--border`) and WebGL emissive shaders as the song transitions from quiet verses into heavy drops!

#### 2. Six Handcrafted Aesthetic Vibes
We designed 6 distinct visual moods tailored for different genres:
1. **⚡ PHONK / DRIFT:** Blood Crimson (`#ef4444`) & Toxic Violet (`#a855f7`) with high bloom (1.8x) and aggressive kick physics.
2. **💥 COMIC / POP:** Pop Gold, Cyan & Hot Pink tri-color contrast with comic book vibrancy.
3. **🌅 LOFI SUNSET:** Warm Peach, Dusk Lavender & Dusty Cyan for late-night chill sessions.
4. **🟢 CYBER MATRIX:** Acid Green phosphors and dark terminal styling.
5. **❄️ SERIOUS VOID:** Distraction-free monochrome mixing spectrograph for acoustic audio inspection.
6. **🌈 DYNAMIC AUTO:** Live music-driven FFT color morphing.

#### 3. Keyboard Shortcut & Seamless Interaction
- Press **`T`** to instantly cycle aesthetic vibes on the fly.
- Press **`1 / 2 / 3 / 4`** to switch between Radial Pulse, Wave Ribbon, 3D Matrix, and the Pulsar Sphere.
- Press **`U`** (Muffler) or **`B`** (Bass Overdrive) for real-time DSP filter modulation.

---

### 💻 100% Client-Side, Zero Heavy Frameworks
Everything is built from scratch with **vanilla JavaScript, Three.js WebGL, and the native Web Audio API**. No bloated UI libraries, running at a rock-solid 60 FPS with zero audio buffer latency.
