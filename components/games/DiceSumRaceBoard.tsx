"use client";

import { SUMS, WIN_THRESHOLD, type SumCounts } from "@/lib/dice-race-math";

type BoardProps = {
  counts: SumCounts;
  myPick?: number | null;
  winningSum?: number | null;
  justFilledSum?: number | null;
};

export default function DiceSumRaceBoard({
  counts,
  myPick = null,
  winningSum = null,
  justFilledSum = null,
}: BoardProps) {
  return (
    <div className="space-y-3">
      <p className="text-center text-sm font-medium text-foreground/70">
        게임판 ({WIN_THRESHOLD}칸 먼저 채우기)
      </p>
      <div className="overflow-x-auto pb-1">
        <div className="mx-auto flex min-w-[520px] items-end justify-center gap-1.5 sm:gap-2">
          {SUMS.map((sum) => {
            const filled = counts[String(sum)] ?? 0;
            const fillPct = Math.min(100, (filled / WIN_THRESHOLD) * 100);
            const isMyPick = myPick === sum;
            const isWinner = winningSum === sum;
            const justFilled = justFilledSum === sum;

            let fillClass = "bg-sky";
            if (isWinner) fillClass = "bg-gold";
            else if (isMyPick) fillClass = "bg-sky ring-2 ring-gold ring-inset";

            return (
              <div
                key={sum}
                className="flex w-10 flex-col items-center gap-1.5 sm:w-11"
              >
                <div
                  className="relative h-[220px] w-full overflow-hidden rounded-lg border-2 border-wood/15 bg-cream/90"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(to top, rgba(139,94,60,0.12) 0, rgba(139,94,60,0.12) 1px, transparent 1px, transparent 10%)",
                  }}
                >
                  {filled > 0 && (
                    <div
                      className={[
                        "absolute bottom-0 left-0 right-0 rounded-md transition-[height] duration-300 ease-out",
                        fillClass,
                        justFilled ? "dice-column-pop" : "",
                      ].join(" ")}
                      style={{ height: `${fillPct}%` }}
                    />
                  )}
                </div>
                <span
                  className={[
                    "flex h-8 w-full items-center justify-center rounded-lg text-sm font-black",
                    isMyPick
                      ? "bg-gold text-wood ring-2 ring-gold/60"
                      : isWinner
                        ? "bg-gold text-wood"
                        : "bg-sky text-wood",
                  ].join(" ")}
                >
                  {sum}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DieFace({
  value,
  shaking,
  settling,
}: {
  value: number;
  shaking?: boolean;
  settling?: boolean;
}) {
  const dots: Record<number, number[][]> = {
    1: [[1, 1]],
    2: [
      [0, 0],
      [2, 2],
    ],
    3: [
      [0, 0],
      [1, 1],
      [2, 2],
    ],
    4: [
      [0, 0],
      [0, 2],
      [2, 0],
      [2, 2],
    ],
    5: [
      [0, 0],
      [0, 2],
      [1, 1],
      [2, 0],
      [2, 2],
    ],
    6: [
      [0, 0],
      [0, 2],
      [1, 0],
      [1, 2],
      [2, 0],
      [2, 2],
    ],
  };

  return (
    <div
      className={[
        "relative grid h-16 w-16 grid-cols-3 grid-rows-3 rounded-xl border-2 border-wood/25 bg-white p-2 shadow-md",
        shaking ? "dice-shake" : "",
        settling ? "dice-settle" : "",
      ].join(" ")}
      aria-label={`주사위 ${value}`}
    >
      {(dots[value] ?? []).map(([r, c], i) => (
        <span
          key={i}
          className="flex items-center justify-center"
          style={{ gridRow: r + 1, gridColumn: c + 1 }}
        >
          <span className="h-3 w-3 rounded-full bg-wood" />
        </span>
      ))}
    </div>
  );
}

export function DiceRollDisplay({
  d1,
  d2,
  sum,
  displayD1,
  displayD2,
  isRolling = false,
  highlightSum = false,
}: {
  d1: number | null;
  d2: number | null;
  sum: number | null;
  displayD1?: number | null;
  displayD2?: number | null;
  isRolling?: boolean;
  highlightSum?: boolean;
}) {
  const showD1 = isRolling ? (displayD1 ?? d1 ?? 1) : (d1 ?? displayD1);
  const showD2 = isRolling ? (displayD2 ?? d2 ?? 1) : (d2 ?? displayD2);
  const showSum = isRolling ? null : sum;

  if (showD1 == null && showD2 == null && !isRolling) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-2xl border border-wood/10 bg-peach/20 px-6 py-5">
        <p className="text-sm text-foreground/60">아직 주사위를 굴리지 않았어요</p>
      </div>
    );
  }

  return (
    <div
      className={[
        "flex flex-wrap items-center justify-center gap-3 rounded-2xl border px-6 py-5 transition-colors",
        isRolling
          ? "border-gold/40 bg-gold/15"
          : "border-wood/10 bg-peach/20",
      ].join(" ")}
    >
      <DieFace
        value={showD1 ?? 1}
        shaking={isRolling}
        settling={!isRolling && d1 != null}
      />
      <span className="font-display text-2xl text-wood">+</span>
      <DieFace
        value={showD2 ?? 1}
        shaking={isRolling}
        settling={!isRolling && d2 != null}
      />
      {showSum != null ? (
        <>
          <span className="font-display text-2xl text-wood">=</span>
          <span
            className={[
              "flex h-16 min-w-16 items-center justify-center rounded-xl bg-sky px-3 font-display text-3xl text-wood shadow-sm",
              highlightSum ? "dice-result-pop" : "",
            ].join(" ")}
          >
            {showSum}
          </span>
        </>
      ) : (
        <span className="font-display text-lg text-wood/60">?</span>
      )}
    </div>
  );
}

export function SessionRanking({
  players,
  highlightMe = true,
}: {
  players: Array<{
    displayName: string;
    sessionScore: number;
    roundScore: number;
    pick: number | null;
    isMe?: boolean;
  }>;
  highlightMe?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-wood/10 bg-white/70 p-4">
      <h3 className="font-display text-lg text-wood">세션 랭킹</h3>
      {players.length === 0 ? (
        <p className="mt-3 text-sm text-foreground/50">아직 참가자가 없어요</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {players.map((p, i) => (
            <li
              key={`${p.displayName}-${i}`}
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
                {p.pick != null && (
                  <span className="rounded-md bg-sky/40 px-1.5 py-0.5 text-xs text-wood">
                    {p.pick}
                  </span>
                )}
              </span>
              <span className="font-display text-base text-wood">
                {p.sessionScore}점
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function PickGrid({
  selected,
  onPick,
  disabled,
}: {
  selected: number | null;
  onPick: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground/70">
        2부터 12까지 숫자 중 하나를 고르세요
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {SUMS.map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onPick(n)}
            className={[
              "h-11 min-w-11 rounded-xl px-3 font-display text-lg transition",
              selected === n
                ? "bg-gold text-wood ring-2 ring-gold/70"
                : "bg-sky/45 text-wood hover:bg-sky/65",
              disabled ? "cursor-not-allowed opacity-60" : "",
            ].join(" ")}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
