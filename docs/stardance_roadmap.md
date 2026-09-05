# Wibei: Shipping Roadmap & R&D Log

Wibei is a 3D music visualization web app using Three.js and Web Audio APIs. To ship this for Stardance, we need to ensure the audio processing works smoothly and the UI feels polished.

## Core Features Required for Shipping
- [ ] **Audio Upload / Selection:** Allow users to upload local `.mp3` files or select from 3-5 pre-loaded demo tracks.
- [ ] **Real-time Audio Analysis:** Connect the Web Audio API AnalyzerNode to the Three.js uniforms to drive the visuals dynamically based on frequency data.
- [ ] **Visualizer Modes:** Implement at least 2 distinct visualizer modes (e.g., 'Waveform Sphere' and 'Frequency Bars').
- [ ] **Performance Pass:** Ensure the `canvas` element renders at a stable 60 FPS by optimizing the Three.js geometry updates.
- [ ] **UI Polish:** Add a sleek "Now Playing" UI overlay, play/pause controls, and a minimalist CSS reset.

## Devlog Schedule
- **Devlog 1: The Skeleton.** Setting up the Express backend and the basic Three.js scene.
- **Devlog 2: Wiring the Audio.** Detailed explanation of how the Web Audio API feeds into the Three.js canvas.
- **Devlog 3: Visual Polish & Performance.** Optimizing the render loop and adding the final UI overlay.

## Stardance Submission Checklist
- [ ] Open-source repository is public.
- [ ] Code has been tracked with Hackatime.
- [ ] Project has a clean `README.md` with a screenshot.
- [ ] Deployed to a live URL (e.g., Vercel, Render, or GitHub Pages).
