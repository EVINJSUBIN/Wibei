# wibei ✨

yooo welcome to **wibei**! this is a 3d music visualizer i made with three.js and web audio api for [hack club stardance](https://stardance.hackclub.com) :D

**live site:** [https://wibei.onrender.com](https://wibei.onrender.com) (or [railway backup](https://wibei-production.up.railway.app/))

---

### why i made this
i really wanted to make an interactive audio visualizer where the music literally makes 3d geometry bounce around in real time. you can grab the camera with your mouse, spin it in 3d space, and watch the neon glow react to the bass hits and frequencies.

### how to try it out
1. **quick demos (recommended):** just click any of the quick play buttons at the top (**☕ lofi beats**, **🌃 synthwave**, or **✨ chill waves**) — these play instantly with zero loading time!
2. **local mp3 file:** click the folder icon (📁) and drop in any song from your computer.
3. **live mic:** click the microphone button (🎤) and make some noise or play music out loud!
4. **youtube search:** you can search any track name in the search bar.

> ⚠️ **quick note about youtube search on the live link:**  
> because the live site is hosted on cloud servers (render/railway), youtube's datacenter firewall sometimes blocks automated requests with a bot-check challenge (`sign in to confirm you are not a bot / 429`).  
> if a specific youtube song gets blocked by youtube on the cloud host, no worries! just use the **quick demo buttons (☕ 🌃 ✨)** or click the **upload button (📁)** to drop in any mp3 file!

---

### controls & keyboard shortcuts
- `space` -> play / pause
- `m` -> mute / unmute audio
- `1` / `2` / `3` -> switch visualizer shapes (1: pulse ring, 2: waveform, 3: matrix grid)
- `r` -> reset the 3d camera view
- `f` -> toggle fullscreen mode
- `drag mouse` -> rotate the visualizer around in 3d space

---

### how it works under the hood
- **web audio api:** creates an `AudioContext` and `AnalyserNode` that runs real-time Fast Fourier Transform (FFT) frequency analysis on the audio stream.
- **three.js 3d meshes:** takes the frequency byte array (128 frequency bins) and scales 128 box meshes arranged in a radial circle and matrix grid.
- **lerped spring physics:** the bars jump on the beat and decay smoothly (`current + (target - current) * 0.25`) so it looks bouncy and natural instead of jittery.
- **unreal bloom shader:** passes the three.js render scene through an `UnrealBloomPass` shader for neon bloom glow.
- **idle harmonic animation:** when no music is playing, a multi-sine wave loop (`sin(3θ + 1.5t) + sin(2θ - 0.9t)`) keeps the visualizer breathing in a liquid circle.

---

### how to run locally on your machine
if you wanna run this on your own laptop:

1. clone this repo:
   ```bash
   git clone https://github.com/EVINJSUBIN/Wibei.git
   cd Wibei
   ```

2. install the node packages:
   ```bash
   npm install
   ```

3. start the local server:
   ```bash
   npm start
   ```

4. open your browser and go to `http://localhost:3000`!

---

### tech used
- **frontend:** vanilla javascript, three.js, web audio api, google fonts
- **backend:** node.js, express, yt-search, yt-dlp
- **deployment:** docker, render.com, railway

built for [Hack Club Stardance](https://stardance.hackclub.com) 🚀
