"use client";

/**
 * Synthesized ambience + SFX engine for 「그림자 신전」.
 * No audio assets — everything is generated with the Web Audio API,
 * following the playCue pattern from TrigoSlash but with a persistent
 * context so a low drone can run underneath the whole escape.
 */

export type TempleSfx =
  | "click"
  | "clue"
  | "correct"
  | "wrong"
  | "door"
  | "dial"
  | "hint"
  | "fanfare"
  | "collapse"
  | "heartbeat";

type AC = AudioContext;

function getAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext ||
    null
  );
}

export class TempleAudio {
  private ctx: AC | null = null;
  private master: GainNode | null = null;
  private droneNodes: { stop: () => void } | null = null;
  private heartbeatTimer: number | null = null;
  private keepAliveTimer: number | null = null;
  private speakGen = 0;
  private muted = false;

  private ensureCtx(): AC | null {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return this.ctx;
    }
    const Ctor = getAudioContextCtor();
    if (!Ctor) return null;
    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
      return this.ctx;
    } catch {
      return null;
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) this.stopSpeak();
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(
        muted ? 0 : 1,
        this.ctx.currentTime,
        0.05,
      );
    }
  }

  /**
   * Call from a click so Chrome/Safari allow later speechSynthesis.speak().
   * Do not speak+cancel here — that consumes the gesture and drops narration.
   */
  unlockSpeech() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.resume();
      void window.speechSynthesis.getVoices();
    } catch {
      /* ignore */
    }
  }

  /** Korean TTS for story / puzzle prompts. Prefer calling from a user gesture. */
  speak(text: string) {
    const cleaned = sanitizeSpeechText(text);
    if (!cleaned) return;
    this.speakChunks(splitSpeechChunks(cleaned));
  }

  speakLines(lines: readonly string[]) {
    const chunks = lines
      .flatMap((line) => splitSpeechChunks(sanitizeSpeechText(line)))
      .filter(Boolean);
    if (chunks.length === 0) return;
    this.speakChunks(chunks);
  }

  private speakChunks(chunks: string[]) {
    if (typeof window === "undefined" || !window.speechSynthesis || this.muted) {
      return;
    }
    const synth = window.speechSynthesis;
    const gen = ++this.speakGen;
    try {
      synth.resume();
    } catch {
      /* ignore */
    }

    const enqueue = () => {
      if (this.muted || gen !== this.speakGen) return;
      try {
        for (const chunk of chunks) {
          const utter = new SpeechSynthesisUtterance(chunk);
          utter.rate = 1.02;
          utter.lang = "ko-KR";
          applyKoreanVoice(utter);
          synth.speak(utter);
        }
        this.startKeepAlive();
      } catch {
        /* ignore */
      }
    };

    const busy = synth.speaking || synth.pending;
    if (busy) {
      try {
        synth.cancel();
      } catch {
        /* ignore */
      }
      enqueue();
      // Chrome sometimes swallows speak() in the same turn as cancel().
      window.setTimeout(() => {
        if (this.muted || gen !== this.speakGen) return;
        if (!synth.speaking && !synth.pending) enqueue();
      }, 40);
      return;
    }
    enqueue();
  }

  private startKeepAlive() {
    this.stopKeepAlive();
    this.keepAliveTimer = window.setInterval(() => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        this.stopKeepAlive();
        return;
      }
      if (!window.speechSynthesis.speaking) {
        this.stopKeepAlive();
        return;
      }
      try {
        window.speechSynthesis.resume();
      } catch {
        /* ignore */
      }
    }, 4000);
  }

  private stopKeepAlive() {
    if (this.keepAliveTimer != null) {
      window.clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  stopSpeak() {
    this.speakGen += 1;
    this.stopKeepAlive();
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }

  /** Low two-oscillator drone + slow LFO shimmer — temple ambience. */
  startAmbience() {
    const ctx = this.ensureCtx();
    if (!ctx || !this.master || this.droneNodes) return;
    try {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 240;
      filter.connect(gain);
      gain.connect(this.master);

      const o1 = ctx.createOscillator();
      o1.type = "sawtooth";
      o1.frequency.value = 55;
      const o2 = ctx.createOscillator();
      o2.type = "sawtooth";
      o2.frequency.value = 58.3;
      const o3 = ctx.createOscillator();
      o3.type = "sine";
      o3.frequency.value = 110;
      const o3g = ctx.createGain();
      o3g.gain.value = 0.35;
      o3.connect(o3g);
      o3g.connect(filter);
      o1.connect(filter);
      o2.connect(filter);

      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 0.08;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.012;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);

      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.035, now + 2.5);

      o1.start(now);
      o2.start(now);
      o3.start(now);
      lfo.start(now);

      this.droneNodes = {
        stop: () => {
          try {
            const t = ctx.currentTime;
            gain.gain.setTargetAtTime(0, t, 0.4);
            window.setTimeout(() => {
              try {
                o1.stop();
                o2.stop();
                o3.stop();
                lfo.stop();
                gain.disconnect();
              } catch {
                /* already stopped */
              }
            }, 1200);
          } catch {
            /* ignore */
          }
        },
      };
    } catch {
      /* ignore */
    }
  }

  stopAmbience() {
    this.droneNodes?.stop();
    this.droneNodes = null;
  }

  /** Repeating low double-thump while the torch is nearly out. */
  startHeartbeat() {
    if (this.heartbeatTimer != null) return;
    const beat = () => {
      this.thump(0.09);
      window.setTimeout(() => this.thump(0.06), 220);
    };
    beat();
    this.heartbeatTimer = window.setInterval(beat, 1100);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer != null) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private thump(vol: number) {
    const ctx = this.ensureCtx();
    if (!ctx || !this.master) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(72, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.16);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.24);
    } catch {
      /* ignore */
    }
  }

  /** Filtered-noise rumble used for doors / collapse. */
  private rumble(duration: number, vol: number, freq = 130) {
    const ctx = this.ensureCtx();
    if (!ctx || !this.master) return;
    try {
      const now = ctx.currentTime;
      const len = Math.ceil(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(freq, now);
      filter.frequency.exponentialRampToValueAtTime(45, now + duration);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(now);
      src.stop(now + duration);
    } catch {
      /* ignore */
    }
  }

  private tone(
    opts: {
      type?: OscillatorType;
      freq: number | Array<[number, number]>;
      vol: number;
      dur: number;
      delay?: number;
    },
  ) {
    const ctx = this.ensureCtx();
    if (!ctx || !this.master) return;
    try {
      const start = ctx.currentTime + (opts.delay ?? 0);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = opts.type ?? "triangle";
      if (typeof opts.freq === "number") {
        osc.frequency.setValueAtTime(opts.freq, start);
      } else {
        for (const [f, at] of opts.freq) {
          osc.frequency.setValueAtTime(f, start + at);
        }
      }
      gain.gain.setValueAtTime(opts.vol, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + opts.dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(start);
      osc.stop(start + opts.dur + 0.02);
    } catch {
      /* ignore */
    }
  }

  play(kind: TempleSfx) {
    switch (kind) {
      case "click":
        this.tone({ type: "square", freq: 620, vol: 0.03, dur: 0.05 });
        break;
      case "dial":
        this.tone({ type: "square", freq: 300, vol: 0.045, dur: 0.06 });
        this.tone({ type: "square", freq: 420, vol: 0.03, dur: 0.05, delay: 0.05 });
        break;
      case "clue":
        this.tone({ type: "sine", freq: [[740, 0], [988, 0.09]], vol: 0.06, dur: 0.28 });
        break;
      case "hint":
        this.tone({ type: "sine", freq: [[520, 0], [640, 0.1]], vol: 0.05, dur: 0.3 });
        break;
      case "correct":
        this.tone({ type: "triangle", freq: 523, vol: 0.07, dur: 0.16 });
        this.tone({ type: "triangle", freq: 659, vol: 0.07, dur: 0.16, delay: 0.1 });
        this.tone({ type: "triangle", freq: 784, vol: 0.08, dur: 0.34, delay: 0.2 });
        break;
      case "wrong":
        this.tone({ type: "square", freq: 150, vol: 0.06, dur: 0.22 });
        this.tone({ type: "square", freq: 110, vol: 0.05, dur: 0.3, delay: 0.12 });
        this.rumble(0.5, 0.05, 220);
        break;
      case "door":
        this.rumble(1.4, 0.12);
        this.tone({ type: "sine", freq: [[60, 0], [48, 0.8]], vol: 0.08, dur: 1.3 });
        break;
      case "collapse":
        this.rumble(2.4, 0.16, 180);
        this.tone({ type: "sine", freq: [[55, 0], [35, 1.6]], vol: 0.1, dur: 2.2 });
        break;
      case "fanfare":
        this.tone({ type: "triangle", freq: 523, vol: 0.07, dur: 0.18 });
        this.tone({ type: "triangle", freq: 659, vol: 0.07, dur: 0.18, delay: 0.14 });
        this.tone({ type: "triangle", freq: 784, vol: 0.07, dur: 0.18, delay: 0.28 });
        this.tone({ type: "triangle", freq: 1047, vol: 0.09, dur: 0.6, delay: 0.42 });
        this.tone({ type: "sine", freq: 262, vol: 0.05, dur: 0.9, delay: 0.42 });
        break;
      case "heartbeat":
        this.thump(0.09);
        break;
    }
  }

  dispose() {
    this.stopHeartbeat();
    this.stopAmbience();
    this.stopSpeak();
    if (this.ctx) {
      try {
        void this.ctx.close();
      } catch {
        /* ignore */
      }
      this.ctx = null;
      this.master = null;
    }
  }
}

/**
 * Make math text speakable in Korean TTS.
 * - Drop unit-only parentheses like (m); keep Hangul clarifiers
 * - √3 = 1.7 → 루트3은 1.7
 */
export function sanitizeSpeechText(text: string): string {
  return text
    .replace(
      /\s*[\(\[](?=[^\)\]\uAC00-\uD7A3]*[A-Za-zμµ°²³])[^\)\]\uAC00-\uD7A3]*[\)\]]/g,
      "",
    )
    .replace(/√\s*3/g, "루트3")
    .replace(/√\s*2/g, "루트2")
    .replace(/√/g, "루트")
    .replace(/(루트\d+)\s*=\s*/g, "$1은 ")
    .replace(/루트2은/g, "루트2는")
    .replace(/\s*=\s*/g, "는 ")
    .replace(/°/g, "도")
    .replace(/×/g, " 곱하기 ")
    .replace(/÷/g, " 나누기 ")
    .replace(/→/g, " 그러면 ")
    .replace(/½/g, "이분의 일")
    .replace(/(\d)\s+로/g, "$1로")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.!?…])/g, "$1")
    .trim();
}

function splitSpeechChunks(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const sentences = trimmed
    .split(/(?<=[.!?。…])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const source = sentences.length > 0 ? sentences : [trimmed];
  const chunks: string[] = [];
  for (const part of source) {
    if (part.length <= 160) {
      chunks.push(part);
      continue;
    }
    let rest = part;
    while (rest.length > 160) {
      let cut = rest.lastIndexOf(" ", 160);
      if (cut < 80) cut = 160;
      chunks.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) chunks.push(rest);
  }
  return chunks;
}

function pickKoreanVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === "ko-KR") ??
    voices.find((v) => v.lang.toLowerCase().startsWith("ko")) ??
    null
  );
}

function applyKoreanVoice(utter: SpeechSynthesisUtterance) {
  const voice = pickKoreanVoice();
  if (!voice) {
    utter.lang = "ko-KR";
    return;
  }
  utter.voice = voice;
  utter.lang = voice.lang || "ko-KR";
}

/** Warm the voice list early — some browsers populate it asynchronously. */
export function warmSpeechVoices() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  void window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener?.(
    "voiceschanged",
    () => {
      void window.speechSynthesis.getVoices();
    },
    { once: true },
  );
}
