"use client";

import {
  BALL_COLORS,
  getBallColor,
  totalObserved,
  type BallColorKey,
  type BallCounts,
} from "@/lib/ball-box";
import type { BallBoxPlayerRow } from "@/lib/ball-box-types";

/** A single drawn ball, big and centered. */
export function BallDrawDisplay({
  color,
  isDrawing,
  justDrew,
}: {
  color: string | null;
  isDrawing?: boolean;
  justDrew?: boolean;
}) {
  const meta = color ? getBallColor(color) : null;

  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-wood/10 bg-peach/20 px-6 py-6">
      <div
        className={[
          "flex h-24 w-24 items-center justify-center rounded-full border-4 border-white shadow-lg transition-transform",
          isDrawing ? "ball-shake" : justDrew ? "ball-pop" : "",
        ].join(" ")}
        style={{
          backgroundColor: meta?.hex ?? "#E7D8C4",
          backgroundImage:
            "radial-gradient(circle at 32% 30%, rgba(255,255,255,0.55), transparent 45%)",
        }}
        aria-label={meta ? `${meta.label} 공` : "아직 안 뽑음"}
      >
        {isDrawing ? (
          <span className="text-3xl">🎱</span>
        ) : meta ? (
          <span
            className="font-display text-lg"
            style={{ color: meta.textOn }}
          >
            {meta.label}
          </span>
        ) : (
          <span className="text-2xl text-wood/40">?</span>
        )}
      </div>
      <p className="text-sm text-foreground/60">
        {isDrawing
          ? "공을 뽑는 중…"
          : meta
            ? `${meta.label} 공이 나왔어요! (다시 넣고 또 뽑을 수 있어요)`
            : "‘공 뽑기’를 눌러 시작하세요"}
      </p>
    </div>
  );
}

/** Observed frequency bars across all colors the student has seen. */
export function ObservedTally({
  observed,
  answerColors,
}: {
  observed: BallCounts;
  answerColors: BallColorKey[];
}) {
  const total = totalObserved(observed);
  const answerSet = new Set(answerColors);

  return (
    <div className="rounded-2xl border border-wood/10 bg-white/70 p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-lg text-wood">뽑은 결과</h3>
        <span className="text-sm text-foreground/60">총 {total}번 뽑음</span>
      </div>
      <div className="mt-3 space-y-2">
        {BALL_COLORS.map((c) => {
          const n = observed[c.key] ?? 0;
          const pct = total > 0 ? Math.round((n / total) * 100) : 0;
          const isAnswer = answerSet.has(c.key);
          return (
            <div
              key={c.key}
              className={[
                "flex items-center gap-2",
                isAnswer ? "" : "opacity-45",
              ].join(" ")}
            >
              <span className="w-9 shrink-0 text-sm font-medium text-foreground/75">
                {c.label}
              </span>
              <div className="relative h-6 flex-1 overflow-hidden rounded-lg bg-cream">
                <div
                  className="absolute inset-y-0 left-0 rounded-lg transition-[width] duration-300 ease-out"
                  style={{ width: `${pct}%`, backgroundColor: c.hex }}
                />
              </div>
              <span className="w-20 shrink-0 text-right text-sm tabular-nums text-foreground/70">
                {n}회 · {pct}%
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-foreground/50">
        비율이 안정될 때까지 여러 번 뽑아 보고, 총 개수에 비율을 곱해 추측해
        보세요.
      </p>
    </div>
  );
}

/** Number inputs for each answerable color. */
export function GuessInputGrid({
  answerColors,
  values,
  onChange,
  disabled,
}: {
  answerColors: BallColorKey[];
  values: Record<string, string>;
  onChange: (key: BallColorKey, value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground/70">
        각 색의 공이 몇 개인지 입력하세요
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {answerColors.map((key) => {
          const meta = getBallColor(key);
          if (!meta) return null;
          return (
            <label
              key={key}
              className="flex items-center gap-2 rounded-xl border border-wood/15 bg-white/70 px-3 py-2"
            >
              <span
                className="h-6 w-6 shrink-0 rounded-full border-2 border-white shadow-sm"
                style={{ backgroundColor: meta.hex }}
                aria-hidden
              />
              <span className="w-8 shrink-0 text-sm font-medium text-foreground/75">
                {meta.label}
              </span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={values[key] ?? ""}
                disabled={disabled}
                onChange={(e) => onChange(key, e.target.value)}
                placeholder="0"
                className="w-full min-w-0 rounded-lg border border-wood/15 bg-cream px-2 py-1.5 text-center text-wood outline-none focus:border-sky disabled:opacity-60"
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}

/** Live session ranking (solved first, then score). */
export function SessionRanking({
  players,
  highlightMe = true,
}: {
  players: BallBoxPlayerRow[];
  highlightMe?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-wood/10 bg-white/70 p-4">
      <h3 className="font-display text-lg text-wood">참가자</h3>
      {players.length === 0 ? (
        <p className="mt-3 text-sm text-foreground/50">아직 참가자가 없어요</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {players.map((p, i) => (
            <li
              key={p.studentId}
              className={[
                "flex items-center justify-between rounded-xl px-3 py-2 text-sm",
                highlightMe && p.isMe
                  ? "bg-gold/35 ring-1 ring-gold/50"
                  : "bg-cream/80",
              ].join(" ")}
            >
              <span className="flex items-center gap-2">
                <span className="font-display text-base text-wood/70">
                  {i + 1}
                </span>
                <span className="font-medium">{p.displayName}</span>
                {p.solved && (
                  <span className="rounded-md bg-gold/50 px-1.5 py-0.5 text-xs text-wood">
                    정답
                  </span>
                )}
              </span>
              <span className="text-right text-xs text-foreground/60">
                {p.solved ? (
                  <strong className="font-display text-sm text-wood">
                    {p.score}점
                  </strong>
                ) : (
                  <span>{p.drawCount}번 뽑음</span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Revealed composition (answer) shown to everyone at the end. */
export function RevealedComposition({
  answer,
  answerColors,
}: {
  answer: BallCounts;
  answerColors: BallColorKey[];
}) {
  return (
    <div className="rounded-2xl border border-gold/40 bg-gold/15 p-4">
      <h3 className="font-display text-lg text-wood">정답 공개</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {answerColors.map((key) => {
          const meta = getBallColor(key);
          if (!meta) return null;
          return (
            <span
              key={key}
              className="flex items-center gap-2 rounded-xl bg-white/70 px-3 py-1.5 text-sm"
            >
              <span
                className="h-5 w-5 rounded-full border-2 border-white shadow-sm"
                style={{ backgroundColor: meta.hex }}
                aria-hidden
              />
              <span className="font-medium text-foreground/80">
                {meta.label}
              </span>
              <strong className="font-display text-base text-wood">
                {answer[key] ?? 0}개
              </strong>
            </span>
          );
        })}
      </div>
    </div>
  );
}
