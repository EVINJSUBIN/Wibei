const masterVuSpans = document.querySelectorAll('.vu-meter-master .vu-bar span');
const telemetryPeak = document.getElementById('telemetry-peak');
const sourceBadge = document.getElementById('source-badge');

function ensureAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.82;
        dataArr = new Uint8Array(analyser.frequencyBinCount);

        biquadMuffler = audioCtx.createBiquadFilter();
        biquadMuffler.type = 'lowpass';
        biquadMuffler.frequency.value = 20000;
        biquadMuffler.Q.value = 1.0;

        biquadBass = audioCtx.createBiquadFilter();
        biquadBass.type = 'lowshelf';
        biquadBass.frequency.value = 150;
        biquadBass.gain.value = 0;

        masterGain = audioCtx.createGain();
        masterGain.gain.value = 1.0;

        biquadMuffler.connect(biquadBass);
        biquadBass.connect(masterGain);
        masterGain.connect(analyser);
        analyser.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function attachAudioElement(el) {
    ensureAudioCtx();
    if (el._audioSourceNode) {
        audioSrc = el._audioSourceNode;
    } else {
        if (audioSrc) {
            try { audioSrc.disconnect(); } catch (_) {}
        }
        el._audioSourceNode = audioCtx.createMediaElementSource(el);
        audioSrc = el._audioSourceNode;
    }
    try {
        audioSrc.connect(biquadMuffler);
    } catch (_) {}
}

function stopMic() {
    if (isMicActive && micStream) {
        micStream.getTracks().forEach(t => t.stop());
        micStream = null;
        isMicActive = false;
        if (sourceBadge) sourceBadge.innerText = 'STREAM';
        if (typeof updatePlayIcons === 'function') updatePlayIcons(false);
    }
}
