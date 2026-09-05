// =============================================
//  AUTHENTIC 8-BALL POOL AUDIO ENGINE
//  Procedural physical acoustics with Web Audio API
//  + Sparkling Kawaii Combos & Celebrations
// =============================================

let audioCtx = null;
let masterGain = null;
let compressor = null;

function getAudioChain() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && !masterGain) {
    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.85, audioCtx.currentTime);

    // Dynamic limiter to ensure crisp punch without clipping on heavy breaks
    compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-6, audioCtx.currentTime);
    compressor.knee.setValueAtTime(10, audioCtx.currentTime);
    compressor.ratio.setValueAtTime(4, audioCtx.currentTime);
    compressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
    compressor.release.setValueAtTime(0.12, audioCtx.currentTime);

    masterGain.connect(compressor);
    compressor.connect(audioCtx.destination);
  }
  return { ctx: audioCtx, master: masterGain };
}

function unlockAudio() {
  const { ctx } = getAudioChain();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume();
  }
}

if (typeof window !== 'undefined') {
  ['mousedown', 'pointerdown', 'touchstart', 'keydown'].forEach(evt => {
    window.addEventListener(evt, unlockAudio, { once: true, passive: true });
  });
}

// =============================================
//  AUTHENTIC 8-BALL PHYSICAL SOUNDS
// =============================================

/**
 * Solid wooden cue strike with tip chalk friction bite
 * - 1. High-frequency chalk snap / leather tip bite (bandpass noise at 3400Hz)
 * - 2. Rapid wooden cue shaft impulse (340Hz -> 120Hz triangle)
 * - 3. Deep ball contact thud (170Hz -> 65Hz sine)
 */
export function sfxCueHit(power = 0.5) {
  const { ctx, master } = getAudioChain();
  if (!ctx || !master) return;
  if (ctx.state === 'suspended') ctx.resume();

  const p = Math.max(0.1, Math.min(1.0, power));
  const t = ctx.currentTime;

  // 1. Chalk friction bite (bandpass white noise, ~22ms)
  const noiseDur = 0.022;
  const bufferSize = Math.floor(ctx.sampleRate * noiseDur);
  const noiseBuf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
  }
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuf;

  const chalkFilter = ctx.createBiquadFilter();
  chalkFilter.type = 'bandpass';
  chalkFilter.frequency.setValueAtTime(3400, t);
  chalkFilter.Q.setValueAtTime(2.4, t);

  const chalkGain = ctx.createGain();
  const chalkVol = 0.12 + p * 0.18;
  chalkGain.gain.setValueAtTime(chalkVol, t);
  chalkGain.gain.exponentialRampToValueAtTime(0.001, t + noiseDur);

  noiseSrc.connect(chalkFilter);
  chalkFilter.connect(chalkGain);
  chalkGain.connect(master);
  noiseSrc.start(t);

  // 2. Wooden shaft flex impulse (triangle sweep, ~45ms)
  const woodOsc = ctx.createOscillator();
  const woodGain = ctx.createGain();
  woodOsc.type = 'triangle';
  const startPitch = 320 + p * 120;
  woodOsc.frequency.setValueAtTime(startPitch, t);
  woodOsc.frequency.exponentialRampToValueAtTime(110, t + 0.045);

  const woodVol = 0.20 + p * 0.35;
  woodGain.gain.setValueAtTime(woodVol, t);
  woodGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

  woodOsc.connect(woodGain);
  woodGain.connect(master);
  woodOsc.start(t);
  woodOsc.stop(t + 0.055);

  // 3. Solid ball impact body (sine thump, ~60ms)
  const thudOsc = ctx.createOscillator();
  const thudGain = ctx.createGain();
  thudOsc.type = 'sine';
  thudOsc.frequency.setValueAtTime(180 + p * 50, t);
  thudOsc.frequency.exponentialRampToValueAtTime(65, t + 0.06);

  const thudVol = 0.18 + p * 0.32;
  thudGain.gain.setValueAtTime(thudVol, t);
  thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.065);

  thudOsc.connect(thudGain);
  thudGain.connect(master);
  thudOsc.start(t);
  thudOsc.stop(t + 0.07);
}

/**
 * Iconic Phenolic Resin Billiard Ball Clack
 * High-Q acoustic ring + sharp contact transient + organic micro-pitch variation
 */
export function sfxBallClack(speed = 1) {
  const { ctx, master } = getAudioChain();
  if (!ctx || !master) return;
  if (ctx.state === 'suspended') ctx.resume();

  // Normalize speed
  const s = Math.min(1.5, Math.max(0.15, (typeof speed === 'number' ? speed : 1) / 3));
  const t = ctx.currentTime;

  // Organic micro-pitch detuning (+/- 3.5%) so rapid breaks sound like real balls
  const pitchVar = 1 + (Math.random() - 0.5) * 0.07;
  const baseResinFreq = (2550 + (Math.random() - 0.5) * 200) * pitchVar;

  // 1. Ultra-fast contact click (12ms highpass noise)
  const clickDur = 0.012;
  const clickBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * clickDur), ctx.sampleRate);
  const clickData = clickBuf.getChannelData(0);
  for (let i = 0; i < clickData.length; i++) {
    clickData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (clickData.length * 0.25));
  }
  const clickSrc = ctx.createBufferSource();
  clickSrc.buffer = clickBuf;

  const clickFilter = ctx.createBiquadFilter();
  clickFilter.type = 'highpass';
  clickFilter.frequency.setValueAtTime(3200, t);

  const clickGain = ctx.createGain();
  const clickVol = Math.min(0.28, 0.06 + s * 0.16);
  clickGain.gain.setValueAtTime(clickVol, t);
  clickGain.gain.exponentialRampToValueAtTime(0.001, t + clickDur);

  clickSrc.connect(clickFilter);
  clickFilter.connect(clickGain);
  clickGain.connect(master);
  clickSrc.start(t);

  // 2. High-Q Phenolic Ring (characteristic Aramith acoustic clack, 32ms)
  const ringOsc = ctx.createOscillator();
  const ringGain = ctx.createGain();
  ringOsc.type = 'sine';
  ringOsc.frequency.setValueAtTime(baseResinFreq, t);
  ringOsc.frequency.exponentialRampToValueAtTime(baseResinFreq * 0.88, t + 0.032);

  const ringVol = Math.min(0.38, 0.08 + s * 0.22);
  ringGain.gain.setValueAtTime(ringVol, t);
  ringGain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);

  ringOsc.connect(ringGain);
  ringGain.connect(master);
  ringOsc.start(t);
  ringOsc.stop(t + 0.04);

  // 3. Dense resin body thump (triangle, 980Hz -> 680Hz, 24ms)
  const bodyOsc = ctx.createOscillator();
  const bodyGain = ctx.createGain();
  bodyOsc.type = 'triangle';
  bodyOsc.frequency.setValueAtTime(980 * pitchVar, t);
  bodyOsc.frequency.exponentialRampToValueAtTime(680, t + 0.024);

  const bodyVol = Math.min(0.25, 0.05 + s * 0.15);
  bodyGain.gain.setValueAtTime(bodyVol, t);
  bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.028);

  bodyOsc.connect(bodyGain);
  bodyGain.connect(master);
  bodyOsc.start(t);
  bodyOsc.stop(t + 0.032);
}

/**
 * Wool Baize Rubber Cushion Bump
 * Heavy damped rubber rail rebound with zero high-frequency click
 */
export function sfxCushion(speed = 1) {
  const { ctx, master } = getAudioChain();
  if (!ctx || !master) return;
  if (ctx.state === 'suspended') ctx.resume();

  const s = Math.min(1.4, Math.max(0.3, (typeof speed === 'number' ? speed : 1) / 4));
  const t = ctx.currentTime;

  // 1. Wool baize cloth friction (lowpass noise, ~35ms)
  const clothDur = 0.035;
  const clothBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * clothDur), ctx.sampleRate);
  const clothData = clothBuf.getChannelData(0);
  for (let i = 0; i < clothData.length; i++) {
    clothData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (clothData.length * 0.35));
  }
  const clothSrc = ctx.createBufferSource();
  clothSrc.buffer = clothBuf;

  const clothFilter = ctx.createBiquadFilter();
  clothFilter.type = 'lowpass';
  clothFilter.frequency.setValueAtTime(380, t);

  const clothGain = ctx.createGain();
  const clothVol = Math.min(0.14, 0.04 + s * 0.08);
  clothGain.gain.setValueAtTime(clothVol, t);
  clothGain.gain.exponentialRampToValueAtTime(0.001, t + clothDur);

  clothSrc.connect(clothFilter);
  clothFilter.connect(clothGain);
  clothGain.connect(master);
  clothSrc.start(t);

  // 2. Vulcanized rubber cushion rebound (damped 135Hz -> 58Hz sine, ~65ms)
  const rubberOsc = ctx.createOscillator();
  const rubberGain = ctx.createGain();
  rubberOsc.type = 'sine';
  rubberOsc.frequency.setValueAtTime(135, t);
  rubberOsc.frequency.exponentialRampToValueAtTime(58, t + 0.065);

  const rubberVol = Math.min(0.32, 0.10 + s * 0.18);
  rubberGain.gain.setValueAtTime(rubberVol, t);
  rubberGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

  rubberOsc.connect(rubberGain);
  rubberGain.connect(master);
  rubberOsc.start(t);
  rubberOsc.stop(t + 0.075);
}

/**
 * Authentic Leather Pocket Drop & Gulley Roll
 * 1. Initial deep leather cup drop thud (210Hz -> 75Hz)
 * 2. Hollow gulley rail clunk 50ms later (145Hz -> 58Hz)
 */
export function sfxPocket() {
  const { ctx, master } = getAudioChain();
  if (!ctx || !master) return;
  if (ctx.state === 'suspended') ctx.resume();

  const t = ctx.currentTime;

  // 1. Pocket Drop Thump (leather pocket cup)
  const dropOsc = ctx.createOscillator();
  const dropGain = ctx.createGain();
  dropOsc.type = 'triangle';
  dropOsc.frequency.setValueAtTime(210, t);
  dropOsc.frequency.exponentialRampToValueAtTime(75, t + 0.08);

  dropGain.gain.setValueAtTime(0.35, t);
  dropGain.gain.exponentialRampToValueAtTime(0.001, t + 0.085);

  dropOsc.connect(dropGain);
  dropGain.connect(master);
  dropOsc.start(t);
  dropOsc.stop(t + 0.09);

  // 2. Hollow gulley rail clunk (+52ms delay)
  const rollTime = t + 0.052;
  const rollOsc = ctx.createOscillator();
  const rollGain = ctx.createGain();
  rollOsc.type = 'sine';
  rollOsc.frequency.setValueAtTime(145, rollTime);
  rollOsc.frequency.exponentialRampToValueAtTime(58, rollTime + 0.11);

  rollGain.gain.setValueAtTime(0.24, rollTime);
  rollGain.gain.exponentialRampToValueAtTime(0.001, rollTime + 0.12);

  rollOsc.connect(rollGain);
  rollGain.connect(master);
  rollOsc.start(rollTime);
  rollOsc.stop(rollTime + 0.13);
}

/**
 * Scratch / Foul sound when cue ball is accidentally pocketed
 * Muffled descending wah tone
 */
export function sfxScratch() {
  const { ctx, master } = getAudioChain();
  if (!ctx || !master) return;
  if (ctx.state === 'suspended') ctx.resume();

  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = 'sawtooth';
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(500, t);
  filter.frequency.exponentialRampToValueAtTime(140, t + 0.28);

  osc.frequency.setValueAtTime(260, t);
  osc.frequency.exponentialRampToValueAtTime(90, t + 0.28);

  gain.gain.setValueAtTime(0.22, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.30);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  osc.start(t);
  osc.stop(t + 0.32);
}

// =============================================
//  KAWAII COMBOS & CELEBRATIONS
// =============================================

/**
 * Sparkling Kawaii Celesta & Fairy Chimes
 * Played when making double/triple pockets or scoring consecutive streaks
 */
export function sfxKawaiiCombo(comboCount = 2) {
  const { ctx, master } = getAudioChain();
  if (!ctx || !master) return;
  if (ctx.state === 'suspended') ctx.resume();

  const t = ctx.currentTime;
  const level = Math.min(5, Math.max(2, comboCount));

  // Celestial Pentatonic Scale: C6, D6, E6, G6, A6, C7, E7
  const PENTATONIC = [1046.50, 1174.66, 1318.51, 1567.98, 1760.00, 2093.00, 2637.02];

  let notes = [];
  if (level === 2) {
    // 3 ascending sweet chimes (E6, A6, C7)
    notes = [PENTATONIC[2], PENTATONIC[4], PENTATONIC[5]];
  } else if (level === 3) {
    // 4 sparkling chimes (C6, E6, G6, C7)
    notes = [PENTATONIC[0], PENTATONIC[2], PENTATONIC[3], PENTATONIC[5]];
  } else {
    // 5 full fairy chimes (C6, E6, G6, A6, E7)
    notes = [PENTATONIC[0], PENTATONIC[2], PENTATONIC[3], PENTATONIC[4], PENTATONIC[6]];
  }

  // Play sparkling chime arpeggio
  notes.forEach((freq, idx) => {
    const noteTime = t + idx * 0.058;

    // Harmonic 1: pure ringing sine
    const sineOsc = ctx.createOscillator();
    const sineGain = ctx.createGain();
    sineOsc.type = 'sine';
    sineOsc.frequency.setValueAtTime(freq, noteTime);

    const noteVol = 0.16 + (idx / notes.length) * 0.08;
    sineGain.gain.setValueAtTime(noteVol, noteTime);
    sineGain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.35);

    sineOsc.connect(sineGain);
    sineGain.connect(master);
    sineOsc.start(noteTime);
    sineOsc.stop(noteTime + 0.38);

    // Harmonic 2: soft triangle sparkle overtone (octave higher)
    const triOsc = ctx.createOscillator();
    const triGain = ctx.createGain();
    triOsc.type = 'triangle';
    triOsc.frequency.setValueAtTime(freq * 1.5, noteTime);

    triGain.gain.setValueAtTime(noteVol * 0.35, noteTime);
    triGain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.20);

    triOsc.connect(triGain);
    triGain.connect(master);
    triOsc.start(noteTime);
    triOsc.stop(noteTime + 0.22);
  });

  // Extra fairy sparkle dust for level 3+
  if (level >= 3) {
    const sparkleTime = t + notes.length * 0.055;
    [3600, 4800, 5600].forEach((sFreq, sIdx) => {
      const spOsc = ctx.createOscillator();
      const spGain = ctx.createGain();
      spOsc.type = 'sine';
      const st = sparkleTime + sIdx * 0.035;
      spOsc.frequency.setValueAtTime(sFreq, st);

      spGain.gain.setValueAtTime(0.08, st);
      spGain.gain.exponentialRampToValueAtTime(0.001, st + 0.16);

      spOsc.connect(spGain);
      spGain.connect(master);
      spOsc.start(st);
      spOsc.stop(st + 0.18);
    });
  }
}

/** Kawaii victory fanfare */
export function sfxVictory() {
  const { ctx, master } = getAudioChain();
  if (!ctx || !master) return;
  if (ctx.state === 'suspended') ctx.resume();

  const t = ctx.currentTime;
  const fanfare = [
    { freq: 523.25, time: 0.00, dur: 0.14 }, // C5
    { freq: 659.25, time: 0.14, dur: 0.14 }, // E5
    { freq: 783.99, time: 0.28, dur: 0.14 }, // G5
    { freq: 1046.50, time: 0.42, dur: 0.45 }, // C6
    { freq: 1318.51, time: 0.50, dur: 0.50 }  // E6 (shimmer)
  ];

  fanfare.forEach(note => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(note.freq, t + note.time);

    gain.gain.setValueAtTime(0.25, t + note.time);
    gain.gain.exponentialRampToValueAtTime(0.001, t + note.time + note.dur);

    osc.connect(gain);
    gain.connect(master);
    osc.start(t + note.time);
    osc.stop(t + note.time + note.dur + 0.02);
  });

  if (window.DopamineJuice && window.DopamineJuice.explodeConfetti) {
    window.DopamineJuice.explodeConfetti(window.innerWidth / 2, window.innerHeight * 0.4, 75);
  }
}

/** Crisp UI button tap */
export function sfxClick() {
  const { ctx, master } = getAudioChain();
  if (!ctx || !master) return;
  if (ctx.state === 'suspended') ctx.resume();

  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, t);
  osc.frequency.exponentialRampToValueAtTime(440, t + 0.035);

  gain.gain.setValueAtTime(0.12, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

  osc.connect(gain);
  gain.connect(master);
  osc.start(t);
  osc.stop(t + 0.045);
}
