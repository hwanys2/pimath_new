"use client";

import type { ReactNode } from "react";
import type { Seal, SealScene } from "@/lib/starlight-seal-math";

type Props = {
  seal: Seal;
  scene: SealScene;
  /** Highlight correct solution geometry. */
  showSolution?: boolean;
  /** Selected chord/option id for multi-chords. */
  selectedId?: string | null;
  onSelectChord?: (id: string) => void;
  /** Flash sealed success. */
  sealed?: boolean;
  /** Preview mode (student guess drawn). */
  preview?: boolean;
};

const CX = 160;
const CY = 140;
const VIEW = "0 0 320 280";

function MagCircle({
  r,
  sealed,
}: {
  r: number;
  sealed?: boolean;
}) {
  const scale = Math.min(90, 90);
  const pr = scale; // visual radius fixed; labels show real r
  return (
    <g>
      <circle
        cx={CX}
        cy={CY}
        r={pr + 8}
        fill="none"
        stroke="#D4C4FF"
        strokeWidth={1.5}
        strokeDasharray="4 6"
        opacity={0.55}
      />
      <circle
        cx={CX}
        cy={CY}
        r={pr}
        fill={sealed ? "rgba(255,215,106,0.25)" : "rgba(184,160,232,0.18)"}
        stroke={sealed ? "#FFD76A" : "#B8A0E8"}
        strokeWidth={sealed ? 3 : 2.5}
      />
      <circle cx={CX} cy={CY} r={4} fill="#8B5E3C" />
      <text
        x={CX + 8}
        y={CY - 6}
        fontSize={11}
        fontWeight={700}
        fill="#8B5E3C"
      >
        O
      </text>
      {/* keep r in data for a11y */}
      <title>{`반지름 ${r}`}</title>
    </g>
  );
}

function Label({
  x,
  y,
  children,
  accent,
}: {
  x: number;
  y: number;
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontSize={12}
      fontWeight={800}
      fill={accent ? "#7c3aed" : "#5c4030"}
    >
      {children}
    </text>
  );
}

function ChordPerpendicularScene({
  scene,
  showSolution,
  sealed,
  preview,
}: {
  scene: Extract<SealScene, { kind: "chord-perpendicular" }>;
  showSolution?: boolean;
  sealed?: boolean;
  preview?: boolean;
}) {
  const pr = 90;
  const ratio = pr / Math.max(scene.r, 1);
  const dVis = Math.min(pr - 8, Math.max(0, scene.d * ratio));
  // When previewing chord length, draw chord from guessed half; else from geometry.
  const halfFromGeom = Math.sqrt(Math.max(0, pr * pr - dVis * dVis));
  const halfVis =
    preview && scene.solveFor === "chordLen"
      ? Math.min(pr * 1.1, Math.max(4, (scene.halfChord / Math.max(scene.r, 1)) * pr))
      : halfFromGeom;
  const ax = CX - halfVis;
  const bx = CX + halfVis;
  // When previewing d, place chord at guessed distance (may leave circle).
  const dDraw =
    preview && scene.solveFor === "d"
      ? Math.min(pr + 20, Math.max(0, scene.d * ratio))
      : dVis;
  const ay = CY + dDraw;
  const by = CY + dDraw;
  const mx = CX;
  const my = ay;

  // When previewing r, scale circle slightly via MagCircle title only;
  // visual radius stays fixed but we can tint.
  const showChordLen =
    preview || showSolution || sealed || scene.solveFor !== "chordLen";
  const showR = preview || showSolution || sealed || scene.solveFor !== "r";
  const showD = preview || showSolution || sealed || scene.solveFor !== "d";

  return (
    <g>
      <MagCircle r={scene.r} sealed={sealed} />
      <line
        x1={ax}
        y1={ay}
        x2={bx}
        y2={by}
        stroke={preview ? "#e85d4c" : sealed ? "#FFD76A" : "#7c3aed"}
        strokeWidth={3.5}
        strokeLinecap="round"
      />
      <line
        x1={CX}
        y1={CY}
        x2={mx}
        y2={my}
        stroke="#8B5E3C"
        strokeWidth={1.8}
        strokeDasharray={showSolution ? undefined : "3 3"}
      />
      {showSolution ? (
        <>
          <line
            x1={CX}
            y1={CY}
            x2={bx}
            y2={by}
            stroke="#5EC4B0"
            strokeWidth={2}
            opacity={0.85}
          />
          <path
            d={`M ${mx} ${my - 10} L ${mx + 10} ${my - 10} L ${mx + 10} ${my}`}
            fill="none"
            stroke="#8B5E3C"
            strokeWidth={1.5}
          />
        </>
      ) : null}
      <circle cx={ax} cy={ay} r={3.5} fill="#7c3aed" />
      <circle cx={bx} cy={by} r={3.5} fill="#7c3aed" />
      <Label x={(ax + bx) / 2} y={ay + 18} accent={preview || !showChordLen}>
        {showChordLen ? scene.chordLen : "?"}
      </Label>
      <Label x={CX - 14} y={(CY + my) / 2} accent={!showD}>
        {showD ? scene.d : "?"}
      </Label>
      <Label x={CX + pr * 0.65} y={CY - pr * 0.55} accent={!showR}>
        r={showR ? scene.r : "?"}
      </Label>
    </g>
  );
}

function MultiChordsSceneView({
  scene,
  selectedId,
  onSelectChord,
  sealed,
  showSolution,
}: {
  scene: Extract<SealScene, { kind: "multi-chords" }>;
  selectedId?: string | null;
  onSelectChord?: (id: string) => void;
  sealed?: boolean;
  showSolution?: boolean;
}) {
  const pr = 90;
  const n = scene.chords.length;
  return (
    <g>
      <MagCircle r={scene.r} sealed={sealed} />
      {scene.chords.map((ch, i) => {
        const angle = ((i - (n - 1) / 2) * 28 * Math.PI) / 180;
        const dRatio = Math.min(0.85, ch.dist / Math.max(scene.r, 1));
        const dVis = pr * dRatio;
        const halfVis = Math.sqrt(Math.max(4, pr * pr - dVis * dVis)) * 0.85;
        const ca = Math.cos(angle);
        const sa = Math.sin(angle);
        // Chord perpendicular to radius direction `angle`
        const mx = CX + dVis * sa;
        const my = CY + dVis * ca;
        const dx = halfVis * ca;
        const dy = -halfVis * sa;
        const x1 = mx - dx;
        const y1 = my - dy;
        const x2 = mx + dx;
        const y2 = my + dy;
        const selected = selectedId === ch.id;
        const colors = ["#7c3aed", "#5EC4B0", "#e85d4c", "#FFD76A"];
        const stroke = colors[i % colors.length]!;
        return (
          <g key={ch.id}>
            {/* Wide hit area */}
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="transparent"
              strokeWidth={22}
              strokeLinecap="round"
              style={{ cursor: onSelectChord ? "pointer" : "default" }}
              onClick={() => onSelectChord?.(ch.id)}
            />
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={selected || (showSolution && selectedId === ch.id) ? "#FFD76A" : stroke}
              strokeWidth={selected ? 5 : 3}
              strokeLinecap="round"
              opacity={0.95}
              style={{ cursor: onSelectChord ? "pointer" : "default" }}
              onClick={() => onSelectChord?.(ch.id)}
            />
            <Label x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 10} accent={selected}>
              {ch.label}
            </Label>
            <Label x={mx + 18 * sa} y={my + 18 * ca}>
              {scene.mode === "longest" || scene.mode === "equal-pick"
                ? `d=${ch.dist}`
                : `ℓ=${ch.chordLen}`}
            </Label>
          </g>
        );
      })}
    </g>
  );
}

function TwoTangentsSceneView({
  scene,
  showSolution,
  sealed,
  preview,
}: {
  scene: Extract<SealScene, { kind: "two-tangents" }>;
  showSolution?: boolean;
  sealed?: boolean;
  preview?: boolean;
}) {
  const pr = 70;
  const poVis = 130;
  const px = CX;
  const py = CY + poVis;
  // Touch points roughly left/right
  const ax = CX - pr * 0.85;
  const ay = CY + pr * 0.5;
  const bx = CX + pr * 0.85;
  const by = CY + pr * 0.5;

  const showPa =
    preview ||
    showSolution ||
    sealed ||
    scene.solveFor === "judge" ||
    scene.solveFor === "angleAob" ||
    scene.solveFor === "anglePab" ||
    scene.solveFor !== "pa";
  const showPo =
    preview ||
    showSolution ||
    sealed ||
    scene.solveFor === "judge" ||
    scene.solveFor !== "po";
  const showR =
    preview ||
    showSolution ||
    sealed ||
    scene.solveFor === "judge" ||
    scene.solveFor !== "r";

  return (
    <g>
      <MagCircle r={scene.r} sealed={sealed} />
      <line
        x1={CX}
        y1={CY}
        x2={ax}
        y2={ay}
        stroke="#8B5E3C"
        strokeWidth={1.6}
      />
      <line
        x1={CX}
        y1={CY}
        x2={bx}
        y2={by}
        stroke="#8B5E3C"
        strokeWidth={1.6}
      />
      <line
        x1={px}
        y1={py}
        x2={ax}
        y2={ay}
        stroke={preview ? "#e85d4c" : "#7c3aed"}
        strokeWidth={3}
        strokeLinecap="round"
      />
      {!scene.hidePb ? (
        <line
          x1={px}
          y1={py}
          x2={bx}
          y2={by}
          stroke="#5EC4B0"
          strokeWidth={3}
          strokeLinecap="round"
        />
      ) : (
        <line
          x1={px}
          y1={py}
          x2={bx}
          y2={by}
          stroke="#B8A0E8"
          strokeWidth={2}
          strokeDasharray="4 4"
          opacity={0.6}
        />
      )}
      <line
        x1={CX}
        y1={CY}
        x2={px}
        y2={py}
        stroke="#8B5E3C"
        strokeWidth={1.4}
        strokeDasharray="3 3"
      />
      {scene.showRightAngle || showSolution ? (
        <path
          d={`M ${ax + 8} ${ay} L ${ax + 8} ${ay + 8} L ${ax} ${ay + 8}`}
          fill="none"
          stroke="#8B5E3C"
          strokeWidth={1.4}
        />
      ) : null}
      <circle cx={ax} cy={ay} r={3.5} fill="#7c3aed" />
      <circle cx={bx} cy={by} r={3.5} fill="#5EC4B0" />
      <circle cx={px} cy={py} r={4} fill="#8B5E3C" />
      <Label x={ax - 10} y={ay - 8}>
        A
      </Label>
      <Label x={bx + 10} y={by - 8}>
        B
      </Label>
      <Label x={px} y={py + 16}>
        P
      </Label>
      {(scene.showPaLabel || preview || !showPa) && (
        <Label x={(px + ax) / 2 - 12} y={(py + ay) / 2} accent={preview || !showPa}>
          {showPa ? scene.pa : "?"}
        </Label>
      )}
      {!scene.hidePb && (
        <Label x={(px + bx) / 2 + 12} y={(py + by) / 2}>
          {showPa ? scene.pa : "?"}
        </Label>
      )}
      <Label x={CX + 20} y={CY + poVis * 0.45} accent={!showPo}>
        PO={showPo ? scene.po : "?"}
      </Label>
      <Label x={CX + pr + 8} y={CY - 4} accent={!showR}>
        r={showR ? scene.r : "?"}
      </Label>
      {scene.angleApb != null ? (
        <Label x={px} y={py - 24} accent>
          ∠APB={scene.angleApb}°
        </Label>
      ) : null}
    </g>
  );
}

function IncircleTriangleView({
  scene,
  sealed,
  showSolution,
}: {
  scene: Extract<SealScene, { kind: "incircle-triangle" }>;
  sealed?: boolean;
  showSolution?: boolean;
}) {
  const [a, b, c] = scene.sides;
  // Place triangle roughly: A top, B bottom-left, C bottom-right
  const Ax = 160;
  const Ay = 40;
  const Bx = 50;
  const By = 230;
  const Cx = 270;
  const Cy = 230;
  // Incenter approx (visual center)
  const ix = (Ax + Bx + Cx) / 3;
  const iy = (Ay + By + Cy) / 3 + 10;
  const ir = 28;

  return (
    <g>
      <polygon
        points={`${Ax},${Ay} ${Bx},${By} ${Cx},${Cy}`}
        fill="rgba(184,160,232,0.12)"
        stroke="#B8A0E8"
        strokeWidth={2.5}
      />
      <circle
        cx={ix}
        cy={iy}
        r={ir}
        fill={sealed ? "rgba(255,215,106,0.25)" : "rgba(94,196,176,0.2)"}
        stroke={sealed ? "#FFD76A" : "#5EC4B0"}
        strokeWidth={2}
      />
      {/* tangent ticks visual */}
      <line
        x1={ix}
        y1={iy + ir}
        x2={ix}
        y2={By}
        stroke="#8B5E3C"
        strokeWidth={1}
        strokeDasharray="2 2"
        opacity={0.5}
      />
      <Label x={Ax} y={Ay - 8}>
        A
      </Label>
      <Label x={Bx - 10} y={By + 14}>
        B
      </Label>
      <Label x={Cx + 10} y={Cy + 14}>
        C
      </Label>
      <Label x={(Bx + Cx) / 2} y={By + 16}>
        BC={a}
      </Label>
      <Label x={(Ax + Cx) / 2 + 18} y={(Ay + Cy) / 2}>
        CA={b}
      </Label>
      <Label x={(Ax + Bx) / 2 - 18} y={(Ay + By) / 2}>
        AB={c}
      </Label>
      {showSolution ? (
        <Label x={ix} y={iy - ir - 8} accent>
          x={scene.tangents[0]}, y={scene.tangents[1]}, z={scene.tangents[2]}
        </Label>
      ) : (
        <Label x={ix} y={iy + 4} accent>
          {scene.askLabel}
        </Label>
      )}
    </g>
  );
}

function CircumQuadView({
  scene,
  sealed,
}: {
  scene: Extract<SealScene, { kind: "circum-quad" }>;
  sealed?: boolean;
}) {
  const pts = [
    [90, 50],
    [250, 60],
    [260, 220],
    [70, 210],
  ] as const;
  const labels = ["AB", "BC", "CD", "DA"] as const;
  const mid = (i: number) => {
    const a = pts[i]!;
    const b = pts[(i + 1) % 4]!;
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const;
  };
  return (
    <g>
      <polygon
        points={pts.map((p) => p.join(",")).join(" ")}
        fill="rgba(184,160,232,0.12)"
        stroke="#B8A0E8"
        strokeWidth={2.5}
      />
      <circle
        cx={160}
        cy={135}
        r={48}
        fill={sealed ? "rgba(255,215,106,0.25)" : "rgba(94,196,176,0.18)"}
        stroke={sealed ? "#FFD76A" : "#5EC4B0"}
        strokeWidth={2}
      />
      {labels.map((lab, i) => {
        const [x, y] = mid(i);
        const val =
          i === scene.missingIndex ? "?" : String(scene.sides[i]);
        return (
          <Label key={lab} x={x} y={y} accent={i === scene.missingIndex}>
            {lab}={val}
          </Label>
        );
      })}
    </g>
  );
}

function RightIncircleView({
  scene,
  sealed,
  preview,
  showSolution,
}: {
  scene: Extract<SealScene, { kind: "right-incircle" }>;
  sealed?: boolean;
  preview?: boolean;
  showSolution?: boolean;
}) {
  const scale = 140 / scene.c;
  const ax = 60;
  const ay = 220;
  const bx = ax + scene.a * scale;
  const by = ay;
  const cx = ax;
  const cy = ay - scene.b * scale;
  const rVis = Math.max(8, scene.r * scale);
  const ix = ax + rVis;
  const iy = ay - rVis;
  const showR = preview || showSolution || sealed;

  return (
    <g>
      <polygon
        points={`${ax},${ay} ${bx},${by} ${cx},${cy}`}
        fill="rgba(184,160,232,0.12)"
        stroke="#B8A0E8"
        strokeWidth={2.5}
      />
      <path
        d={`M ${ax + 12} ${ay} L ${ax + 12} ${ay - 12} L ${ax} ${ay - 12}`}
        fill="none"
        stroke="#8B5E3C"
        strokeWidth={1.5}
      />
      <circle
        cx={ix}
        cy={iy}
        r={rVis}
        fill={
          sealed
            ? "rgba(255,215,106,0.3)"
            : preview
              ? "rgba(232,93,76,0.2)"
              : "rgba(94,196,176,0.25)"
        }
        stroke={preview ? "#e85d4c" : sealed ? "#FFD76A" : "#5EC4B0"}
        strokeWidth={2.5}
      />
      <Label x={(ax + bx) / 2} y={ay + 16}>
        {scene.a}
      </Label>
      <Label x={ax - 16} y={(ay + cy) / 2}>
        {scene.b}
      </Label>
      <Label x={(bx + cx) / 2 + 12} y={(by + cy) / 2}>
        {scene.c}
      </Label>
      <Label x={ix} y={iy + 4} accent={preview || showSolution || !showR}>
        r={showR ? scene.r : "?"}
      </Label>
    </g>
  );
}

export default function StarlightSealScene({
  seal,
  scene,
  showSolution,
  selectedId,
  onSelectChord,
  sealed,
  preview,
}: Props) {
  return (
    <svg
      viewBox={VIEW}
      className="mx-auto h-auto w-full max-w-md"
      role="img"
      aria-label={`${seal.title} 도형`}
    >
      <defs>
        <radialGradient id="seal-bg" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#F5F0FF" />
          <stop offset="100%" stopColor="#FEF9F0" />
        </radialGradient>
      </defs>
      <rect width="320" height="280" fill="url(#seal-bg)" rx="16" />
      {scene.kind === "chord-perpendicular" ? (
        <ChordPerpendicularScene
          scene={scene}
          showSolution={showSolution}
          sealed={sealed}
          preview={preview}
        />
      ) : null}
      {scene.kind === "multi-chords" ? (
        <MultiChordsSceneView
          scene={scene}
          selectedId={selectedId}
          onSelectChord={onSelectChord}
          sealed={sealed}
          showSolution={showSolution}
        />
      ) : null}
      {scene.kind === "two-tangents" ? (
        <TwoTangentsSceneView
          scene={scene}
          showSolution={showSolution}
          sealed={sealed}
          preview={preview}
        />
      ) : null}
      {scene.kind === "incircle-triangle" ? (
        <IncircleTriangleView
          scene={scene}
          sealed={sealed}
          showSolution={showSolution}
        />
      ) : null}
      {scene.kind === "circum-quad" ? (
        <CircumQuadView scene={scene} sealed={sealed} />
      ) : null}
      {scene.kind === "right-incircle" ? (
        <RightIncircleView
          scene={scene}
          sealed={sealed}
          preview={preview}
          showSolution={showSolution}
        />
      ) : null}
      {sealed ? (
        <>
          {[0, 1, 2, 3, 4].map((i) => (
            <text
              key={i}
              x={40 + i * 55}
              y={24 + (i % 2) * 8}
              fontSize={14}
              opacity={0.85}
            >
              ✦
            </text>
          ))}
        </>
      ) : null}
    </svg>
  );
}
