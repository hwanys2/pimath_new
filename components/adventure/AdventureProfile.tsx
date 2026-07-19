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

const SLOT_ORDER: CosmeticSlot[] = ["aura", "cape", "pin", "badge", "staff"];

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

      <section className="quest-card grid gap-6 p-5 sm:grid-cols-[minmax(0,260px)_1fr] sm:p-8">
        <div className="relative mx-auto w-full max-w-[240px]">
          <div className="relative aspect-[3/4] w-full">
            {equipped.aura && (
              <div className="pointer-events-none absolute inset-0 -z-0 flex items-center justify-center opacity-70">
                <Image
                  src={equipped.aura.icon}
                  alt=""
                  width={200}
                  height={200}
                  className="h-[90%] w-[90%] object-contain blur-[0.5px]"
                />
              </div>
            )}
            <Image
              src={avatar.image}
              alt={avatar.title}
              fill
              className="relative z-10 object-contain drop-shadow-lg"
              sizes="240px"
              priority
            />
            {equipped.cape && (
              <Image
                src={equipped.cape.icon}
                alt=""
                width={56}
                height={56}
                className="absolute bottom-6 left-0 z-20 h-12 w-12 object-contain drop-shadow"
              />
            )}
            {equipped.pin && (
              <Image
                src={equipped.pin.icon}
                alt=""
                width={48}
                height={48}
                className="absolute top-4 right-2 z-20 h-11 w-11 object-contain drop-shadow"
              />
            )}
            {equipped.badge && (
              <Image
                src={equipped.badge.icon}
                alt=""
                width={48}
                height={48}
                className="absolute bottom-8 right-0 z-20 h-11 w-11 object-contain drop-shadow"
              />
            )}
            {equipped.staff && (
              <Image
                src={equipped.staff.icon}
                alt=""
                width={56}
                height={56}
                className="absolute top-1/3 left-0 z-20 h-12 w-12 object-contain drop-shadow"
              />
            )}
          </div>
          <ul className="mt-3 flex flex-wrap justify-center gap-1.5">
            {SLOT_ORDER.map((slot) => {
              const item = equipped[slot];
              return (
                <li
                  key={slot}
                  className="flex items-center gap-1 rounded-lg bg-cream px-2 py-1 text-[10px] font-bold text-wood/80"
                  title={item?.name ?? `${SLOT_LABEL[slot]} 미해금`}
                >
                  {item ? (
                    <Image
                      src={item.icon}
                      alt={item.name}
                      width={18}
                      height={18}
                      className="h-4.5 w-4.5 object-contain"
                    />
                  ) : (
                    <span className="inline-block h-4 w-4 rounded bg-wood/15" />
                  )}
                  {SLOT_LABEL[slot]}
                </li>
              );
            })}
          </ul>
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

      <section>
        <h2 className="font-display text-xl text-wood">장착 장비</h2>
        <p className="mt-1 text-sm text-foreground/65">
          레벨이 오를수록 핀·지팡이·망토·배지·오라가 자동으로 강해져요.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {COSMETICS.map((item) => {
            const unlocked = unlockedCosmeticIds.includes(item.id);
            const isEquipped = equipped[item.slot]?.id === item.id;
            return (
              <li
                key={item.id}
                className={`quest-card flex items-center gap-3 p-3 ${
                  unlocked ? "" : "opacity-40 grayscale"
                } ${isEquipped ? "ring-4 ring-gold/70" : ""}`}
              >
                <div className="relative h-14 w-14 shrink-0 rounded-xl bg-cream">
                  <Image
                    src={item.icon}
                    alt={item.name}
                    fill
                    className="object-contain p-1"
                    sizes="56px"
                  />
                </div>
                <div className="min-w-0">
                  <p className="font-display text-sm text-foreground">
                    {item.name}
                  </p>
                  <p className="text-xs text-foreground/55">
                    {SLOT_LABEL[item.slot]} · Lv.{item.unlockLevel}
                    {isEquipped ? " · 장착 중" : unlocked ? " · 해금" : " · 잠김"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="font-display text-xl text-wood">파이의 성장 폼</h2>
        <p className="mt-1 text-sm text-foreground/65">
          5레벨마다 외형이 바뀌어요. 과제를 할수록 파이가 멋있어집니다!
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PI_STAGES.map((stage) => {
            const reached = progress.level >= stage.minLevel;
            const current = avatar.piStage.id === stage.id;
            return (
              <li
                key={stage.id}
                className={`quest-card flex flex-col items-center gap-2 p-3 ${
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
      </section>

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
