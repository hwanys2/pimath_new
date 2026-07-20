"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_DIVISIONS,
  DEFAULT_THETA,
  DISPLAY_RADIUS,
  MAX_DIVISIONS,
  MAX_THETA,
  MIN_DIVISIONS,
  MIN_THETA,
  arcLength,
  clampDivisions,
  clampTheta,
  easeOutCubic,
  formatNum,
  lerp,
  lerpAngle,
  pieceAngle,
  polar,
  rectWedgePose,
  rectangleDims,
  sectorArea,
  sectorWedgePose,
  wedgePath,
} from "@/lib/sector-area-math";

type Phase = "sector" | "animating" | "rectangle";

const COLOR_EVEN = "rgba(77, 182, 160, 0.78)"; // teal/mint
const COLOR_ODD = "rgba(125, 200, 245, 0.82)"; // sky
const COLOR_EVEN_STROKE = "#2A9D8F";
const COLOR_ODD_STROKE = "#4A90C8";

const VB_W = 640;
const VB_H = 520;
const SECTOR_R = 150;
const ANIM_MS = 1100;

function fitHalfAngleDeg(slotW: number, r: number): number {
  const ratio = Math.min(1, Math.max(0, slotW / (2 * r)));
  return (Math.asin(ratio) * 180) / Math.PI;
}

export default function SectorAreaRect() {
  const [thetaInput, setThetaInput] = useState(String(DEFAULT_THETA));
  const [theta, setTheta] = useState(DEFAULT_THETA);
  const [divisions, setDivisions] = useState(DEFAULT_DIVISIONS);
  const [phase, setPhase] = useState<Phase>("sector");
  const [progress, setProgress] = useState(0); // 0 = sector, 1 = rectangle
  const [message, setMessage] = useState(
    "중심각과 분할 수를 정한 뒤, 「직사각형으로 만들기」를 눌러 보세요.",
  );

  const rafRef = useRef<number | null>(null);
  const animating = phase === "animating";

  const r = DISPLAY_RADIUS;
  const ell = arcLength(theta, r);
  const area = sectorArea(theta, r);
  const dims = rectangleDims(theta, r);
  const alpha = pieceAngle(theta, divisions);

  // SVG layout
  const layout = useMemo(() => {
    const naturalRectW = (theta / 360) * Math.PI * SECTOR_R; // ℓ/2 in px
    const maxRectW = VB_W - 80;
    const scale = naturalRectW > maxRectW ? maxRectW / naturalRectW : 1;
    const R = SECTOR_R * scale;
    const rectW = naturalRectW * scale;
    const rectH = R;

    const sectorCx = VB_W / 2;
    const sectorCy = 56 + R;

    const rectLeft = (VB_W - rectW) / 2;
    // Place rectangle so it stays in view; during sector phase still compute target
    const rectTop = Math.min(VB_H - rectH - 70, sectorCy - R * 0.15);

    return { R, rectW, rectH, sectorCx, sectorCy, rectLeft, rectTop, scale };
  }, [theta]);

  const stopAnim = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => () => stopAnim(), [stopAnim]);

  const applyTheta = useCallback(() => {
    const next = clampTheta(Number.parseFloat(thetaInput));
    setThetaInput(String(next));
    setTheta(next);
    stopAnim();
    setPhase("sector");
    setProgress(0);
    setMessage(
      `중심각 ${next}° 부채꼴이에요. 분할 수를 바꾼 뒤 직사각형으로 만들어 보세요.`,
    );
  }, [thetaInput, stopAnim]);

  const onDivisionsChange = useCallback(
    (raw: number) => {
      const next = clampDivisions(raw);
      setDivisions(next);
      stopAnim();
      setPhase("sector");
      setProgress(0);
      setMessage(
        `${next}등분했어요. 홀수·짝수 조각 색깔이 달라요. 직사각형으로 옮겨 볼까요?`,
      );
    },
    [stopAnim],
  );

  const reset = useCallback(() => {
    stopAnim();
    setTheta(DEFAULT_THETA);
    setThetaInput(String(DEFAULT_THETA));
    setDivisions(DEFAULT_DIVISIONS);
    setPhase("sector");
    setProgress(0);
    setMessage(
      "중심각과 분할 수를 정한 뒤, 「직사각형으로 만들기」를 눌러 보세요.",
    );
  }, [stopAnim]);

  const animateTo = useCallback(
    (target: 0 | 1, onDone: () => void, doneMessage: string) => {
      stopAnim();
      setPhase("animating");
      const from = target === 1 ? 0 : 1;
      setProgress(from);
      const start = performance.now();

      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / ANIM_MS);
        const eased = easeOutCubic(t);
        setProgress(from + (target - from) * eased);
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          setProgress(target);
          setPhase(target === 1 ? "rectangle" : "sector");
          setMessage(doneMessage);
          onDone();
          rafRef.current = null;
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [stopAnim],
  );

  const toRectangle = useCallback(() => {
    if (animating) return;
    animateTo(
      1,
      () => {},
      `직사각형이 됐어요! 세로는 반지름 r, 가로는 호의 절반 ℓ/2 에 가까워요. 분할을 늘리면 더 반듯해져요.`,
    );
  }, [animating, animateTo]);

  const toSector = useCallback(() => {
    if (animating) return;
    animateTo(
      0,
      () => {},
      "다시 부채꼴 모양이에요. 분할 수나 중심각을 바꿔 비교해 보세요.",
    );
  }, [animating, animateTo]);

  const wedges = useMemo(() => {
    const { R, rectW, rectH, sectorCx, sectorCy, rectLeft, rectTop } = layout;
    const slotW = rectW / divisions;
    const trueHalf = alpha / 2;
    const fitHalf = fitHalfAngleDeg(slotW, R);
    const t = progress;

    // Keep true sector shape while moving; ease into fitted angle only at the end
    // so pieces appear to slide/rotate "as-is", then settle into the rectangle.
    const morphT = t < 0.72 ? 0 : (t - 0.72) / 0.28;

    return Array.from({ length: divisions }, (_, i) => {
      const s = sectorWedgePose(i, theta, divisions, sectorCx, sectorCy);
      const q = rectWedgePose(i, divisions, rectLeft, rectTop, rectW, rectH);
      const ax = lerp(s.ax, q.ax, t);
      const ay = lerp(s.ay, q.ay, t);
      const bisectorDeg = lerpAngle(s.bisectorDeg, q.bisectorDeg, t);
      const half = lerp(trueHalf, fitHalf, morphT);
      const d = wedgePath(ax, ay, bisectorDeg, half, R);
      const even = i % 2 === 0;
      return { i, d, even, ax, ay, bisectorDeg };
    });
  }, [layout, divisions, alpha, progress, theta]);

  const showFormula = phase === "rectangle" || progress > 0.92;

  return (
    <div className="flex flex-col gap-6">
      <section className="quest-card bg-gradient-to-br from-mint/35 to-sky/25 p-5 sm:p-7">
        <p className="text-sm font-bold text-wood">중1 · 3.3 평면도형의 성질</p>
        <h1 className="font-display mt-1 text-3xl text-foreground sm:text-4xl">
          부채꼴을 직사각형으로
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground/75 sm:text-base">
          부채꼴을 작게 나눠 홀짝으로 엇갈려 붙이면 직사각형에 가까워져요. 세로가
          반지름, 가로가 호의 절반임을 보고 넓이 공식{" "}
          <span className="font-semibold text-wood">½ × r × ℓ</span> 을 유추해
          보세요. 점수는 없는 탐구용 시뮬레이션입니다.
        </p>

        <div className="mt-5 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm font-semibold text-foreground/70">
            중심각 θ (도)
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={MIN_THETA}
                max={MAX_THETA}
                step={1}
                value={theta}
                disabled={animating}
                onChange={(e) => {
                  const v = clampTheta(Number(e.target.value));
                  setTheta(v);
                  setThetaInput(String(v));
                  stopAnim();
                  setPhase("sector");
                  setProgress(0);
                  setMessage(`중심각 ${v}° 로 바꿨어요.`);
                }}
                className="w-36 accent-[#4DB6A0] disabled:opacity-50 sm:w-44"
              />
              <input
                type="number"
                min={MIN_THETA}
                max={MAX_THETA}
                value={thetaInput}
                disabled={animating}
                onChange={(e) => setThetaInput(e.target.value)}
                onBlur={applyTheta}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyTheta();
                }}
                className="w-20 rounded-xl border-2 border-wood/20 bg-white/80 px-2 py-2 text-base font-bold text-foreground outline-none focus:border-mint disabled:opacity-50"
              />
              <span className="text-sm font-bold text-wood">°</span>
            </div>
          </label>

          <label className="flex flex-col gap-1 text-sm font-semibold text-foreground/70">
            분할 수 n (짝수)
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={MIN_DIVISIONS}
                max={MAX_DIVISIONS}
                step={2}
                value={divisions}
                disabled={animating}
                onChange={(e) => onDivisionsChange(Number(e.target.value))}
                className="w-36 accent-[#7EC8F5] disabled:opacity-50 sm:w-44"
              />
              <span className="min-w-[2.5rem] rounded-xl bg-white/80 px-2 py-2 text-center text-base font-bold text-foreground">
                {divisions}
              </span>
            </div>
          </label>

          <div className="flex flex-wrap gap-2">
            {phase !== "rectangle" ? (
              <button
                type="button"
                onClick={toRectangle}
                disabled={animating}
                className="rounded-xl bg-mint/70 px-4 py-2 text-sm font-bold text-wood disabled:opacity-50"
              >
                직사각형으로 만들기
              </button>
            ) : (
              <button
                type="button"
                onClick={toSector}
                disabled={animating}
                className="rounded-xl bg-sky/60 px-4 py-2 text-sm font-bold text-wood disabled:opacity-50"
              >
                다시 부채꼴로
              </button>
            )}
            <button
              type="button"
              onClick={reset}
              disabled={animating}
              className="rounded-xl bg-wood/10 px-4 py-2 text-sm font-bold text-wood disabled:opacity-50"
            >
              처음부터
            </button>
          </div>
        </div>
      </section>

      <section className="quest-card p-4 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground/70">{message}</p>
          <p className="text-xs font-bold text-wood">
            θ = {theta}° · n = {divisions} · 조각각 {formatNum(alpha, 1)}°
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl bg-gradient-to-b from-[#FEF9F0] to-mint/20 ring-1 ring-wood/10">
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            className="mx-auto h-auto w-full max-w-3xl"
            role="img"
            aria-label={
              phase === "rectangle"
                ? "부채꼴 조각이 직사각형으로 배열된 모습"
                : "부채꼴이 작은 조각으로 나뉜 모습"
            }
          >
            {/* Soft guides */}
            {progress < 0.5 ? (
              <circle
                cx={layout.sectorCx}
                cy={layout.sectorCy}
                r={layout.R + 14}
                fill="rgba(157, 232, 200, 0.18)"
              />
            ) : null}

            {progress > 0.55 ? (
              <rect
                x={layout.rectLeft}
                y={layout.rectTop}
                width={layout.rectW}
                height={layout.rectH}
                rx={4}
                fill="none"
                stroke="rgba(92, 64, 51, 0.28)"
                strokeWidth={2}
                strokeDasharray="6 5"
                opacity={Math.min(1, (progress - 0.55) / 0.35)}
              />
            ) : null}

            {wedges.map(({ i, d, even }) => (
              <path
                key={i}
                d={d}
                fill={even ? COLOR_EVEN : COLOR_ODD}
                stroke={even ? COLOR_EVEN_STROKE : COLOR_ODD_STROKE}
                strokeWidth={1.4}
                strokeLinejoin="round"
              />
            ))}

            {/* Sector labels (early phase) */}
            {progress < 0.35 ? (
              <g opacity={1 - progress / 0.35}>
                <line
                  x1={layout.sectorCx}
                  y1={layout.sectorCy}
                  x2={polar(layout.sectorCx, layout.sectorCy, 90, layout.R).x}
                  y2={polar(layout.sectorCx, layout.sectorCy, 90, layout.R).y}
                  stroke="#5C4033"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  opacity={0.45}
                />
                <text
                  x={layout.sectorCx + 10}
                  y={layout.sectorCy - layout.R * 0.45}
                  fill="#5C4033"
                  fontSize={18}
                  fontWeight={700}
                  fontFamily="inherit"
                >
                  r
                </text>
                {/* Arc label near outer rim */}
                <text
                  x={layout.sectorCx}
                  y={layout.sectorCy - layout.R - 22}
                  textAnchor="middle"
                  fill="#5C4033"
                  fontSize={16}
                  fontWeight={700}
                >
                  {`θ = ${theta}°`}
                </text>
                <text
                  x={layout.sectorCx}
                  y={layout.sectorCy - layout.R - 4}
                  textAnchor="middle"
                  fill="#5C4033"
                  fontSize={14}
                  fontWeight={600}
                  opacity={0.75}
                >
                  {`호 ℓ`}
                </text>
              </g>
            ) : null}

            {/* Rectangle dimension labels */}
            {progress > 0.7 ? (
              <g opacity={Math.min(1, (progress - 0.7) / 0.25)}>
                {/* Height bracket (r) */}
                <line
                  x1={layout.rectLeft - 18}
                  y1={layout.rectTop}
                  x2={layout.rectLeft - 18}
                  y2={layout.rectTop + layout.rectH}
                  stroke="#5C4033"
                  strokeWidth={2}
                />
                <line
                  x1={layout.rectLeft - 24}
                  y1={layout.rectTop}
                  x2={layout.rectLeft - 12}
                  y2={layout.rectTop}
                  stroke="#5C4033"
                  strokeWidth={2}
                />
                <line
                  x1={layout.rectLeft - 24}
                  y1={layout.rectTop + layout.rectH}
                  x2={layout.rectLeft - 12}
                  y2={layout.rectTop + layout.rectH}
                  stroke="#5C4033"
                  strokeWidth={2}
                />
                <text
                  x={layout.rectLeft - 32}
                  y={layout.rectTop + layout.rectH / 2 + 5}
                  textAnchor="end"
                  fill="#5C4033"
                  fontSize={18}
                  fontWeight={700}
                >
                  r
                </text>

                {/* Width bracket (ℓ/2) */}
                <line
                  x1={layout.rectLeft}
                  y1={layout.rectTop + layout.rectH + 22}
                  x2={layout.rectLeft + layout.rectW}
                  y2={layout.rectTop + layout.rectH + 22}
                  stroke="#5C4033"
                  strokeWidth={2}
                />
                <line
                  x1={layout.rectLeft}
                  y1={layout.rectTop + layout.rectH + 16}
                  x2={layout.rectLeft}
                  y2={layout.rectTop + layout.rectH + 28}
                  stroke="#5C4033"
                  strokeWidth={2}
                />
                <line
                  x1={layout.rectLeft + layout.rectW}
                  y1={layout.rectTop + layout.rectH + 16}
                  x2={layout.rectLeft + layout.rectW}
                  y2={layout.rectTop + layout.rectH + 28}
                  stroke="#5C4033"
                  strokeWidth={2}
                />
                <text
                  x={layout.rectLeft + layout.rectW / 2}
                  y={layout.rectTop + layout.rectH + 42}
                  textAnchor="middle"
                  fill="#5C4033"
                  fontSize={17}
                  fontWeight={700}
                >
                  ℓ / 2
                </text>
              </g>
            ) : null}
          </svg>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-foreground/65">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ background: COLOR_EVEN }}
            />
            홀수 번째 조각
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ background: COLOR_ODD }}
            />
            짝수 번째 조각
          </span>
          <span className="text-wood/70">
            r = {r} (표시 단위) · ℓ ≈ {formatNum(ell)} · 넓이 ≈{" "}
            {formatNum(area)}
          </span>
        </div>
      </section>

      {showFormula ? (
        <section
          className="quest-card border-mint/40 bg-gradient-to-br from-mint/45 via-sky/25 to-gold/25 p-5 sm:p-7"
          role="status"
          aria-live="polite"
        >
          <p className="font-display text-2xl text-wood sm:text-3xl">
            넓이 공식 유추하기
          </p>
          <ol className="mt-4 space-y-3 text-sm leading-relaxed text-foreground/80 sm:text-base">
            <li>
              <span className="font-bold text-wood">1.</span> 직사각형의 세로 ≈{" "}
              <span className="font-bold">r</span> (반지름), 가로 ≈{" "}
              <span className="font-bold">ℓ / 2</span> (호의 길이의 절반)
            </li>
            <li>
              <span className="font-bold text-wood">2.</span> 넓이 ≈ 가로 × 세로 ={" "}
              <span className="font-bold">
                r × (ℓ / 2) = ½ r ℓ
              </span>
            </li>
            <li>
              <span className="font-bold text-wood">3.</span> 호의 길이{" "}
              <span className="font-bold">
                ℓ = (θ / 360°) × 2πr
              </span>{" "}
              를 넣으면
              <br />
              <span className="mt-1 inline-block rounded-xl bg-white/70 px-3 py-2 font-bold text-wood">
                부채꼴의 넓이 = (θ / 360°) × πr²
              </span>
            </li>
          </ol>
          <p className="mt-4 text-sm font-semibold text-foreground/70">
            지금 값: θ = {theta}°, r = {r}, ℓ ≈ {formatNum(ell)}, ℓ/2 ≈{" "}
            {formatNum(dims.width)}, 넓이 ≈ {formatNum(area)}
            {divisions >= 24
              ? " · 분할이 많아서 윗·아랫변이 거의 직선이에요!"
              : " · 분할 수를 키우면 더 반듯한 직사각형에 가까워져요."}
          </p>
        </section>
      ) : (
        <section className="quest-card bg-mint/15 p-5 sm:p-6">
          <p className="text-sm font-bold text-wood">탐구 힌트</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground/75">
            <li>분할 수를 크게 할수록 윗변·아랫변이 직선에 가까워져요.</li>
            <li>직사각형이 된 뒤 가로·세로가 각각 무엇과 같은지 살펴보세요.</li>
            <li>중심각을 360°로 두면 원 전체의 넓이(πr²)와도 연결돼요.</li>
          </ul>
        </section>
      )}
    </div>
  );
}
