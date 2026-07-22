"use client";

// Placeholder sound layer: synthesized tones via the Web Audio API so the
// tap/reaction sound hookup can be tested end-to-end without real audio
// assets yet. Swap these for real sample playback later — the call sites
// (playTapSound/playReactionSound/playFinaleSound) won't need to change.
let sharedContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedContext) sharedContext = new Ctor();
  if (sharedContext.state === "suspended") void sharedContext.resume();
  return sharedContext;
}

function playTone(frequency: number, durationMs: number, type: OscillatorType, gain: number) {
  const ctx = getContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gainNode.gain.value = gain;
  gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + durationMs / 1000);
}

// One "random" click per tap — frequency jitters so repeated hits don't
// sound identical, standing in for a real sample bank per the user's own
// "any random sounds are fine for testing" instruction.
export function playTapSound() {
  playTone(320 + Math.random() * 260, 90, "square", 0.05);
}

// A distinct, lower/longer tone for the character's reaction (heat-stage
// change) so it reads as audibly separate from the tap click itself.
export function playReactionSound() {
  playTone(180 + Math.random() * 60, 260, "sine", 0.09);
}

// Two-note finale sting when a round completes.
export function playFinaleSound() {
  playTone(520, 150, "triangle", 0.08);
  setTimeout(() => playTone(760, 220, "triangle", 0.08), 120);
}
