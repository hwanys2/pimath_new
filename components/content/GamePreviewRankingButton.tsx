"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { fetchPublicGameRankingAction } from "@/app/grade/actions";
import {
  publicGameRankingCutoffHint,
  publicGameRankingMeta,
  type PublicGameRankRow,
} from "@/lib/public-game-ranking";

type Props = {
  contentKey: string;
  title: string;
  playHref: string;
};

function RankBadge({ rank }: { rank: number }) {
  const medal =
    rank === 1
      ? "h-11 w-11 bg-gold text-xl text-wood-dark ring-4 ring-gold/40"
      : rank === 2
        ? "h-9 w-9 bg-white text-lg text-wood ring-2 ring-wood/15"
        : rank === 3
          ? "h-9 w-9 bg-[#c4785a]/30 text-lg text-wood-dark ring-2 ring-[#c4785a]/25"
          : "h-7 w-7 bg-wood/10 text-sm text-wood";
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-black ${medal}`}
    >
      {rank === 1 ? "★" : rank}
    </span>
  );
}

function PodiumSlot({
  row,
  place,
}: {
  row: PublicGameRankRow | undefined;
  place: 1 | 2 | 3;
}) {
  const pedestal =
    place === 1
      ? "h-20 from-gold via-gold/70 to-gold/25 shadow-[0_-8px_28px_rgba(212,160,23,0.4)]"
      : place === 2
        ? "h-14 from-wood-light/70 via-wood/20 to-wood/10"
        : "h-10 from-[#c4785a]/55 via-[#c4785a]/25 to-[#c4785a]/10";
  const card =
    place === 1
      ? "bg-gradient-to-b from-gold/50 to-white ring-2 ring-gold/70"
      : row?.isMe
        ? "bg-mint/25 ring-2 ring-mint/60"
        : "bg-white/85 ring-1 ring-wood/10";

  if (!row) {
    return <li className="min-w-0 flex-1" aria-hidden />;
  }

  const meta = publicGameRankingMeta(row);

  return (
    <li className="flex min-w-0 flex-1 flex-col items-center justify-end">
      <article
        className={`mb-3 w-full max-w-[9.5rem] rounded-2xl px-2.5 py-2.5 text-center ${card}`}
      >
        <RankBadge rank={place} />
        <p className="mt-1 text-[10px] font-black tracking-widest text-wood/70">
          {place}등
        </p>
        <h3 className="font-display mt-0.5 truncate text-base text-foreground">
          {row.displayName}
          {row.isMe ? (
            <span className="ml-0.5 text-[10px] font-semibold text-wood/60">
              (나)
            </span>
          ) : null}
        </h3>
        {meta ? (
          <p className="truncate text-[10px] font-semibold text-foreground/45">
            {meta}
          </p>
        ) : null}
        <p className="font-display mt-0.5 text-lg tabular-nums text-wood">
          {row.score.toLocaleString()}
        </p>
      </article>
      <div
        className={`w-full rounded-t-2xl bg-gradient-to-b ${pedestal}`}
        aria-hidden
      />
    </li>
  );
}

function RankingDialog({
  open,
  title,
  playHref,
  rows,
  loading,
  onClose,
}: {
  open: boolean;
  title: string;
  playHref: string;
  rows: PublicGameRankRow[];
  loading: boolean;
  onClose: () => void;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const first = rows.find((r) => r.rank === 1);
  const second = rows.find((r) => r.rank === 2);
  const third = rows.find((r) => r.rank === 3);
  const rest = rows.filter((r) => r.rank > 3);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#3d2c1e]/55 p-3 backdrop-blur-[3px] sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[min(40rem,92vh)] w-full max-w-lg overflow-y-auto rounded-[1.75rem] bg-cream shadow-[0_24px_60px_rgba(61,44,30,0.35)] ring-1 ring-gold/40">
        <header className="relative overflow-hidden bg-gradient-to-br from-wood via-wood-dark to-[#4a2c16] px-5 pb-5 pt-4 text-cream sm:px-6">
          <div
            className="pointer-events-none absolute -right-6 -top-8 h-32 w-32 rounded-full bg-gold/25 blur-2xl"
            aria-hidden
          />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black tracking-wide text-gold">
                ✦ 명예의 전당
              </p>
              <h2
                id={titleId}
                className="font-display mt-1 text-2xl text-cream sm:text-3xl"
              >
                전체 5위
              </h2>
              <p className="mt-1 truncate text-sm font-semibold text-cream/75">
                {title} · 개인 최고 점수
              </p>
            </div>
            <div className="flex shrink-0 items-start gap-2">
              <Image
                src="/images/mascot-v2.png"
                alt=""
                width={72}
                height={72}
                className="hidden h-16 w-16 object-contain drop-shadow-lg sm:block"
              />
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                className="rounded-xl bg-cream/15 px-2.5 py-1.5 text-xs font-bold text-cream/90 ring-1 ring-cream/20 transition hover:bg-cream/25"
              >
                닫기
              </button>
            </div>
          </div>
        </header>

        <div className="bg-gradient-to-br from-gold/15 via-white to-peach/20 px-4 py-5 sm:px-6">
          {loading && rows.length === 0 ? (
            <p className="py-10 text-center text-sm font-semibold text-foreground/50">
              순위를 불러오는 중…
            </p>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm font-semibold text-foreground/55">
              아직 기록이 없어요. 첫 순위는 바로 당신!
            </p>
          ) : (
            <>
              <ol className="flex items-end gap-2 px-1">
                <PodiumSlot row={second} place={2} />
                <PodiumSlot row={first} place={1} />
                <PodiumSlot row={third} place={3} />
              </ol>
              {rest.length > 0 ? (
                <ol className="mt-4 space-y-1.5">
                  {rest.map((row) => {
                    const meta = publicGameRankingMeta(row);
                    return (
                      <li
                        key={`${row.rank}-${row.displayName}`}
                        className={[
                          "flex items-center justify-between gap-2 rounded-2xl px-3 py-2",
                          row.isMe
                            ? "bg-mint/30 ring-1 ring-mint/60"
                            : "bg-white/80 ring-1 ring-wood/10",
                        ].join(" ")}
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <RankBadge rank={row.rank} />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-bold text-foreground">
                              {row.displayName}
                              {row.isMe ? (
                                <span className="ml-1 text-[10px] font-semibold text-wood/60">
                                  (나)
                                </span>
                              ) : null}
                            </span>
                            {meta ? (
                              <span className="block truncate text-[10px] text-foreground/45">
                                {meta}
                              </span>
                            ) : null}
                          </span>
                        </span>
                        <span className="shrink-0 font-display text-base tabular-nums text-wood">
                          {row.score.toLocaleString()}점
                        </span>
                      </li>
                    );
                  })}
                </ol>
              ) : null}
            </>
          )}

          <p className="mt-5 rounded-2xl bg-wood/10 px-3 py-2.5 text-center text-sm font-bold text-wood">
            {loading && rows.length === 0
              ? "잠시만요"
              : publicGameRankingCutoffHint(rows)}
          </p>
          <p className="mt-2 text-center text-[11px] font-semibold text-foreground/45">
            다른 학교 학생은 이름 일부를 *로 가려요
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Link
              href={playHref}
              className="block-btn block-btn-gold px-5 py-2.5 font-display text-sm"
            >
              게임 시작
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-bold text-wood/70 transition hover:bg-wood/10"
            >
              나중에
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function GamePreviewRankingButton({
  contentKey,
  title,
  playHref,
}: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<PublicGameRankRow[]>([]);
  const [isPending, startTransition] = useTransition();
  const onClose = useCallback(() => setOpen(false), []);

  const openBoard = () => {
    setOpen(true);
    startTransition(async () => {
      const next = await fetchPublicGameRankingAction(contentKey);
      setRows(next);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={openBoard}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="rounded-xl bg-white/80 px-3 py-2 text-sm font-bold text-wood ring-1 ring-gold/40 transition hover:bg-gold/20"
      >
        랭킹보기
      </button>
      <RankingDialog
        open={open}
        title={title}
        playHref={playHref}
        rows={rows}
        loading={isPending}
        onClose={onClose}
      />
    </>
  );
}
