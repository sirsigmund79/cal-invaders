// All sound is synthesized with WebAudio: no audio files to download or decode.
(function () {
  const CI = window.__CI;
  if (!CI) return;

  let ac = null, master = null, noise = null, muted = false, ufo = null, stepI = 0;
  const STEP_NOTES = [98, 87.3, 77.8, 73.4];

  function init() {
    if (ac) return;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain();
      master.gain.value = 0.22;
      master.connect(ac.destination);
      const len = (ac.sampleRate * 0.5) | 0;
      noise = ac.createBuffer(1, len, ac.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) {
      ac = null;
    }
  }

  const ok = () => ac && !muted && ac.state === 'running';

  function resume() {
    if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
  }

  function tone(type, f0, f1, dur, vol, delay) {
    if (!ok()) return;
    const t = ac.currentTime + (delay || 0);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function burst(dur, vol, freq) {
    if (!ok()) return;
    const t = ac.currentTime;
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(80, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(master);
    s.start(t);
    s.stop(t + dur);
  }

  // A brassy, swelling I–IV–V progression. Original, just "epic"-sounding.
  function chord(freqs, start, dur, vol) {
    const t = ac.currentTime + start;
    const f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(400, t);
    f.frequency.linearRampToValueAtTime(2600, t + dur * 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.12);
    g.gain.setValueAtTime(vol, t + dur - 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    f.connect(g).connect(master);
    for (const fr of freqs) {
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = fr;
      o.detune.value = (Math.random() - 0.5) * 12;
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }

  CI.audio = {
    init,
    resume,
    shoot: () => tone('square', 880, 220, 0.12, 0.12),
    enemyShoot: () => tone('triangle', 320, 140, 0.12, 0.1),
    boom: () => burst(0.28, 0.6, 2200),
    hit: () => { burst(0.7, 0.9, 900); tone('sawtooth', 220, 40, 0.6, 0.25); },
    step: () => tone('square', STEP_NOTES[stepI++ & 3], 0, 0.09, 0.22),
    shuffle: () => { tone('sine', 520, 780, 0.08, 0.08); tone('sine', 780, 520, 0.08, 0.08, 0.09); },
    bonus: () => [660, 880, 1320, 1760].forEach((f, i) => tone('square', f, 0, 0.1, 0.1, i * 0.07)),
    fanfare() {
      if (!ok()) return;
      chord([116.5, 233.1, 293.7, 349.2, 466.2], 0, 1.3, 0.09);
      chord([155.6, 311.1, 392.0, 466.2, 622.3], 1.3, 1.1, 0.09);
      chord([174.6, 349.2, 440.0, 523.3, 698.5], 2.4, 2.6, 0.1);
    },
    win: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone('square', f, 0, 0.18, 0.12, i * 0.12)),
    lose: () => [392, 330, 262, 196].forEach((f, i) => tone('sawtooth', f, f * 0.95, 0.35, 0.14, i * 0.3)),
    ufoStart() {
      if (!ok() || ufo) return;
      const o = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(), g = ac.createGain();
      o.type = 'square'; o.frequency.value = 420;
      lfo.frequency.value = 7; lg.gain.value = 140;
      g.gain.value = 0.035;
      lfo.connect(lg).connect(o.frequency);
      o.connect(g).connect(master);
      o.start(); lfo.start();
      ufo = [o, lfo];
    },
    ufoStop() {
      if (!ufo) return;
      try { ufo[0].stop(); ufo[1].stop(); } catch (e) {}
      ufo = null;
    },
    toggleMute() {
      muted = !muted;
      if (muted) CI.audio.ufoStop();
      resume();
      return muted;
    },
    close() {
      CI.audio.ufoStop();
      if (ac) ac.close().catch(() => {});
      ac = master = noise = null;
    },
  };
})();
