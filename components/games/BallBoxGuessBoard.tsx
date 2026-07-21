"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  BALL_COLORS,
  getBallColor,
  GUEST_NAME_MAX,
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

/** Rank movement indicator vs. the previous set. */
function RankMove({ delta }: { delta: number | null }) {
  if (delta == null) {
    return <span className="w-4 text-center text-xs text-foreground/30">·</span>;
  }
  if (delta > 0) {
    return (
      <span className="w-4 text-center text-xs font-bold text-green-600">▲</span>
    );
  }
  if (delta < 0) {
    return (
      <span className="w-4 text-center text-xs font-bold text-red-500">▼</span>
    );
  }
  return <span className="w-4 text-center text-xs text-foreground/40">–</span>;
}

/** Cumulative session ranking (by session score) with rank movement. */
export function SessionRanking({
  players,
  prevRanks = null,
  highlightMe = true,
}: {
  players: BallBoxPlayerRow[];
  /** Map of pid -> rank (1-based) in the previous set, for movement arrows. */
  prevRanks?: Record<string, number> | null;
  highlightMe?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-wood/10 bg-white/70 p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-lg text-wood">누적 랭킹</h3>
        <span className="text-xs text-foreground/50">세트 합계 점수</span>
      </div>
      {players.length === 0 ? (
        <p className="mt-3 text-sm text-foreground/50">아직 참가자가 없어요</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {players.map((p, i) => {
            const rank = i + 1;
            const prev = prevRanks?.[p.pid];
            const delta =
              prev == null || prevRanks == null ? null : prev - rank;
            const medal =
              rank === 1
                ? "bg-gold/70 text-wood"
                : rank === 2
                  ? "bg-wood/20 text-wood"
                  : rank === 3
                    ? "bg-[#c4785a]/35 text-wood"
                    : "bg-cream text-wood/70";
            return (
              <li
                key={p.pid}
                className={[
                  "flex items-center justify-between rounded-xl px-2.5 py-2 text-sm",
                  highlightMe && p.isMe
                    ? "bg-gold/35 ring-1 ring-gold/50"
                    : "bg-cream/80",
                ].join(" ")}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <RankMove delta={delta} />
                  <span
                    className={[
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-display text-xs",
                      medal,
                    ].join(" ")}
                  >
                    {rank}
                  </span>
                  <span className="truncate font-medium">{p.displayName}</span>
                  {p.solved && (
                    <span className="shrink-0 rounded-md bg-gold/50 px-1 py-0.5 text-[10px] text-wood">
                      정답
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-right">
                  <strong className="font-display text-sm text-wood">
                    {p.sessionScore}
                  </strong>
                  <span className="text-xs text-foreground/50">점</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/** QR + join code for guest (no-class) sessions. */
export function BallBoxJoinQR({ joinCode }: { joinCode: string }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/play/g2-u4-ball-box-guess?join=${joinCode}`;
    setJoinUrl(url);
    QRCode.toDataURL(url, {
      width: 320,
      margin: 1,
      color: { dark: "#5b3d29", light: "#ffffff" },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [joinCode]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-wood/10 bg-white/70 p-5">
      <h3 className="font-display text-lg text-wood">QR로 학생 초대</h3>
      {qrDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qrDataUrl}
          alt="참여 QR 코드"
          className="h-52 w-52 rounded-xl border border-wood/10"
        />
      ) : (
        <div className="flex h-52 w-52 items-center justify-center rounded-xl bg-cream text-sm text-foreground/50">
          QR 생성 중…
        </div>
      )}
      <div className="text-center">
        <p className="text-sm text-foreground/60">참여 코드</p>
        <p className="font-display text-3xl tracking-[0.3em] text-wood">
          {joinCode}
        </p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="rounded-xl border border-wood/20 px-4 py-2 text-sm text-foreground/70 transition hover:bg-wood/5"
      >
        {copied ? "링크 복사됨!" : "참여 링크 복사"}
      </button>
      <p className="text-center text-xs text-foreground/50">
        학생이 QR을 찍고 이름을 입력하면 바로 입장해요 (로그인 불필요)
      </p>
    </div>
  );
}

/** Guest name entry before joining. */
export function GuestNameEntry({
  onSubmit,
  disabled,
  joinCode,
}: {
  onSubmit: (name: string) => void;
  disabled?: boolean;
  joinCode: string;
}) {
  const [name, setName] = useState("");
  const trimmed = name.trim();

  return (
    <div className="mx-auto max-w-sm space-y-4 rounded-2xl border border-wood/10 bg-white/70 p-6 text-center">
      <h2 className="font-display text-2xl text-wood">상자 속 공 개수 맞히기</h2>
      <p className="text-sm text-foreground/60">
        참여 코드 <strong className="text-wood">{joinCode}</strong> · 이름을
        입력하고 입장하세요
      </p>
      <input
        type="text"
        value={name}
        maxLength={GUEST_NAME_MAX}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && trimmed) onSubmit(trimmed);
        }}
        placeholder="이름 (예: 김파이)"
        className="w-full rounded-xl border border-wood/15 bg-cream px-4 py-3 text-center text-lg text-wood outline-none focus:border-sky"
      />
      <button
        type="button"
        disabled={disabled || !trimmed}
        onClick={() => onSubmit(trimmed)}
        className="w-full rounded-xl bg-sky px-5 py-3 font-display text-lg text-wood transition hover:bg-sky/80 active:scale-95 disabled:opacity-60"
      >
        입장하기
      </button>
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
