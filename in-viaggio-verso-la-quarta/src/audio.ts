let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function unlockAudio() {
  audio();
}

function tone(
  frequency: number,
  start: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.08,
) {
  const c = audio();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, c.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + start + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(c.currentTime + start);
  osc.stop(c.currentTime + start + duration + 0.02);
}

export function playCorrect() {
  tone(523.25, 0, 0.22);
  tone(659.25, 0.09, 0.24);
  tone(783.99, 0.18, 0.38);
}

export function playWrong() {
  tone(220, 0, 0.16, "triangle", 0.05);
  tone(196, 0.14, 0.22, "triangle", 0.04);
}

export function playPop() {
  tone(392, 0, 0.08, "sine", 0.06);
  tone(784, 0.05, 0.18, "sine", 0.07);
}

export function playWhoosh() {
  const c = audio();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(180, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(620, c.currentTime + 1.1);
  gain.gain.setValueAtTime(0.05, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.3);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + 1.35);
}

export function playStar() {
  tone(880, 0, 0.16, "sine", 0.07);
  tone(1320, 0.08, 0.22, "sine", 0.05);
}

export function playFanfare() {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((n, i) => tone(n, i * 0.12, 0.4));
}
