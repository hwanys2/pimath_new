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
  PI_STAGES,
  type AvatarChoice,
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
};

const empty: AdventureActionResult = {};

export default function AdventureProfile({
  displayName,
  className,
  progress,
  avatar,
  activeAvatar,
  nextUnlock,
  unlockedIds,
}: Props) {
  const [avatarState, avatarAction, avatarPending] = useActionState(
    selectAvatar,
    empty,
  );
  const [practiceState, practiceAction, practicePending] = useActionState(
    practiceAwardXp,
    empty,
  );

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
              다음 목표:{" "}
              {nextUnlock.kind === "companion" ? "동료 " : ""}
              <span className="font-display">{nextUnlock.name}</span> (Lv.
              {nextUnlock.atLevel}) · 약 {nextUnlock.xpNeeded.toLocaleString()}{" "}
              XP
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl text-wood">동료 도감</h2>
        <p className="mt-1 text-sm text-foreground/65">
          해금된 동료를 골라 아바타로 쓸 수 있어요. 과제로 XP를 모아 더 많이
          만나 보세요!
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

      <section>
        <h2 className="font-display text-xl text-wood">파이의 성장</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PI_STAGES.map((stage) => {
            const reached = progress.level >= stage.minLevel;
            return (
              <li
                key={stage.id}
                className={`quest-card flex items-center gap-3 p-4 ${
                  reached ? "" : "opacity-45 grayscale"
                }`}
              >
                <div className="relative h-16 w-16 shrink-0">
                  <Image
                    src={stage.image}
                    alt={stage.title}
                    fill
                    className="object-contain"
                    sizes="64px"
                  />
                </div>
                <div>
                  <p className="font-display text-foreground">{stage.title}</p>
                  <p className="text-xs text-foreground/55">
                    Lv.{stage.minLevel}–{stage.maxLevel}
                    {reached ? " · 해금됨" : " · 잠김"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="quest-card p-5 sm:p-6">
        <h2 className="font-display text-xl text-wood">연습으로 XP 받기</h2>
        <p className="mt-1 text-sm text-foreground/65">
          시뮬레이션이 추가되기 전까지, 연습 점수로 성장 루프를 느껴 보세요.
          (한 판 만점 기준 1000점)
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
