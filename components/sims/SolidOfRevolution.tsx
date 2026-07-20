"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import ProfileEditor from "@/components/sims/solid-of-revolution/ProfileEditor";
import {
  type DrawMode,
  type PresetId,
  type Pt,
  PRESETS,
  clampAngle,
  getPreset,
  isProfileReady,
  sealProfileToAxis,
} from "@/lib/solid-of-revolution-math";

const RevolutionScene = dynamic(
  () => import("@/components/sims/solid-of-revolution/RevolutionScene"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[280px] items-center justify-center rounded-2xl bg-cream/80 text-sm font-semibold text-wood/70 ring-1 ring-wood/10">
        3D 화면을 불러오는 중…
      </div>
    ),
  },
);

const ANIM_MS_PER_360 = 2800;

export default function SolidOfRevolution() {
  const [mode, setMode] = useState<DrawMode>("preset");
  const [points, setPoints] = useState<Pt[]>(() => getPreset("rectangle").points);
  const [closed, setClosed] = useState(true);
  const [presetId, setPresetId] = useState<PresetId | null>("rectangle");
  const [angle, setAngle] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [cameraResetKey, setCameraResetKey] = useState(0);
  const [message, setMessage] = useState(
    "예제 도형을 고르거나, 축 오른쪽에 단면을 그려 보세요.",
  );

  const rafRef = useRef<number | null>(null);
  const playStartRef = useRef<{ t: number; from: number } | null>(null);
  const presetIdRef = useRef(presetId);

  useEffect(() => {
    presetIdRef.current = presetId;
  }, [presetId]);

  const ready = isProfileReady(points);
  const lathePoints = ready ? sealProfileToAxis(points) : [];

  const stopPlay = useCallback(() => {
    setPlaying(false);
    playStartRef.current = null;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPlay(), [stopPlay]);

  useEffect(() => {
    if (!playing) return;
    const from = playStartRef.current?.from ?? 0;
    playStartRef.current = { t: performance.now(), from };

    const tick = (now: number) => {
      const start = playStartRef.current;
      if (!start) return;
      const elapsed = now - start.t;
      const span = 360 - start.from;
      const duration = Math.max(400, (span / 360) * ANIM_MS_PER_360);
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - (1 - t) ** 3;
      const next = start.from + span * eased;
      setAngle(clampAngle(next));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setPlaying(false);
        playStartRef.current = null;
        rafRef.current = null;
        const id = presetIdRef.current;
        setMessage(
          id
            ? getPreset(id).hint
            : "회전체가 완성됐어요. 오른쪽에서 돌려 보며 살펴보세요.",
        );
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing]);

  const onProfileChange = (next: Pt[], nextClosed: boolean) => {
    stopPlay();
    setPresetId(null);
    setPoints(next);
    setClosed(nextClosed);
    setAngle(0);
    if (nextClosed) {
      setMessage("단면이 완성됐어요. 각도를 조절하거나 「재생」을 눌러 보세요.");
    } else if (next.length === 0) {
      setMessage("축 오른쪽에 단면을 그려 보세요.");
    } else if (mode === "grid") {
      setMessage(
        "격자점을 이어 도형을 만드세요. 시작점에 다시 클릭하면 닫혀요.",
      );
    } else {
      setMessage("드래그로 단면을 그리세요. 그린 뒤 각도를 올려 보세요.");
    }
  };

  const applyPreset = (id: PresetId) => {
    stopPlay();
    const preset = getPreset(id);
    setMode("preset");
    setPresetId(id);
    setPoints(preset.points);
    setClosed(true);
    setAngle(0);
    setMessage(`${preset.label} 예제예요. 돌려서 ${preset.solidName}을(를) 확인해 보세요.`);
  };

  const clearProfile = () => {
    stopPlay();
    setPresetId(null);
    setPoints([]);
    setClosed(false);
    setAngle(0);
    setMessage(
      mode === "grid"
        ? "격자점을 클릭해 단면을 그리세요."
        : mode === "free"
          ? "축 오른쪽에서 드래그해 단면을 그리세요."
          : "예제 도형을 고르거나 그리기 모드를 바꿔 보세요.",
    );
  };

  const setDrawMode = (next: DrawMode) => {
    stopPlay();
    setMode(next);
    if (next === "preset") {
      applyPreset(presetId ?? "rectangle");
      return;
    }
    setPresetId(null);
    setPoints([]);
    setClosed(false);
    setAngle(0);
    setMessage(
      next === "grid"
        ? "격자점을 이어 도형을 만드세요. 시작점에 다시 클릭하면 닫혀요."
        : "축 오른쪽에서 드래그해 단면을 그리세요.",
    );
  };

  const makeFull = () => {
    if (!ready) {
      setMessage("먼저 단면을 완성해 주세요.");
      return;
    }
    stopPlay();
    setAngle(360);
    setMessage(
      presetId
        ? getPreset(presetId).hint
        : "회전체가 완성됐어요. 오른쪽에서 돌려 보며 살펴보세요.",
    );
  };

  const togglePlay = () => {
    if (!ready) {
      setMessage("먼저 단면을 완성해 주세요.");
      return;
    }
    if (playing) {
      stopPlay();
      setMessage("재생을 멈췄어요. 각도를 직접 조절할 수도 있어요.");
      return;
    }
    const from = angle >= 360 ? 0 : angle;
    if (from !== angle) setAngle(from);
    playStartRef.current = { t: performance.now(), from };
    setPlaying(true);
    setMessage("축을 중심으로 단면이 돌아가며 회전체가 만들어져요.");
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="quest-card bg-gradient-to-br from-mint/35 to-sky/25 p-5 sm:p-7">
        <p className="text-sm font-bold text-wood">중1 · 3.4 입체도형의 성질</p>
        <h1 className="font-display mt-1 text-3xl text-foreground sm:text-4xl">
          회전체 만들기
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground/75 sm:text-base">
          축의 한쪽에 평면도형을 그리고 돌리면 회전체가 됩니다. 각도를 천천히
          올려 형성 과정을 보고, 완성된 입체를 돌려 살펴보세요.{" "}
          <span className="font-semibold text-wood">연습 · 점수 없음</span>
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {(
            [
              ["preset", "예제 도형"],
              ["grid", "격자점"],
              ["free", "자유 그리기"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setDrawMode(id)}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                mode === id
                  ? "bg-mint/80 text-wood ring-2 ring-wood/20"
                  : "bg-white/70 text-wood/80 hover:bg-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "preset" ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                className={`rounded-xl px-3 py-1.5 text-sm font-bold ${
                  presetId === p.id
                    ? "bg-sky/70 text-wood"
                    : "bg-wood/10 text-wood hover:bg-wood/15"
                }`}
              >
                {p.label} → {p.solidName}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="quest-card p-4 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground/70">{message}</p>
          <p className="text-xs font-bold text-wood">
            회전각 {angle}°
            {presetId ? ` · ${getPreset(presetId).solidName}` : ""}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="overflow-hidden rounded-2xl bg-gradient-to-b from-[#FEF9F0] to-mint/20 ring-1 ring-wood/10">
            <div className="flex items-center justify-between border-b border-wood/10 px-3 py-2">
              <p className="text-xs font-bold text-wood">1. 단면 그리기</p>
              <button
                type="button"
                onClick={clearProfile}
                className="rounded-lg bg-wood/10 px-2.5 py-1 text-xs font-bold text-wood"
              >
                지우기
              </button>
            </div>
            <ProfileEditor
              mode={mode === "preset" ? "grid" : mode}
              points={points}
              closed={closed || mode === "preset"}
              onChange={onProfileChange}
              disabled={mode === "preset"}
            />
            <p className="px-3 pb-3 text-xs text-foreground/60">
              세로 축의 <span className="font-semibold text-wood">오른쪽</span>
              에만 그립니다. 격자 모드에서는 시작점을 다시 눌러 도형을 닫아요.
            </p>
          </div>

          <div className="flex min-h-[320px] flex-col overflow-hidden rounded-2xl bg-gradient-to-b from-[#FEF9F0] to-sky/20 ring-1 ring-wood/10">
            <div className="flex items-center justify-between border-b border-wood/10 px-3 py-2">
              <p className="text-xs font-bold text-wood">2. 회전체 탐구 (3D)</p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setWireframe((w) => !w)}
                  className="rounded-lg bg-wood/10 px-2.5 py-1 text-xs font-bold text-wood"
                >
                  {wireframe ? "면으로" : "선으로"}
                </button>
                <button
                  type="button"
                  onClick={() => setCameraResetKey((k) => k + 1)}
                  className="rounded-lg bg-wood/10 px-2.5 py-1 text-xs font-bold text-wood"
                >
                  시점 리셋
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 p-2">
              {ready ? (
                <RevolutionScene
                  points={lathePoints}
                  angleDeg={angle}
                  wireframe={wireframe}
                  cameraResetKey={cameraResetKey}
                />
              ) : (
                <div className="flex h-full min-h-[280px] items-center justify-center rounded-2xl bg-white/50 text-sm font-semibold text-wood/60">
                  단면을 그리면 여기에 회전체가 나타나요
                </div>
              )}
            </div>
            <p className="px-3 pb-3 text-xs text-foreground/60">
              드래그로 돌리고, 스크롤로 확대·축소하세요.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm font-semibold text-foreground/70">
            회전 각도
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={360}
                step={1}
                value={angle}
                disabled={!ready || playing}
                onChange={(e) => {
                  stopPlay();
                  const v = clampAngle(Number(e.target.value));
                  setAngle(v);
                  if (v >= 360 && presetId) {
                    setMessage(getPreset(presetId).hint);
                  }
                }}
                className="w-44 accent-[#4DB6A0] disabled:opacity-50 sm:w-56"
              />
              <span className="min-w-[3.5rem] rounded-xl bg-white/80 px-2 py-2 text-center text-base font-bold text-foreground">
                {angle}°
              </span>
            </div>
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={togglePlay}
              disabled={!ready}
              className="rounded-xl bg-mint/70 px-4 py-2 text-sm font-bold text-wood disabled:opacity-50"
            >
              {playing ? "일시정지" : angle >= 360 ? "다시 재생" : "재생"}
            </button>
            <button
              type="button"
              onClick={makeFull}
              disabled={!ready || playing}
              className="rounded-xl bg-sky/60 px-4 py-2 text-sm font-bold text-wood disabled:opacity-50"
            >
              한번에 만들기
            </button>
            <button
              type="button"
              onClick={() => {
                stopPlay();
                setAngle(0);
                setMessage("각도를 0°로 되돌렸어요. 다시 돌려 보세요.");
              }}
              disabled={!ready || playing || angle === 0}
              className="rounded-xl bg-wood/10 px-4 py-2 text-sm font-bold text-wood disabled:opacity-50"
            >
              각도 초기화
            </button>
          </div>
        </div>
      </section>

      <section className="quest-card bg-mint/15 p-5 sm:p-6">
        <p className="text-sm font-bold text-wood">탐구 힌트</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground/75">
          <li>직사각형 → 원기둥, 직각삼각형 → 원뿔, 반원 → 구를 먼저 확인해 보세요.</li>
          <li>각도를 조금씩 올리면 회전체가 “쌓이는” 느낌을 볼 수 있어요.</li>
          <li>같은 도형이라도 축과의 거리에 따라 생기는 입체가 달라져요.</li>
        </ul>
      </section>
    </div>
  );
}
