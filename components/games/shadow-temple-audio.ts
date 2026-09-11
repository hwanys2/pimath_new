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

    const deliver = () => {
      if (this.muted || gen !== this.speakGen) return;
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
            utter.rate = NARRATION_SPEECH_RATE;
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
        // Desktop Chrome may drop speak() in the same turn as cancel().
        window.setTimeout(() => {
          if (this.muted || gen !== this.speakGen) return;
          if (!synth.speaking && !synth.pending) enqueue();
        }, 40);
        return;
      }
      enqueue();
    };

    // Desktop browsers often return zero voices until voiceschanged fires.
    if (pickKoreanVoice()) {
      deliver();
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      synth.removeEventListener("voiceschanged", finish);
      deliver();
    };
    synth.addEventListener("voiceschanged", finish);
    void synth.getVoices();
    window.setTimeout(finish, 320);
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
    }, 1000);
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

  /**
   * Ambience is kept as a no-op stub for backwards compatibility.
   * Continuous low-frequency drone oscillators were removed to prevent
   * acoustic beating (웅웅거림), harmonic distortion, and speaker rattling.
   */
  startAmbience() {
    /* intentionally silent to keep audio clean and prevent speaker rattle */
  }

  stopAmbience() {
    /* no-op */
  }

  /** Repeating low double-thump while the torch is nearly out. */
  startHeartbeat() {
    if (this.heartbeatTimer != null) return;
    const beat = () => {
      this.thump(0.04);
      window.setTimeout(() => this.thump(0.025), 220);
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
      // 90Hz down to 60Hz: clean muffled thump without sub-bass speaker distortion
      osc.frequency.setValueAtTime(90, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.16);
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

  /** Bandpass-filtered texture rumble for doors / collapse (avoids sub-bass distortion). */
  private rumble(duration: number, vol: number, freq = 240) {
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
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(freq, now);
      filter.Q.value = 1.0;
      filter.frequency.exponentialRampToValueAtTime(140, now + duration);
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
        this.tone({ type: "triangle", freq: 185, vol: 0.06, dur: 0.16 });
        this.tone({ type: "triangle", freq: 138, vol: 0.06, dur: 0.22, delay: 0.08 });
        break;
      case "door":
        this.rumble(0.8, 0.04, 280);
        this.tone({ type: "sine", freq: [[160, 0], [120, 0.4]], vol: 0.03, dur: 0.7 });
        break;
      case "collapse":
        this.rumble(1.5, 0.05, 240);
        this.tone({ type: "sine", freq: [[120, 0], [90, 0.8]], vol: 0.035, dur: 1.4 });
        break;
      case "fanfare":
        this.tone({ type: "triangle", freq: 523, vol: 0.07, dur: 0.18 });
        this.tone({ type: "triangle", freq: 659, vol: 0.07, dur: 0.18, delay: 0.14 });
        this.tone({ type: "triangle", freq: 784, vol: 0.07, dur: 0.18, delay: 0.28 });
        this.tone({ type: "triangle", freq: 1047, vol: 0.09, dur: 0.6, delay: 0.42 });
        this.tone({ type: "sine", freq: 262, vol: 0.05, dur: 0.9, delay: 0.42 });
        break;
      case "heartbeat":
        this.thump(0.04);
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

/** Typing speed for on-screen narration — tuned to utter.rate below. */
export const NARRATION_SPEECH_RATE = 1.02;
export const NARRATION_MS_PER_CHAR = Math.round(
  1000 / (5.5 * NARRATION_SPEECH_RATE),
);

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
