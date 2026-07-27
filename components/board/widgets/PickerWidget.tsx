"use client";

import { useMemo, useRef, useState } from "react";
import type { ClassRoster } from "../types";

type Props = {
  state: Record<string, unknown>;
  setState: (patch: Record<string, unknown>) => void;
  rosters: ClassRoster[];
};

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export default function PickerWidget({ state, setState, rosters }: Props) {
  const sourceId = (state.sourceId as string) ?? "manual";
  const manualText = (state.manualText as string) ?? "";
  const excludeDrawn = (state.excludeDrawn as boolean) ?? true;
  const drawn = (state.drawn as string[]) ?? [];
  const tab = (state.tab as string) ?? "draw";
  const teamCount = (state.teamCount as number) ?? 4;

  const [current, setCurrent] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [teams, setTeams] = useState<string[][] | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const roster = rosters.find((r) => r.id === sourceId) ?? null;
  const names = useMemo(() => {
    const raw = roster
      ? roster.students
      : manualText.split(/[\n,]+/).map((s) => s.trim());
    return [...new Set(raw.filter((s) => s.length > 0))];
  }, [roster, manualText]);

  const pool = excludeDrawn ? names.filter((n) => !drawn.includes(n)) : names;

  const draw = () => {
    if (spinning || pool.length === 0) return;
    setSpinning(true);
    const started = Date.now();
    timerRef.current = setInterval(() => {
      setCurrent(pool[Math.floor(Math.random() * pool.length)]);
      if (Date.now() - started > 1100 && timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        const picked = pool[Math.floor(Math.random() * pool.length)];
        setCurrent(picked);
        setState({ drawn: [...drawn, picked] });
        setSpinning(false);
      }
    }, 65);
  };

  const makeTeams = () => {
    if (names.length === 0) return;
    const count = Math.max(2, Math.min(teamCount, names.length));
    const shuffled = shuffle(names);
    const result: string[][] = Array.from({ length: count }, () => []);
    shuffled.forEach((name, i) => result[i % count].push(name));
    setTeams(result);
  };

  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className="flex gap-1 rounded-xl bg-black/5 p-1">
        {[
          ["draw", "한 명 뽑기"],
          ["team", "모둠 짜기"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setState({ tab: key })}
            className={`font-display flex-1 rounded-lg px-2 py-1 text-sm transition ${
              tab === key ? "bg-wood text-cream shadow" : "text-wood hover:bg-black/5"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <select
          value={sourceId}
          onChange={(e) => {
            setState({ sourceId: e.target.value, drawn: [] });
            setCurrent(null);
            setTeams(null);
          }}
          className="min-w-0 flex-1 rounded-lg border-2 border-black/10 bg-white px-2 py-1.5 text-sm font-semibold"
          aria-label="명단 선택"
        >
          <option value="manual">직접 입력</option>
          {rosters.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.students.length}명)
            </option>
          ))}
        </select>
        <span className="shrink-0 text-xs font-semibold text-wood">
          {names.length}명
        </span>
      </div>

      {sourceId === "manual" ? (
        <textarea
          value={manualText}
          onChange={(e) => setState({ manualText: e.target.value })}
          placeholder={"이름을 줄바꿈이나 쉼표로 구분해 입력하세요\n예) 김수학, 이도형, 박함수"}
          className="h-16 shrink-0 resize-none rounded-xl border-2 border-black/10 bg-white px-3 py-2 text-sm"
        />
      ) : null}

      {tab === "draw" ? (
        <>
          <div
            className="flex min-h-0 flex-1 items-center justify-center rounded-xl bg-[#f6f1e7] px-2"
            style={{ containerType: "size" }}
          >
            <span
              className={`font-display max-w-full truncate text-center ${
                spinning ? "text-wood/50" : "text-[#3d2c1e]"
              }`}
              style={{ fontSize: "min(18cqw, 52cqh)", lineHeight: 1.15 }}
            >
              {current ?? (names.length > 0 ? "두구두구..." : "명단이 비었어요")}
            </span>
          </div>
          {drawn.length > 0 ? (
            <p className="max-h-12 overflow-auto text-xs leading-relaxed text-wood">
              뽑힌 사람({drawn.length}): {drawn.join(", ")}
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={draw}
              disabled={spinning || pool.length === 0}
              className="font-display flex-1 rounded-xl bg-gold px-3 py-2 text-base text-[#6b4a00] shadow-[0_3px_0_rgba(107,74,0,0.3)] transition hover:brightness-105 active:translate-y-0.5 disabled:opacity-60"
            >
              {pool.length === 0 && names.length > 0 ? "모두 뽑았어요" : "뽑기"}
            </button>
            <label className="flex shrink-0 items-center gap-1 text-xs font-semibold text-wood">
              <input
                type="checkbox"
                checked={excludeDrawn}
                onChange={(e) => setState({ excludeDrawn: e.target.checked })}
              />
              중복 제외
            </label>
            <button
              type="button"
              onClick={() => {
                setState({ drawn: [] });
                setCurrent(null);
              }}
              className="font-display rounded-xl bg-black/10 px-3 py-2 text-sm text-[#3d2c1e] transition hover:bg-black/15"
            >
              초기화
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-auto rounded-xl bg-[#f6f1e7] p-2">
            {teams ? (
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                {teams.map((team, i) => (
                  <div
                    key={i}
                    className="rounded-lg border-2 border-wood/15 bg-white p-2"
                  >
                    <p className="font-display mb-1 text-sm text-wood">
                      {i + 1}모둠
                    </p>
                    <p className="text-sm leading-relaxed font-semibold text-[#3d2c1e]">
                      {team.join(", ")}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="flex h-full items-center justify-center text-sm text-wood/70">
                모둠 수를 정하고 버튼을 누르세요
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-wood">
              모둠 수
              <input
                type="number"
                min={2}
                max={12}
                value={teamCount}
                onChange={(e) => setState({ teamCount: Number(e.target.value) })}
                className="w-16 rounded-lg border-2 border-black/10 bg-white px-2 py-1 text-center"
              />
            </label>
            <button
              type="button"
              onClick={makeTeams}
              disabled={names.length === 0}
              className="font-display flex-1 rounded-xl bg-mint px-3 py-2 text-base text-[#1a5c42] shadow-[0_3px_0_rgba(26,92,66,0.25)] transition hover:brightness-105 active:translate-y-0.5 disabled:opacity-60"
            >
              모둠 만들기
            </button>
          </div>
        </>
      )}
    </div>
  );
}
