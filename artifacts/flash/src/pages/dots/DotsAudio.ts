let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, duration: number, gain = 0.3, type: OscillatorType = "sine") {
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.connect(g);
    g.connect(c.destination);
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + duration);
  } catch {
    // ignore
  }
}

export const DotsAudio = {
  claim() {
    tone(880, 0.12, 0.35);
    setTimeout(() => tone(1200, 0.18, 0.25), 80);
  },
  searchMiss() {
    tone(200, 0.25, 0.2, "sawtooth");
  },
  caught() {
    tone(440, 0.08, 0.5);
    setTimeout(() => tone(330, 0.08, 0.5), 90);
    setTimeout(() => tone(220, 0.35, 0.5), 180);
  },
  timerWarn() {
    tone(440, 0.08, 0.25, "square");
  },
  move() {
    tone(300, 0.06, 0.08);
  },
  victory() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => tone(f, 0.18, 0.35), i * 110);
    });
  },
  switchSides() {
    [220, 330, 440, 660, 880].forEach((f, i) => {
      setTimeout(() => tone(f, 0.15, 0.4, "square"), i * 80);
    });
  },
};
