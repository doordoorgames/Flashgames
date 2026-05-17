class BombSoundSystem {
  private ctx: AudioContext | null = null;
  muted = false;
  private tickHandle: number | null = null;
  private currentTickStage = -1;

  private get audio(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  private tone(freq: number, dur: number, type: OscillatorType = "square", vol = 0.22) {
    if (this.muted) return;
    try {
      const ctx = this.audio;
      if (ctx.state === "suspended") void ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch { /* Safari / blocked */ }
  }

  private noise(dur: number, vol = 0.5) {
    if (this.muted) return;
    try {
      const ctx = this.audio;
      if (ctx.state === "suspended") void ctx.resume();
      const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    } catch { /* */ }
  }

  tick() {
    this.tone(660, 0.055, "square", 0.14);
  }

  warnBeep() {
    this.tone(880, 0.07, "square", 0.22);
  }

  critBeep() {
    this.tone(1100, 0.06, "square", 0.28);
    setTimeout(() => this.tone(1100, 0.06, "square", 0.28), 80);
  }

  correctInput() {
    this.tone(660, 0.07, "square", 0.22);
    setTimeout(() => this.tone(990, 0.09, "square", 0.18), 65);
  }

  wrongInput() {
    this.tone(110, 0.22, "sawtooth", 0.45);
    setTimeout(() => this.tone(90, 0.18, "sawtooth", 0.35), 100);
  }

  transferSuccess() {
    [440, 554, 660, 880].forEach((f, i) =>
      setTimeout(() => this.tone(f, 0.13, "square", 0.2), i * 55)
    );
  }

  roundStart() {
    [440, 550, 660, 880].forEach((f, i) =>
      setTimeout(() => this.tone(f, 0.1, "square", 0.18), i * 70)
    );
  }

  explosion() {
    this.noise(0.7, 0.65);
    this.tone(80, 0.5, "sawtooth", 0.5);
    setTimeout(() => this.noise(0.4, 0.4), 200);
  }

  setTickStage(stage: 0 | 1 | 2) {
    if (stage === this.currentTickStage) return;
    this.currentTickStage = stage;
    this.stopTicking();
    if (stage === 0) return;
    const intervals = [0, 800, 280] as const;
    const ms = intervals[stage];
    const doTick = () => {
      if (stage === 2) this.critBeep(); else this.warnBeep();
    };
    doTick();
    this.tickHandle = window.setInterval(doTick, ms);
  }

  countryCorrect() {
    // Sonar/radar confirmation ping
    this.tone(880, 0.06, "sine", 0.22);
    setTimeout(() => this.tone(1100, 0.08, "sine", 0.20), 80);
    setTimeout(() => this.tone(1320, 0.12, "sine", 0.18), 170);
    setTimeout(() => this.tone(1760, 0.18, "sine", 0.15), 280);
  }

  countryWrong() {
    // Alarm siren: descending wail + static
    this.tone(900, 0.12, "sawtooth", 0.42);
    setTimeout(() => this.tone(700, 0.12, "sawtooth", 0.42), 120);
    setTimeout(() => this.tone(500, 0.14, "sawtooth", 0.45), 240);
    setTimeout(() => this.noise(0.18, 0.38), 360);
    setTimeout(() => this.tone(350, 0.12, "sawtooth", 0.4), 400);
  }

  wireSlice() {
    // Rising satisfying cut: high-pitched slice sweep
    this.tone(600, 0.04, "square", 0.18);
    setTimeout(() => this.tone(900, 0.05, "square", 0.20), 40);
    setTimeout(() => this.tone(1320, 0.07, "square", 0.22), 80);
    setTimeout(() => this.tone(1760, 0.12, "square", 0.18), 120);
    setTimeout(() => this.tone(2200, 0.10, "sine", 0.15), 180);
  }

  wireWrong() {
    // Harsh alarm buzz + double stab
    this.tone(120, 0.3, "sawtooth", 0.5);
    setTimeout(() => this.noise(0.15, 0.4), 40);
    setTimeout(() => this.tone(100, 0.2, "sawtooth", 0.45), 180);
    setTimeout(() => this.noise(0.1, 0.3), 320);
  }

  flapClick() {
    this.noise(0.025, 0.28);
    this.tone(3200, 0.015, "square", 0.08);
  }

  memoryCorrect() {
    this.tone(440, 0.06, "square", 0.18);
    setTimeout(() => this.tone(660, 0.07, "square", 0.18), 60);
    setTimeout(() => this.tone(880, 0.08, "square", 0.20), 130);
    setTimeout(() => this.tone(1320, 0.14, "sine", 0.16), 220);
  }

  memoryWrong() {
    this.tone(200, 0.15, "sawtooth", 0.5);
    setTimeout(() => this.noise(0.12, 0.45), 60);
    setTimeout(() => this.tone(160, 0.2, "sawtooth", 0.45), 140);
    setTimeout(() => this.noise(0.1, 0.35), 300);
  }

  reactorClick() {
    this.noise(0.018, 0.22);
    this.tone(280, 0.04, "square", 0.14);
  }

  reactorCorrect() {
    this.tone(330, 0.09, "sine", 0.18);
    setTimeout(() => this.tone(440, 0.10, "sine", 0.20), 90);
    setTimeout(() => this.tone(554, 0.12, "sine", 0.18), 190);
    setTimeout(() => this.tone(660, 0.20, "sine", 0.15), 300);
  }

  reactorWrong() {
    this.tone(220, 0.18, "sawtooth", 0.5);
    setTimeout(() => this.noise(0.2, 0.5), 60);
    setTimeout(() => this.tone(180, 0.18, "sawtooth", 0.48), 200);
    setTimeout(() => this.noise(0.15, 0.4), 380);
    setTimeout(() => this.tone(140, 0.2, "sawtooth", 0.45), 520);
  }

  stopTicking() {
    if (this.tickHandle !== null) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
    this.currentTickStage = -1;
  }
}

export const bombSounds = new BombSoundSystem();
