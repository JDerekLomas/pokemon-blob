// Tiny synth — pentatonic notes per fruit so any sequence sounds musical.
// Pure Web Audio: no assets, works offline, ~0kb.

let ctx = null;
let masterGain = null;
let unlocked = false;

export function initAudio() {
  if (ctx) return ctx;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.5;
  masterGain.connect(ctx.destination);
  return ctx;
}

export function unlockAudio() {
  if (!ctx) initAudio();
  if (ctx.state === 'suspended') ctx.resume();
  if (!unlocked) {
    // tiny silent blip primes iOS
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    o.connect(g).connect(masterGain);
    o.start();
    o.stop(ctx.currentTime + 0.01);
    unlocked = true;
  }
}

// C major pentatonic — every combination sounds happy
const NOTES = {
  C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.00, A4: 440.00,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.00,
  C6: 1046.50, E6: 1318.51, G6: 1567.98,
};

// fruit -> note
const FRUIT_NOTES = {
  strawberry: NOTES.E5,
  blueberry:  NOTES.C5,
  orange:     NOTES.G5,
  grape:      NOTES.A5,
};

function envTone({ freq, type = 'triangle', attack = 0.005, decay = 0.25, sustain = 0, release = 0.15, vol = 0.35, detune = 0, pan = 0 }) {
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(vol, now + attack);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain * vol + 0.0001), now + attack + decay);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay + release);

  let last = gain;
  if (pan !== 0 && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    gain.connect(p);
    last = p;
  }
  last.connect(masterGain);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + attack + decay + release + 0.05);
}

function noiseBurst({ vol = 0.2, duration = 0.08, lowpass = 1200 } = {}) {
  if (!ctx) return;
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = lowpass;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(lp).connect(g).connect(masterGain);
  src.start();
}

// ---------- public API ----------

export function playToss(fruit) {
  unlockAudio();
  const freq = FRUIT_NOTES[fruit] || NOTES.C5;
  // a bright bell-y pluck with shimmer
  envTone({ freq, type: 'triangle', attack: 0.004, decay: 0.18, release: 0.2, vol: 0.4 });
  envTone({ freq: freq * 2, type: 'sine', attack: 0.003, decay: 0.12, release: 0.15, vol: 0.12 });
}

export function playBlockToss() {
  unlockAudio();
  // wooden knock
  envTone({ freq: 180, type: 'square', attack: 0.002, decay: 0.06, release: 0.05, vol: 0.18 });
  noiseBurst({ vol: 0.15, duration: 0.05, lowpass: 800 });
}

export function playEat(fruit) {
  unlockAudio();
  // happy arpeggio: C-E-G-C (major) in fruit's "key"
  const base = FRUIT_NOTES[fruit] || NOTES.C5;
  const intervals = [1, 5 / 4, 3 / 2, 2]; // major chord
  intervals.forEach((mult, i) => {
    setTimeout(() => {
      envTone({
        freq: base * mult,
        type: 'triangle',
        attack: 0.003, decay: 0.14, release: 0.18,
        vol: 0.3,
      });
      envTone({
        freq: base * mult * 2,
        type: 'sine',
        attack: 0.003, decay: 0.1, release: 0.12,
        vol: 0.08,
      });
    }, i * 70);
  });
  // little munch noise at the start
  noiseBurst({ vol: 0.08, duration: 0.06, lowpass: 2000 });
}

export function playBounce(strength = 1) {
  if (!ctx) return;
  // muted soft "tup" — pitch varies with strength
  const freq = 240 + strength * 120;
  envTone({ freq, type: 'sine', attack: 0.002, decay: 0.05, release: 0.04, vol: Math.min(0.15, 0.05 + strength * 0.06) });
}

export function playThud(strength = 1) {
  if (!ctx) return;
  envTone({ freq: 90, type: 'square', attack: 0.001, decay: 0.07, release: 0.05, vol: Math.min(0.25, 0.08 + strength * 0.1) });
  noiseBurst({ vol: Math.min(0.2, 0.05 + strength * 0.08), duration: 0.06, lowpass: 500 });
}

export function playHappy() {
  unlockAudio();
  // C-E-G-C ascending sparkle
  const notes = [NOTES.C5, NOTES.E5, NOTES.G5, NOTES.C6];
  notes.forEach((f, i) => {
    setTimeout(() => {
      envTone({ freq: f, type: 'triangle', attack: 0.003, decay: 0.18, release: 0.2, vol: 0.3 });
      envTone({ freq: f * 2, type: 'sine', attack: 0.003, decay: 0.12, release: 0.15, vol: 0.08 });
    }, i * 90);
  });
}

// ---------- xylophone block hits ----------
// Each block has a colour-mapped note; tower crashes become a tune.
export function playBlockHit(noteHz, strength = 1) {
  if (!ctx) return;
  const vol = Math.min(0.4, 0.08 + strength * 0.18);
  // bell-like fundamental + octave harmonic + sparkle
  envTone({ freq: noteHz,     type: 'sine', attack: 0.001, decay: 0.22, release: 0.28, vol });
  envTone({ freq: noteHz * 2, type: 'sine', attack: 0.001, decay: 0.14, release: 0.2,  vol: vol * 0.4 });
  envTone({ freq: noteHz * 3, type: 'sine', attack: 0.001, decay: 0.07, release: 0.08, vol: vol * 0.12 });
  // tiny wooden body
  noiseBurst({ vol: Math.min(0.09, 0.03 + strength * 0.04), duration: 0.04, lowpass: 700 });
}

// Note name -> Hz, used by main.js for colour mapping
export const NOTE_HZ = NOTES;

// ---------- background music loop ----------
// 16-step pattern, music-box bells. Schedules ahead via look-ahead pattern.
let musicGain = null;
let musicTimer = null;
let musicStep = 0;
let nextStepTime = 0;
const STEP_DUR = 0.3;            // seconds per 8th note (~100 BPM)
const PATTERN_LEN = 16;          // 2 bars of 4/4

const MELODY = [
  { step: 0,  note: NOTES.C5 }, { step: 2,  note: NOTES.E5 },
  { step: 4,  note: NOTES.G5 }, { step: 6,  note: NOTES.E5 },
  { step: 8,  note: NOTES.A4 }, { step: 10, note: NOTES.C5 },
  { step: 12, note: NOTES.G4 }, { step: 14, note: NOTES.E5 },
];
const BASS = [
  { step: 0, note: NOTES.C4 },
  { step: 8, note: NOTES.A4 / 2 }, // A3
];
const SPARKLE = [
  { step: 7,  note: NOTES.C6 },
  { step: 15, note: NOTES.E6 },
];

function scheduleAt(time, freq, vol, type, decay) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(vol, time + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);
  osc.connect(gain).connect(musicGain);
  osc.start(time);
  osc.stop(time + decay + 0.05);
}

function scheduleStep(s, time) {
  for (const m of MELODY) if (m.step === s) {
    scheduleAt(time, m.note, 0.18, 'triangle', 0.55);
    scheduleAt(time, m.note * 2, 0.05, 'sine', 0.35);
  }
  for (const b of BASS) if (b.step === s) {
    scheduleAt(time, b.note, 0.22, 'sine', 1.0);
  }
  for (const sp of SPARKLE) if (sp.step === s) {
    scheduleAt(time, sp.note, 0.07, 'sine', 0.3);
  }
}

function musicTick() {
  while (nextStepTime < ctx.currentTime + 0.2) {
    scheduleStep(musicStep, nextStepTime);
    nextStepTime += STEP_DUR;
    musicStep = (musicStep + 1) % PATTERN_LEN;
  }
  musicTimer = setTimeout(musicTick, 80);
}

export function startMusic() {
  if (!ctx) initAudio();
  unlockAudio();
  if (musicTimer) return;
  if (!musicGain) {
    musicGain = ctx.createGain();
    musicGain.gain.value = 0;
    musicGain.connect(masterGain);
  }
  // fade in
  musicGain.gain.cancelScheduledValues(ctx.currentTime);
  musicGain.gain.setTargetAtTime(0.22, ctx.currentTime, 0.6);
  musicStep = 0;
  nextStepTime = ctx.currentTime + 0.12;
  musicTick();
}

export function stopMusic() {
  if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; }
  if (musicGain) musicGain.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
}

// ---------- blob hum (persistent oscillator) ----------
let humOsc1, humOsc2, humGain, humLP, humLFO, humLFOGain;
let humReady = false;

function ensureHum() {
  if (humReady || !ctx) return;
  humReady = true;
  humOsc1 = ctx.createOscillator();
  humOsc1.type = 'triangle';
  humOsc1.frequency.value = 260;
  humOsc2 = ctx.createOscillator();
  humOsc2.type = 'sine';
  humOsc2.frequency.value = 260;
  humOsc2.detune.value = 12;

  humLP = ctx.createBiquadFilter();
  humLP.type = 'lowpass';
  humLP.frequency.value = 900;

  humGain = ctx.createGain();
  humGain.gain.value = 0;

  humOsc1.connect(humGain);
  humOsc2.connect(humGain);
  humGain.connect(humLP).connect(masterGain);

  // vibrato LFO
  humLFO = ctx.createOscillator();
  humLFO.frequency.value = 5.5;
  humLFOGain = ctx.createGain();
  humLFOGain.gain.value = 6;
  humLFO.connect(humLFOGain);
  humLFOGain.connect(humOsc1.frequency);
  humLFOGain.connect(humOsc2.frequency);

  humOsc1.start();
  humOsc2.start();
  humLFO.start();
}

export function setBlobHum(level) {
  ensureHum();
  if (!humGain || !ctx) return;
  const clamped = Math.max(0, Math.min(1, level));
  humGain.gain.setTargetAtTime(clamped * 0.06, ctx.currentTime, 0.12);
}

export function setBlobHumPitch(hz) {
  ensureHum();
  if (!humOsc1 || !ctx) return;
  humOsc1.frequency.setTargetAtTime(hz, ctx.currentTime, 0.15);
  humOsc2.frequency.setTargetAtTime(hz, ctx.currentTime, 0.15);
}

// ---------- evolve fanfare ----------
export function playEvolve() {
  unlockAudio();
  // ascending sweep + triumphant chord
  const sweep = [NOTES.C5, NOTES.D5, NOTES.E5, NOTES.G5, NOTES.A5, NOTES.C6];
  sweep.forEach((f, i) => {
    setTimeout(() => {
      envTone({ freq: f, type: 'triangle', attack: 0.003, decay: 0.18, release: 0.2, vol: 0.32 });
      envTone({ freq: f * 2, type: 'sine', attack: 0.003, decay: 0.12, release: 0.15, vol: 0.1 });
    }, i * 70);
  });
  // big chord at the end
  setTimeout(() => {
    [NOTES.C5, NOTES.E5, NOTES.G5, NOTES.C6, NOTES.E6].forEach(f => {
      envTone({ freq: f, type: 'triangle', attack: 0.005, decay: 0.4, release: 0.6, vol: 0.22 });
      envTone({ freq: f * 2, type: 'sine', attack: 0.005, decay: 0.3, release: 0.5, vol: 0.07 });
    });
  }, sweep.length * 70 + 50);
}

// ---------- battle sounds ----------
export function playAttack(power = 1) {
  unlockAudio();
  // whoosh + impact
  noiseBurst({ vol: 0.15, duration: 0.15, lowpass: 2000 });
  setTimeout(() => {
    envTone({ freq: 110 + power * 60, type: 'square', attack: 0.001, decay: 0.1, release: 0.08, vol: 0.3 });
    noiseBurst({ vol: 0.25, duration: 0.1, lowpass: 600 });
  }, 120);
}

export function playFoeAttack() {
  unlockAudio();
  // ominous descending
  const notes = [NOTES.A4, NOTES.G4, NOTES.E4];
  notes.forEach((f, i) => {
    setTimeout(() => {
      envTone({ freq: f, type: 'sawtooth', attack: 0.005, decay: 0.18, release: 0.15, vol: 0.2 });
    }, i * 80);
  });
  setTimeout(() => noiseBurst({ vol: 0.2, duration: 0.12, lowpass: 800 }), 260);
}

export function playVictory() {
  unlockAudio();
  // bigger fanfare than evolve
  const a = [NOTES.C5, NOTES.E5, NOTES.G5, NOTES.C6, NOTES.G5, NOTES.C6, NOTES.E6, NOTES.G6];
  a.forEach((f, i) => {
    setTimeout(() => {
      envTone({ freq: f, type: 'triangle', attack: 0.003, decay: 0.2, release: 0.25, vol: 0.3 });
      envTone({ freq: f * 2, type: 'sine', attack: 0.003, decay: 0.15, release: 0.18, vol: 0.1 });
    }, i * 100);
  });
}

export function playDefeat() {
  unlockAudio();
  const a = [NOTES.E5, NOTES.D5, NOTES.C5, NOTES.A4];
  a.forEach((f, i) => {
    setTimeout(() => {
      envTone({ freq: f, type: 'triangle', attack: 0.005, decay: 0.3, release: 0.3, vol: 0.25 });
    }, i * 200);
  });
}
