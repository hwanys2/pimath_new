"use client";

import Image from "next/image";
import { useActionState } from "react";
import {
  practiceAwardXp,
  selectAvatar,
  type AdventureActionResult,
} from "@/app/adventure/actions";
import {
  COMPANIONS,
  COSMETICS,
  PI_STAGES,
  type AvatarChoice,
  type CosmeticDef,
  type CosmeticSlot,
  type NextUnlock,
  type ResolvedAvatar,
} from "@/lib/progression";
import type { LevelProgress } from "@/lib/xp";

type Props = {
  displayName: string;
  className: string;
  progress: LevelProgress;
  avatar: ResolvedAvatar;
  activeAvatar: AvatarChoice;
  nextUnlock: NextUnlock | null;
  unlockedIds: AvatarChoice[];
  equipped: Partial<Record<CosmeticSlot, CosmeticDef>>;
  unlockedCosmeticIds: string[];
};

const empty: AdventureActionResult = {};

const SLOT_LABEL: Record<CosmeticSlot, string> = {
  pin: "핀",
  staff: "지팡이",
  cape: "망토",
  badge: "배지",
  aura: "오라",
};

const SLOT_ORDER: CosmeticSlot[] = ["pin", "staff", "cape", "badge", "aura"];

export default function AdventureProfile({
  displayName,
  className,
  progress,
  avatar,
  activeAvatar,
  nextUnlock,
  unlockedIds,
  equipped,
  unlockedCosmeticIds,
}: Props) {
  const [avatarState, avatarAction, avatarPending] = useActionState(
    selectAvatar,
    empty,
  );
  const [practiceState, practiceAction, practicePending] = useActionState(
    practiceAwardXp,
    empty,
  );

  const kindLabel =
    nextUnlock?.kind === "cosmetic"
      ? "아이템"
      : nextUnlock?.kind === "companion"
        ? "동료"
        : nextUnlock?.kind === "pi_stage"
          ? "외형"
          : "";

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-wood/70">나의 모험</p>
        <h1 className="font-display text-3xl text-foreground sm:text-4xl">
          {displayName}의 여정
        </h1>
        <p className="text-sm text-foreground/60">{className}</p>
      </header>

      {(practiceState.message || avatarState.message) && (
        <p className="rounded-xl bg-mint/40 px-4 py-3 text-sm font-semibold text-wood">
          {practiceState.message || avatarState.message}
        </p>
      )}
      {(practiceState.error || avatarState.error) && (
        <p className="rounded-xl bg-peach/40 px-4 py-3 text-sm font-semibold text-[#a63a1a]">
          {practiceState.error || avatarState.error}
        </p>
      )}

      <section className="quest-card grid gap-6 p-5 sm:grid-cols-[minmax(0,240px)_1fr] sm:p-8">
        <div className="relative mx-auto aspect-[3/4] w-full max-w-[220px]">
          <Image
            src={avatar.image}
            alt={avatar.title}
            fill
            className="object-contain drop-shadow-lg"
            sizes="220px"
            priority
          />
        </div>

        <div className="flex flex-col justify-center gap-4">
          <div>
            <span className="badge-pill">Lv.{progress.level}</span>
            <h2 className="font-display mt-2 text-2xl text-wood sm:text-3xl">
              {avatar.title}
            </h2>
            <p className="mt-1 text-sm text-foreground/65">
              {avatar.piStage.blurb}
            </p>
          </div>

          <div>
            <div className="mb-1.5 flex justify-between text-xs font-bold text-wood/80">
              <span>
                XP {progress.xpIntoLevel.toLocaleString()} /{" "}
                {progress.xpForThisLevel.toLocaleString()}
              </span>
              <span>
                {progress.isMaxLevel
                  ? "만렙!"
                  : `다음 레벨까지 ${progress.xpToNextLevel.toLocaleString()}`}
              </span>
            </div>
            <div className="xp-bar">
              <div
                className="xp-bar-fill"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-foreground/50">
              총 {progress.totalXp.toLocaleString()} XP
            </p>
          </div>

          {nextUnlock && (
            <p className="rounded-xl bg-gold/30 px-3 py-2 text-sm font-semibold text-[#6b4a00]">
              다음 {kindLabel}:{" "}
              <span className="font-display">{nextUnlock.name}</span> (Lv.
              {nextUnlock.atLevel}) · 약 {nextUnlock.xpNeeded.toLocaleString()}{" "}
              XP
            </p>
          )}
        </div>
      </section>

      <section className="quest-card overflow-hidden p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-xl text-wood">장신구 보관함</h2>
            <p className="mt-1 text-sm text-foreground/65">
              레벨이 오를수록 핀·지팡이·망토·배지·오라가 자동으로 장착돼요.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border-2 border-wood/15 bg-gradient-to-b from-cream to-white p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-wood/60">
            현재 장착
          </p>
          <ul className="grid grid-cols-5 gap-2 sm:gap-3">
            {SLOT_ORDER.map((slot) => {
              const item = equipped[slot];
              return (
                <li
                  key={slot}
                  className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-wood/20 bg-white/80 p-2 shadow-[0_2px_0_rgba(139,94,60,0.08)]"
                >
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-lg bg-cream/80 sm:h-16 sm:w-16">
                    {item ? (
                      <Image
                        src={item.icon}
                        alt={item.name}
                        width={56}
                        height={56}
                        className="h-12 w-12 object-contain sm:h-14 sm:w-14"
                      />
                    ) : (
                      <span className="text-[10px] font-semibold text-wood/30">
                        빈칸
                      </span>
                    )}
                  </div>
                  <span className="font-display text-[11px] text-wood sm:text-xs">
                    {SLOT_LABEL[slot]}
                  </span>
                  <span className="line-clamp-1 text-center text-[9px] text-foreground/45">
                    {item?.name ?? "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mt-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-wood/60">
            보관함 전체
          </p>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7">
            {COSMETICS.map((item) => {
              const unlocked = unlockedCosmeticIds.includes(item.id);
              const isEquipped = equipped[item.slot]?.id === item.id;
              return (
                <li
                  key={item.id}
                  title={`${item.name} · Lv.${item.unlockLevel}`}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 p-2 ${
                    unlocked
                      ? "border-wood/10 bg-white"
                      : "border-wood/5 bg-wood/5 opacity-45 grayscale"
                  } ${isEquipped ? "ring-2 ring-gold ring-offset-1" : ""}`}
                >
                  <div className="relative h-12 w-12">
                    <Image
                      src={item.icon}
                      alt={item.name}
                      fill
                      className="object-contain"
                      sizes="48px"
                    />
                  </div>
                  <span className="line-clamp-1 w-full text-center text-[10px] font-semibold text-foreground/70">
                    {item.name}
                  </span>
                  <span className="text-[9px] text-foreground/40">
                    {SLOT_LABEL[item.slot]} · {item.unlockLevel}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <details className="quest-card group p-5 sm:p-6">
        <summary className="font-display cursor-pointer list-none text-xl text-wood marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-3">
            <span>파이 성장 폼 (20단계)</span>
            <span className="text-sm font-semibold text-wood/50 group-open:hidden">
              탭해서 보기
            </span>
            <span className="hidden text-sm font-semibold text-wood/50 group-open:inline">
              접기
            </span>
          </span>
        </summary>
        <p className="mt-2 text-sm text-foreground/65">
          5레벨마다 외형이 바뀌어요. 과제를 할수록 파이가 멋있어집니다!
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PI_STAGES.map((stage) => {
            const reached = progress.level >= stage.minLevel;
            const current = avatar.piStage.id === stage.id;
            return (
              <li
                key={stage.id}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 border-wood/10 bg-cream/40 p-3 ${
                  reached ? "" : "opacity-40 grayscale"
                } ${current ? "ring-4 ring-sky/60" : ""}`}
              >
                <div className="relative h-24 w-20">
                  <Image
                    src={stage.image}
                    alt={stage.title}
                    fill
                    className="object-contain"
                    sizes="80px"
                  />
                </div>
                <p className="font-display text-center text-sm text-foreground">
                  {stage.title}
                </p>
                <p className="text-center text-[11px] text-foreground/55">
                  Lv.{stage.minLevel}–{stage.maxLevel}
                  {current ? " · 현재" : reached ? " · 해금" : " · 잠김"}
                </p>
              </li>
            );
          })}
        </ul>
      </details>

      <section>
        <h2 className="font-display text-xl text-wood">동료 도감</h2>
        <p className="mt-1 text-sm text-foreground/65">
          해금된 동료를 아바타로 선택할 수 있어요.
        </p>
        <form
          action={avatarAction}
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          {COMPANIONS.map((c) => {
            const unlocked = unlockedIds.includes(c.id);
            const selected = activeAvatar === c.id;
            const image = c.id === "pi" ? avatar.piStage.image : c.image;

            return (
              <label
                key={c.id}
                className={`quest-card relative flex cursor-pointer flex-col items-center gap-2 p-4 transition ${
                  !unlocked ? "opacity-50 grayscale" : ""
                } ${selected && unlocked ? "ring-4 ring-sky/60" : ""}`}
              >
                <input
                  type="radio"
                  name="avatar"
                  value={c.id}
                  defaultChecked={activeAvatar === c.id}
                  disabled={!unlocked || avatarPending}
                  className="sr-only"
                />
                <div className="relative h-28 w-28">
                  <Image
                    src={image}
                    alt={c.name}
                    fill
                    className="object-contain"
                    sizes="112px"
                  />
                </div>
                <p className="font-display text-base text-foreground">{c.name}</p>
                <p className="text-center text-xs text-foreground/55">
                  {unlocked ? c.blurb : `Lv.${c.unlockLevel}에 해금`}
                </p>
              </label>
            );
          })}
          <div className="sm:col-span-2 lg:col-span-4">
            <button
              type="submit"
              disabled={avatarPending}
              className="block-btn block-btn-sky font-display px-5 py-3 text-sm disabled:opacity-60"
            >
              {avatarPending ? "저장 중…" : "선택한 아바타 저장"}
            </button>
          </div>
        </form>
      </section>

      <section className="quest-card p-5 sm:p-6">
        <h2 className="font-display text-xl text-wood">연습으로 XP 받기</h2>
        <p className="mt-1 text-sm text-foreground/65">
          시뮬레이션이 추가되기 전, 연습 점수로 성장·장비 해금을 느껴 보세요.
          (한 판 만점 1000점 · 만렙 약 50만 XP)
        </p>
        <form action={practiceAction} className="mt-4 flex flex-wrap gap-2">
          {[200, 500, 800, 1000].map((score) => (
            <button
              key={score}
              type="submit"
              name="score"
              value={score}
              disabled={practicePending}
              className="block-btn block-btn-mint font-display px-4 py-2 text-sm disabled:opacity-60"
            >
              +{score} XP
            </button>
          ))}
        </form>
      </section>
    </div>
  );
}
