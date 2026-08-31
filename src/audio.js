// =============================================
//  KAWAII POOL AUDIO ENGINE
//  Zero-dependency procedural sound effects
//  using the Web Audio API
// =============================================

let audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function unlockAudio() {
  const ctx = getCtx();
  if (ctx.state === 'suspended') ctx.resume();
}
document.addEventListener('mousedown', unlockAudio, { once: true });
document.addEventListener('touchstart', unlockAudio, { once: true });

function playTone(freq, duration, type = 'sine', volume = 0.15, delay = 0) {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
  gain.gain.setValueAtTime(volume, ctx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + duration);
}

function playNoise(duration, volume = 0.08, delay = 0) {
  const ctx = getCtx();
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, ctx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1800;
  filter.Q.value = 0.6;

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start(ctx.currentTime + delay);
}

// =============================================
//  PUBLIC POOL SFX
// =============================================

/** Cue stick hits the cue ball */
export function sfxCueHit(power = 0.5) {
  const vol = 0.08 + power * 0.15;
  playNoise(0.08, vol);
  playTone(380 + power * 150, 0.06, 'triangle', vol * 1.3);
  playTone(200, 0.05, 'sine', vol * 0.8, 0.01);
}

/** Cute ball-on-ball clack with pleasant pitch variation */
export function sfxBallClack(speed = 1) {
  const vol = Math.min(0.04 + speed * 0.02, 0.16);
  const randomPitch = 600 + Math.random() * 300;
  playTone(randomPitch, 0.05, 'triangle', vol);
  playTone(randomPitch * 1.5, 0.03, 'sine', vol * 0.6);
  playNoise(0.03, vol * 0.5);
}

/** Ball bounces off the wooden cushion rail */
export function sfxCushion() {
  playTone(180, 0.08, 'sine', 0.08);
  playNoise(0.04, 0.04);
}

/** Ball drops into a pocket — cheerful chime + heart drop sound */
export function sfxPocket() {
  playTone(587.33, 0.15, 'sine', 0.12); // D5
  playTone(880, 0.2, 'sine', 0.14, 0.06); // A5
  playTone(1174.66, 0.25, 'sine', 0.1, 0.12); // D6
}

/** Victory celebratory jingle */
export function sfxVictory() {
  const melody = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
  melody.forEach((freq, i) => {
    playTone(freq, 0.22, 'sine', 0.12, i * 0.12);
    playTone(freq * 1.5, 0.2, 'triangle', 0.05, i * 0.12);
  });
  playTone(1318.51, 0.4, 'sine', 0.1, 0.5);
}

/** UI button click */
export function sfxClick() {
  playTone(900, 0.04, 'sine', 0.08);
}
