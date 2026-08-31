# wibei

a 3d webgl audio visualizer built with three.js and the web audio api.

**demo:** [https://wibei-production.up.railway.app/](https://wibei-production.up.railway.app/)

---

### why i made this
i built this for hack club stardance! i wanted to make a music visualizer that feels alive and responsive in 3d space, where you can actually grab the visualizer with your mouse, spin it around, and watch the frequencies bounce to the beat in real time with neon glow shaders.

### what it does
- **3 visualizer shapes:** a 128-bar circular pulse ring, a linear frequency waveform, and a 3d matrix grid
- **audio sources:** search any song on youtube, plug in your live microphone, or drop in a local `.mp3` file
- **3d camera interaction:** mouse parallax tilt + click & drag to rotate the camera around the scene
- **theme switcher:** gold, cyan, and neon pink themes with bloom glow
- **keyboard shortcuts:** `Space` (play/pause), `M` (mute), `R` (reset camera), `1/2/3` (switch visualizer shape), `F` (fullscreen)

### how it works under the hood
1. **audio analysis:** audio streams into an `AudioContext` which connects to an `AnalyserNode`. the analyser runs a real-time Fast Fourier Transform (FFT) to convert raw audio into a 128-bin frequency array.
2. **mesh updates:** the frequency array is mapped symmetrically to 128 Three.js box meshes. each animation frame (`requestAnimationFrame`), the height of each bar is updated using lerped interpolation (`target - current * 0.25`) so the bars jump on beat and decay smoothly with physics.
3. **idle wave:** when no audio is playing, a multi-harmonic sine wave (`sin(3θ + 1.5t) + sin(2θ - 0.9t)`) keeps the ring breathing in a continuous 360° liquid loop.
4. **post-processing:** an `UnrealBloomPass` shader adds the neon bloom glow on top of the dark synth grid.

### running locally
1. clone the repo:
   ```bash
   git clone https://github.com/EVINJSUBIN/Wibei.git
   cd Wibei
   ```
2. install packages:
   ```bash
   npm install
   ```
3. start the server:
   ```bash
   npm start
   ```
4. open `http://localhost:3000` in your browser!

### tech stack
- **frontend:** Vanilla JS, Three.js (r128), Web Audio API, UnrealBloomPass
- **backend:** Node.js, Express, yt-search, yt-dlp
- **hosting:** Railway

built for [Hack Club Stardance](https://stardance.hackclub.com) ✨
