"use client";

/**
 * SVG scenes for 「그림자 신전」 — pastel adventure rooms (character-style-guide:
 * cream / wood / lavender / gold, no grim dark fantasy), with glowing clue
 * hotspots. Measurement labels appear only after the matching clue is found.
 */

import type { Room } from "@/lib/shadow-temple-math";

const GOLD = "#d4a017";
const MINT = "#2a9d7c";
const STONE = "#c4b4e8";
const STONE_DARK = "#9b88c8";
const LINE = "#8b5e3c";
const CRYSTAL = "#3d8fd9";
const RED = "#e85d4c";

type SceneProps = {
  room: Room;
  /** Clue ids already inspected. */
  found: ReadonlySet<string>;
  onFind: (clueId: string) => void;
  /** For rooms with multiple puzzles (room 5). */
  puzzleIndex: number;
  /** Number of solved puzzles in this room. */
  solvedCount: number;
};

/* ------------------------------------------------------------ helpers */

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** Arc path between two absolute SVG angles (degrees, y-down). */
function arcPath(
  cx: number,
  cy: number,
  r: number,
  fromDeg: number,
  toDeg: number,
): string {
  const s = polar(cx, cy, r, fromDeg);
  const e = polar(cx, cy, r, toDeg);
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  const sweep = toDeg > fromDeg ? 1 : 0;
  return `M ${s.x.toFixed(1)} ${s.y.toFixed(1)} A ${r} ${r} 0 ${large} ${sweep} ${e.x.toFixed(1)} ${e.y.toFixed(1)}`;
}

function Torch({ x, y, flip = false }: { x: number; y: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})${flip ? " scale(-1 1)" : ""}`}>
      <rect x={-2} y={0} width={4} height={26} rx={1.5} fill="#5d4a33" />
      <circle cx={0} cy={-4} r={16} fill="url(#st-torch-glow)" className="st-glow" />
      <path
        d="M 0 -14 C 5 -8 6 -3 0 2 C -6 -3 -5 -8 0 -14 Z"
        fill="#ffb347"
        className="st-flame"
      />
      <path
        d="M 0 -9 C 3 -5 3 -2 0 0 C -3 -2 -3 -5 0 -9 Z"
        fill="#ffe08a"
        className="st-flame-inner"
      />
    </g>
  );
}

function Hotspot({
  x,
  y,
  label,
  found,
  onClick,
}: {
  x: number;
  y: number;
  label: string;
  found: boolean;
  onClick: () => void;
}) {
  return (
    <g
      transform={`translate(${x} ${y})`}
      onClick={found ? undefined : onClick}
      role="button"
      tabIndex={found ? -1 : 0}
      aria-label={found ? `${label} (조사 완료)` : `${label} 조사하기`}
      className={found ? "" : "cursor-pointer"}
      onKeyDown={(e) => {
        if (!found && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      style={{ outline: "none" }}
    >
      <circle r={16} fill="transparent" />
      {found ? (
        <>
          <circle r={7} fill="rgba(127,227,196,0.18)" stroke={MINT} strokeWidth={1.2} />
          <path
            d="M -3 0 L -1 2.5 L 3.5 -2.5"
            fill="none"
            stroke={MINT}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <>
          <circle r={11} fill="rgba(255,215,106,0.12)" className="st-hotspot" />
          <circle r={7} fill="rgba(255,215,106,0.22)" stroke={GOLD} strokeWidth={1.3} />
          <text
            y={2.8}
            textAnchor="middle"
            fontSize={9}
            fontWeight={900}
            fill={GOLD}
          >
            ?
          </text>
        </>
      )}
      <text
        y={found ? 18 : 22}
        textAnchor="middle"
        fontSize={8}
        fontWeight={700}
        fill={found ? MINT : GOLD}
        opacity={0.9}
      >
        {label}
      </text>
    </g>
  );
}

function MeasureLabel({
  x,
  y,
  text,
  color = MINT,
  size = 10,
}: {
  x: number;
  y: number;
  text: string;
  color?: string;
  size?: number;
}) {
  const w = text.length * size * 0.62 + 10;
  return (
    <g className="st-fade-in">
      <rect
        x={x - w / 2}
        y={y - size + 1}
        width={w}
        height={size + 6}
        rx={4}
        fill="rgba(255,248,235,0.94)"
        stroke={color}
        strokeWidth={0.6}
        opacity={0.95}
      />
      <text
        x={x}
        y={y + 4}
        textAnchor="middle"
        fontSize={size}
        fontWeight={800}
        fill={color}
      >
        {text}
      </text>
    </g>
  );
}

function SceneDefs() {
  return (
    <defs>
      <linearGradient id="st-bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#f3eaff" />
        <stop offset="55%" stopColor="#fff8eb" />
        <stop offset="100%" stopColor="#f0e0c8" />
      </linearGradient>
      <radialGradient id="st-torch-glow">
        <stop offset="0%" stopColor="rgba(255,179,71,0.35)" />
        <stop offset="100%" stopColor="rgba(255,179,71,0)" />
      </radialGradient>
      <linearGradient id="st-lava" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ffd76a" />
        <stop offset="55%" stopColor="#ffc9a8" />
        <stop offset="100%" stopColor="#e85d4c" />
      </linearGradient>
      <radialGradient id="st-star-glow">
        <stop offset="0%" stopColor="rgba(255,224,138,0.85)" />
        <stop offset="60%" stopColor="rgba(255,215,106,0.25)" />
        <stop offset="100%" stopColor="rgba(255,215,106,0)" />
      </radialGradient>
      <radialGradient id="st-crystal-glow">
        <stop offset="0%" stopColor="rgba(159,216,255,0.7)" />
        <stop offset="100%" stopColor="rgba(159,216,255,0)" />
      </radialGradient>
    </defs>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 400 260"
      className="h-auto w-full select-none"
      role="img"
    >
      <SceneDefs />
      <rect width={400} height={260} fill="url(#st-bg)" />
      {/* faint stone blocks */}
      {[0, 1, 2, 3].map((r) => (
        <line
          key={r}
          x1={0}
          y1={40 + r * 55}
          x2={400}
          y2={40 + r * 55}
          stroke="rgba(255,255,255,0.03)"
          strokeWidth={1}
        />
      ))}
      {children}
    </svg>
  );
}

/* --------------------------------------------------- Room 1 · 거인의 문 */

function GiantGateScene({ room, found, onFind }: SceneProps) {
  const { d, deg } = room.params as { d: number; deg: number };
  const obs = { x: 92, y: 224 };
  const base = { x: 288, y: 224 };
  const key = { x: 288, y: 58 };
  const dirToKey = (Math.atan2(key.y - obs.y, key.x - obs.x) * 180) / Math.PI;
  const hasFloor = found.has("floor");
  const hasDevice = found.has("device");
  return (
    <Frame>
      <Torch x={24} y={150} />
      <Torch x={376} y={150} flip />
      {/* statue */}
      <g>
        <rect x={252} y={128} width={72} height={100} rx={6} fill={STONE_DARK} />
        <rect x={262} y={92} width={52} height={44} rx={8} fill={STONE} />
        <rect x={266} y={44} width={44} height={52} rx={10} fill={STONE} />
        {/* face */}
        <rect x={274} y={66} width={10} height={4} rx={2} fill="#6b4423" />
        <rect x={292} y={66} width={10} height={4} rx={2} fill="#6b4423" />
        <rect x={283} y={78} width={10} height={3} rx={1.5} fill="#6b4423" />
        {/* keyhole on forehead */}
        <circle cx={key.x} cy={key.y} r={13} fill="url(#st-star-glow)" className="st-glow" />
        <circle cx={key.x} cy={key.y} r={4.2} fill="#6b4423" stroke={GOLD} strokeWidth={1.4} />
        <rect x={key.x - 1.4} y={key.y + 2} width={2.8} height={5.5} fill="#6b4423" stroke={GOLD} strokeWidth={0.8} />
        {/* arms */}
        <rect x={238} y={136} width={18} height={72} rx={8} fill={STONE} />
        <rect x={320} y={136} width={18} height={72} rx={8} fill={STONE} />
      </g>
      {/* wall mural */}
      <g>
        <rect x={28} y={84} width={38} height={48} rx={4} fill={STONE_DARK} stroke="rgba(255,255,255,0.08)" />
        <path d="M 34 120 L 46 96 L 58 120 Z" fill="none" stroke={LINE} strokeWidth={1} opacity={0.6} />
      </g>
      {/* ground */}
      <rect x={0} y={228} width={400} height={32} fill="#e8d4b0" />
      <line x1={0} y1={228} x2={400} y2={228} stroke="rgba(255,255,255,0.1)" />
      {/* observation device */}
      <g transform={`translate(${obs.x} ${obs.y})`}>
        <line x1={-8} y1={4} x2={0} y2={-12} stroke="#8a76b8" strokeWidth={2.5} />
        <line x1={8} y1={4} x2={0} y2={-12} stroke="#8a76b8" strokeWidth={2.5} />
        <rect x={-7} y={-20} width={14} height={8} rx={3} fill="#8a76b8" transform={`rotate(${dirToKey} 0 -14)`} />
      </g>
      {/* triangle guides */}
      <line x1={obs.x} y1={obs.y} x2={base.x} y2={base.y} stroke={LINE} strokeWidth={1.2} strokeDasharray="5 4" opacity={0.8} />
      <line x1={obs.x} y1={obs.y} x2={key.x} y2={key.y} stroke={GOLD} strokeWidth={1.2} strokeDasharray="5 4" opacity={0.85} />
      <line x1={base.x} y1={base.y} x2={key.x} y2={key.y} stroke={RED} strokeWidth={1.4} strokeDasharray="3 3" opacity={0.9} />
      {/* right-angle mark at base */}
      <path d={`M ${base.x - 9} ${base.y} L ${base.x - 9} ${base.y - 9} L ${base.x} ${base.y - 9}`} fill="none" stroke={LINE} strokeWidth={1.1} opacity={0.8} />
      {hasDevice ? (
        <>
          <path d={arcPath(obs.x, obs.y, 26, dirToKey, 0)} fill="none" stroke={GOLD} strokeWidth={1.5} />
          <MeasureLabel x={obs.x + 44} y={obs.y - 15} text={`${deg}°`} color={GOLD} />
        </>
      ) : null}
      {hasFloor ? (
        <MeasureLabel x={(obs.x + base.x) / 2} y={base.y + 16} text={`${d} m`} />
      ) : null}
      <MeasureLabel x={base.x + 34} y={(base.y + key.y) / 2} text="h = ?" color={RED} size={11} />
      <Hotspot x={190} y={205} label="바닥의 표식" found={hasFloor} onClick={() => onFind("floor")} />
      <Hotspot x={obs.x} y={obs.y - 38} label="관측 장치" found={hasDevice} onClick={() => onFind("device")} />
      <Hotspot x={47} y={106} label="벽화" found={found.has("mural")} onClick={() => onFind("mural")} />
    </Frame>
  );
}

/* ----------------------------------------------- Room 2 · 붕괴하는 바닥 */

function LavaFloorScene({ room, found, onFind }: SceneProps) {
  const { a, b, deg } = room.params as { a: number; b: number; deg: number };
  const P = { x: 200, y: 186 };
  const scale = 118 / Math.max(a, b);
  // Chains symmetric around straight-up (-90°).
  const dirA = -90 - deg / 2;
  const dirB = -90 + deg / 2;
  const A = polar(P.x, P.y, a * scale, dirA);
  const B = polar(P.x, P.y, b * scale, dirB);
  const hasA = found.has("ropeA");
  const hasB = found.has("ropeB");
  const hasG = found.has("gauge");
  const midA = { x: (P.x + A.x) / 2, y: (P.y + A.y) / 2 };
  const midB = { x: (P.x + B.x) / 2, y: (P.y + B.y) / 2 };
  return (
    <Frame>
      <Torch x={24} y={70} />
      <Torch x={376} y={70} flip />
      {/* lava */}
      <g className="st-lava">
        <path
          d="M 0 214 Q 40 206 80 214 T 160 214 T 240 214 T 320 214 T 400 214 L 400 260 L 0 260 Z"
          fill="url(#st-lava)"
        />
        <circle cx={90} cy={228} r={4} fill="#ffd08a" opacity={0.8} className="st-bubble" />
        <circle cx={300} cy={234} r={3} fill="#ffd08a" opacity={0.7} className="st-bubble st-bubble-2" />
        <circle cx={190} cy={240} r={2.6} fill="#ffd08a" opacity={0.6} className="st-bubble st-bubble-3" />
      </g>
      {/* pillar P */}
      <rect x={P.x - 12} y={P.y} width={24} height={54} rx={4} fill={STONE_DARK} />
      <ellipse cx={P.x} cy={P.y} rx={17} ry={7} fill={STONE} />
      {/* platforms A and B */}
      <g>
        <ellipse cx={A.x} cy={A.y + 3} rx={24} ry={8} fill={STONE} />
        <rect x={A.x - 16} y={A.y + 6} width={32} height={40} rx={4} fill={STONE_DARK} />
        <text x={A.x} y={A.y - 12} textAnchor="middle" fontSize={12} fontWeight={900} fill={CRYSTAL}>A</text>
      </g>
      <g>
        <ellipse cx={B.x} cy={B.y + 3} rx={24} ry={8} fill={STONE} />
        <rect x={B.x - 16} y={B.y + 6} width={32} height={40} rx={4} fill={STONE_DARK} />
        <text x={B.x} y={B.y - 12} textAnchor="middle" fontSize={12} fontWeight={900} fill={CRYSTAL}>B</text>
      </g>
      <text x={P.x + 22} y={P.y + 12} fontSize={12} fontWeight={900} fill={CRYSTAL}>P</text>
      {/* chains */}
      <line x1={P.x} y1={P.y} x2={A.x} y2={A.y} stroke={LINE} strokeWidth={1.6} strokeDasharray="6 3" opacity={0.9} />
      <line x1={P.x} y1={P.y} x2={B.x} y2={B.y} stroke={LINE} strokeWidth={1.6} strokeDasharray="6 3" opacity={0.9} />
      {/* target rope A-B */}
      <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={RED} strokeWidth={1.6} strokeDasharray="3 3" opacity={0.95} />
      <MeasureLabel x={(A.x + B.x) / 2} y={(A.y + B.y) / 2 - 14} text="AB = ?" color={RED} size={11} />
      {hasG ? (
        <>
          <path d={arcPath(P.x, P.y, 22, dirA, dirB)} fill="none" stroke={GOLD} strokeWidth={1.5} />
          <MeasureLabel x={P.x} y={P.y - 32} text={`${deg}°`} color={GOLD} />
        </>
      ) : null}
      {hasA ? <MeasureLabel x={midA.x - 26} y={midA.y} text={`${a} m`} /> : null}
      {hasB ? <MeasureLabel x={midB.x + 26} y={midB.y} text={`${b} m`} /> : null}
      <Hotspot x={midA.x} y={midA.y + 24} label="A 쪽 사슬" found={hasA} onClick={() => onFind("ropeA")} />
      <Hotspot x={midB.x} y={midB.y + 24} label="B 쪽 사슬" found={hasB} onClick={() => onFind("ropeB")} />
      <Hotspot x={P.x} y={P.y + 34} label="각도 원판" found={hasG} onClick={() => onFind("gauge")} />
    </Frame>
  );
}

/* ------------------------------------------ Room 3 · 끊어진 지혜의 다리 */

function BrokenBridgeScene({ room, found, onFind }: SceneProps) {
  const { alpha, beta, d } = room.params as {
    alpha: number;
    beta: number;
    d: number;
  };
  // Top-down view: near cliff at bottom, far cliff at top.
  const y0 = 196; // near cliff edge (line AB)
  const h = 118;
  const C = { x: 0, y: y0 - h };
  // Place foot F so both angles are honest: AF = h/tanα, FB = h/tanβ.
  const ta = Math.tan((alpha * Math.PI) / 180);
  const tb = Math.tan((beta * Math.PI) / 180);
  const af = h / ta;
  const fb = h / tb;
  const total = af + fb;
  const scale = 250 / total;
  const A = { x: 200 - (total * scale) / 2, y: y0 };
  const B = { x: 200 + (total * scale) / 2, y: y0 };
  C.x = A.x + af * scale;
  const hasA = found.has("obsA");
  const hasB = found.has("obsB");
  const hasChain = found.has("chain");
  const dirAC = (Math.atan2(C.y - A.y, C.x - A.x) * 180) / Math.PI;
  const dirBC = (Math.atan2(C.y - B.y, C.x - B.x) * 180) / Math.PI;
  return (
    <Frame>
      {/* far cliff */}
      <rect x={0} y={0} width={400} height={C.y - 14} fill="#d4c4ff" />
      <path d={`M 0 ${C.y - 14} Q 70 ${C.y - 24} 140 ${C.y - 14} T 280 ${C.y - 14} T 400 ${C.y - 14} L 400 0 L 0 0 Z`} fill="#c4b4e8" />
      {/* near cliff */}
      <rect x={0} y={y0 + 14} width={400} height={260 - y0 - 14} fill="#e8d4b0" />
      <path d={`M 0 ${y0 + 14} Q 80 ${y0 + 26} 160 ${y0 + 14} T 320 ${y0 + 14} T 400 ${y0 + 14} L 400 260 L 0 260 Z`} fill="#d4b896" />
      {/* broken bridge remains */}
      <g opacity={0.7}>
        <rect x={C.x - 9} y={C.y - 10} width={18} height={12} rx={2} fill="#5d4a33" transform={`rotate(-14 ${C.x} ${C.y})`} />
        <rect x={C.x - 30} y={y0 - 4} width={20} height={8} rx={2} fill="#5d4a33" transform={`rotate(22 ${C.x - 20} ${y0})`} />
      </g>
      <Torch x={30} y={y0 + 26} />
      <Torch x={370} y={y0 + 26} flip />
      {/* crystal pillar C on far edge */}
      <circle cx={C.x} cy={C.y - 16} r={22} fill="url(#st-crystal-glow)" className="st-glow" />
      <path d={`M ${C.x} ${C.y - 34} L ${C.x + 9} ${C.y - 12} L ${C.x} ${C.y - 2} L ${C.x - 9} ${C.y - 12} Z`} fill={CRYSTAL} stroke="#e6f4ff" strokeWidth={1} className="st-float" />
      <text x={C.x + 15} y={C.y - 20} fontSize={12} fontWeight={900} fill={CRYSTAL}>C</text>
      {/* observation posts */}
      {[{ p: A, id: "A" }, { p: B, id: "B" }].map(({ p, id }) => (
        <g key={id} transform={`translate(${p.x} ${p.y})`}>
          <rect x={-6} y={-4} width={12} height={18} rx={3} fill={STONE} />
          <circle cx={0} cy={-8} r={5} fill={STONE_DARK} stroke={LINE} strokeWidth={1} />
          <text x={id === "A" ? -18 : 12} y={4} fontSize={12} fontWeight={900} fill={CRYSTAL}>{id}</text>
        </g>
      ))}
      {/* sight lines */}
      <line x1={A.x} y1={A.y} x2={C.x} y2={C.y} stroke={GOLD} strokeWidth={1.2} strokeDasharray="5 4" opacity={0.85} />
      <line x1={B.x} y1={B.y} x2={C.x} y2={C.y} stroke={GOLD} strokeWidth={1.2} strokeDasharray="5 4" opacity={0.85} />
      {/* baseline chain */}
      <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={LINE} strokeWidth={1.4} strokeDasharray="6 3" opacity={0.9} />
      {/* target height */}
      <line x1={C.x} y1={C.y} x2={C.x} y2={y0} stroke={RED} strokeWidth={1.5} strokeDasharray="3 3" opacity={0.95} />
      <path d={`M ${C.x - 8} ${y0} L ${C.x - 8} ${y0 - 8} L ${C.x} ${y0 - 8}`} fill="none" stroke={LINE} strokeWidth={1} opacity={0.75} />
      <MeasureLabel x={C.x + (C.x < 200 ? 34 : -34)} y={y0 - h / 2} text="h = ?" color={RED} size={11} />
      {hasA ? (
        <>
          <path d={arcPath(A.x, A.y, 20, dirAC, 0)} fill="none" stroke={GOLD} strokeWidth={1.4} />
          <MeasureLabel x={A.x + 34} y={A.y - 12} text={`${alpha}°`} color={GOLD} />
        </>
      ) : null}
      {hasB ? (
        <>
          <path d={arcPath(B.x, B.y, 20, 180, dirBC)} fill="none" stroke={GOLD} strokeWidth={1.4} />
          <MeasureLabel x={B.x - 34} y={B.y - 12} text={`${beta}°`} color={GOLD} />
        </>
      ) : null}
      {hasChain ? (
        <MeasureLabel x={(A.x + B.x) / 2} y={y0 + 18} text={`AB = ${d} m`} />
      ) : null}
      <Hotspot x={A.x} y={A.y + 34} label="관측소 A" found={hasA} onClick={() => onFind("obsA")} />
      <Hotspot x={B.x} y={B.y + 34} label="관측소 B" found={hasB} onClick={() => onFind("obsB")} />
      <Hotspot x={200} y={y0 - 22} label="측량 사슬" found={hasChain} onClick={() => onFind("chain")} />
    </Frame>
  );
}

/* ------------------------------------------- Room 4 · 수호자의 방패 */

function GuardianShieldScene({ room, found, onFind }: SceneProps) {
  const { a, b, deg } = room.params as { a: number; b: number; deg: number };
  const hasGroove = found.has("groove");
  // Parallelogram groove on the chest.
  const gx = 200;
  const gy = 128;
  const w = 56;
  const hgt = 30;
  const skew = 14;
  const pts = `${gx - w / 2 + skew},${gy - hgt / 2} ${gx + w / 2 + skew},${gy - hgt / 2} ${gx + w / 2 - skew},${gy + hgt / 2} ${gx - w / 2 - skew},${gy + hgt / 2}`;
  return (
    <Frame>
      <Torch x={24} y={140} />
      <Torch x={376} y={140} flip />
      {/* guardian statue */}
      <g>
        <rect x={150} y={168} width={100} height={64} rx={8} fill={STONE_DARK} />
        <rect x={158} y={86} width={84} height={92} rx={14} fill={STONE} />
        <rect x={170} y={40} width={60} height={52} rx={12} fill={STONE} />
        <rect x={180} y={58} width={12} height={5} rx={2.5} fill="#ffb347" className="st-flame-inner" />
        <rect x={208} y={58} width={12} height={5} rx={2.5} fill="#ffb347" className="st-flame-inner" />
        <rect x={128} y={96} width={30} height={98} rx={12} fill={STONE_DARK} />
        <rect x={242} y={96} width={30} height={98} rx={12} fill={STONE_DARK} />
        {/* chest groove */}
        <polygon points={pts} fill="#fff8eb" stroke={GOLD} strokeWidth={1.6} className={hasGroove ? "" : "st-hotspot"} />
        {hasGroove ? (
          <>
            <MeasureLabel x={gx} y={gy - hgt / 2 - 10} text={`${a}`} color={MINT} />
            <MeasureLabel x={gx - w / 2 - 22} y={gy + 4} text={`${b}`} color={MINT} />
            <path d={arcPath(gx - w / 2 - skew, gy + hgt / 2, 14, -62, 0)} fill="none" stroke={GOLD} strokeWidth={1.2} />
            <MeasureLabel x={gx - w / 2 + 6} y={gy + hgt / 2 + 14} text={`${deg}°`} color={GOLD} size={9} />
          </>
        ) : null}
      </g>
      {/* pedestal script stone */}
      <g>
        <rect x={38} y={196} width={52} height={34} rx={5} fill={STONE_DARK} stroke="rgba(255,255,255,0.1)" />
        <line x1={46} y1={206} x2={82} y2={206} stroke={LINE} strokeWidth={1} opacity={0.5} />
        <line x1={46} y1={213} x2={76} y2={213} stroke={LINE} strokeWidth={1} opacity={0.5} />
        <line x1={46} y1={220} x2={80} y2={220} stroke={LINE} strokeWidth={1} opacity={0.5} />
      </g>
      {/* floor */}
      <rect x={0} y={232} width={400} height={28} fill="#e8d4b0" />
      <Hotspot x={gx} y={gy} label="가슴의 홈" found={hasGroove} onClick={() => onFind("groove")} />
      <Hotspot x={64} y={186} label="받침돌의 문장" found={found.has("script")} onClick={() => onFind("script")} />
    </Frame>
  );
}

/* --------------------------------------------- Room 5 · 태양의 제단 */

function SunAltarScene({ room, found, onFind, puzzleIndex, solvedCount }: SceneProps) {
  const { a1, b1, deg1, a2, b2, deg2 } = room.params as {
    a1: number;
    b1: number;
    deg1: number;
    a2: number;
    b2: number;
    deg2: number;
  };
  const onFirst = puzzleIndex === 0;
  const hasAltar1 = found.has("altar1");
  const hasSun = found.has("sun");
  const hasAltar2 = found.has("altar2");
  const hasShadow = found.has("shadow");
  const sunLit = solvedCount >= 1;
  const allLit = solvedCount >= 2;
  return (
    <Frame>
      {/* sun disc */}
      <circle cx={200} cy={52} r={34} fill="url(#st-star-glow)" opacity={sunLit ? 1 : 0.35} className={sunLit ? "st-glow" : ""} />
      <circle cx={200} cy={52} r={17} fill={sunLit ? GOLD : "#5d4a33"} stroke={GOLD} strokeWidth={1.4} />
      {Array.from({ length: 8 }, (_, i) => {
        const p1 = polar(200, 52, 22, i * 45);
        const p2 = polar(200, 52, 29, i * 45);
        return (
          <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={sunLit ? GOLD : "#5d4a33"} strokeWidth={2.4} strokeLinecap="round" />
        );
      })}
      <Torch x={24} y={120} />
      <Torch x={376} y={120} flip />
      {/* left altar — acute triangle */}
      <g opacity={onFirst || solvedCount >= 1 ? 1 : 0.55}>
        <polygon points="52,196 168,196 118,128" fill={solvedCount >= 1 ? "rgba(255,215,106,0.3)" : "rgba(159,216,255,0.12)"} stroke={onFirst ? GOLD : LINE} strokeWidth={1.6} />
        <rect x={52} y={196} width={116} height={16} rx={3} fill={STONE_DARK} />
        {hasAltar1 ? (
          <>
            <MeasureLabel x={76} y={158} text={`${a1}`} />
            <MeasureLabel x={152} y={158} text={`${b1}`} />
            <path d={arcPath(118, 128, 15, 54, 126)} fill="none" stroke={GOLD} strokeWidth={1.2} />
            <MeasureLabel x={118} y={158} text={`${deg1}°`} color={GOLD} size={9} />
          </>
        ) : null}
      </g>
      {/* right altar — obtuse triangle */}
      <g opacity={!onFirst || allLit ? 1 : 0.55}>
        <polygon points="238,196 352,196 216,150" fill={allLit ? "rgba(255,215,106,0.3)" : "rgba(159,216,255,0.12)"} stroke={!onFirst ? GOLD : LINE} strokeWidth={1.6} />
        <rect x={216} y={196} width={140} height={16} rx={3} fill={STONE_DARK} />
        {hasAltar2 ? (
          <>
            <MeasureLabel x={222} y={178} text={`${a2}`} />
            <MeasureLabel x={300} y={162} text={`${b2}`} />
            <path d={arcPath(238, 196, 16, 180 + 18, 360)} fill="none" stroke={GOLD} strokeWidth={1.2} />
            <MeasureLabel x={252} y={184} text={`${deg2}°`} color={GOLD} size={9} />
          </>
        ) : null}
      </g>
      {/* floor */}
      <rect x={0} y={212} width={400} height={48} fill="#e8d4b0" />
      {onFirst ? (
        <>
          <Hotspot x={110} y={230} label="제단의 눈금" found={hasAltar1} onClick={() => onFind("altar1")} />
          <Hotspot x={200} y={96} label="태양 문양" found={hasSun} onClick={() => onFind("sun")} />
        </>
      ) : (
        <>
          <Hotspot x={286} y={230} label="두 번째 제단" found={hasAltar2} onClick={() => onFind("altar2")} />
          <Hotspot x={340} y={96} label="그림자 문양" found={hasShadow} onClick={() => onFind("shadow")} />
        </>
      )}
    </Frame>
  );
}

/* --------------------------------------------- Room 6 · 황금의 별 */

function GoldenStarScene({ room, found, onFind }: SceneProps) {
  const { d1, d2, deg } = room.params as { d1: number; d2: number; deg: number };
  const hasD1 = found.has("diag1");
  const hasD2 = found.has("diag2");
  const hasCross = found.has("cross");
  // Quadrilateral floor with crossing diagonals (schematic, y-down).
  const Q = {
    a: { x: 96, y: 210 },
    b: { x: 318, y: 224 },
    c: { x: 300, y: 132 },
    d: { x: 128, y: 122 },
  };
  const X = { x: 208, y: 172 };
  return (
    <Frame>
      {/* starfield */}
      {[
        [40, 30], [90, 18], [150, 36], [250, 22], [330, 34], [370, 16], [200, 14],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.4} fill="#e6f4ff" opacity={0.7} className={i % 2 ? "st-flame-inner" : ""} />
      ))}
      <Torch x={24} y={140} />
      <Torch x={376} y={140} flip />
      {/* glass dome */}
      <path d="M 118 150 A 90 84 0 0 1 298 150 L 298 168 L 118 168 Z" fill="rgba(159,216,255,0.1)" stroke={CRYSTAL} strokeWidth={1.4} />
      <path d="M 140 108 A 70 62 0 0 1 208 66" fill="none" stroke="rgba(230,244,255,0.5)" strokeWidth={2} strokeLinecap="round" />
      {/* golden star inside */}
      <circle cx={208} cy={116} r={30} fill="url(#st-star-glow)" className="st-glow" />
      <path
        d="M 208 96 L 213.5 110 L 228 110.5 L 216.5 119.5 L 221 133.5 L 208 125 L 195 133.5 L 199.5 119.5 L 188 110.5 L 202.5 110 Z"
        fill={GOLD}
        stroke="#fff1c4"
        strokeWidth={1}
        className="st-float"
      />
      {/* quadrilateral floor */}
      <polygon
        points={`${Q.a.x},${Q.a.y} ${Q.b.x},${Q.b.y} ${Q.c.x},${Q.c.y} ${Q.d.x},${Q.d.y}`}
        fill="rgba(255,215,106,0.06)"
        stroke={LINE}
        strokeWidth={1.4}
      />
      {/* diagonals as starlight */}
      <line x1={Q.a.x} y1={Q.a.y} x2={Q.c.x} y2={Q.c.y} stroke={GOLD} strokeWidth={1.6} strokeDasharray="6 4" opacity={0.9} />
      <line x1={Q.d.x} y1={Q.d.y} x2={Q.b.x} y2={Q.b.y} stroke={CRYSTAL} strokeWidth={1.6} strokeDasharray="6 4" opacity={0.9} />
      {hasD1 ? <MeasureLabel x={150} y={196} text={`d₁ = ${d1} m`} color={GOLD} /> : null}
      {hasD2 ? <MeasureLabel x={282} y={196} text={`d₂ = ${d2} m`} color={CRYSTAL} /> : null}
      {hasCross ? (
        <>
          <path d={arcPath(X.x, X.y, 15, -30, deg === 90 ? 60 : -30 + deg)} fill="none" stroke={RED} strokeWidth={1.4} />
          <MeasureLabel x={X.x + 32} y={X.y - 10} text={`${deg}°`} color={RED} />
        </>
      ) : null}
      <Hotspot x={135} y={166} label="첫 번째 별빛 선" found={hasD1} onClick={() => onFind("diag1")} />
      <Hotspot x={286} y={166} label="두 번째 별빛 선" found={hasD2} onClick={() => onFind("diag2")} />
      <Hotspot x={X.x} y={X.y + 26} label="교차점" found={hasCross} onClick={() => onFind("cross")} />
    </Frame>
  );
}

/* ----------------------------------------------------- title scene */

export function TitleScene() {
  return (
    <svg viewBox="0 0 400 220" className="h-auto w-full select-none" role="img" aria-label="그림자 신전 입구">
      <SceneDefs />
      <rect width={400} height={220} fill="url(#st-bg)" />
      {[
        [30, 24], [70, 12], [130, 30], [210, 10], [280, 26], [340, 14], [376, 32], [170, 20],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.3} fill="#e6f4ff" opacity={0.75} className={i % 2 ? "st-flame-inner" : ""} />
      ))}
      {/* temple silhouette */}
      <polygon points="60,88 200,34 340,88" fill="#d4c4ff" stroke="rgba(139,94,60,0.25)" />
      <rect x={78} y={88} width={244} height={104} fill="#c4b4e8" />
      {[100, 140, 236, 276].map((x) => (
        <rect key={x} x={x} y={96} width={22} height={96} rx={4} fill="#b8a0e8" />
      ))}
      {/* entrance */}
      <path d="M 172 192 L 172 122 A 28 30 0 0 1 228 122 L 228 192 Z" fill="#fff8eb" stroke={GOLD} strokeWidth={1.2} />
      <path d="M 186 192 L 186 134 A 14 16 0 0 1 214 134 L 214 192 Z" fill="#8b5e3c" />
      {/* eye emblem above door */}
      <circle cx={200} cy={106} r={9} fill="none" stroke={GOLD} strokeWidth={1.4} className="st-glow" />
      <circle cx={200} cy={106} r={3.4} fill={GOLD} className="st-flame-inner" />
      <Torch x={156} y={150} />
      <Torch x={244} y={150} flip />
      {/* guardian statues */}
      <g opacity={0.85}>
        <rect x={92} y={140} width={30} height={52} rx={6} fill={STONE_DARK} />
        <rect x={97} y={120} width={20} height={24} rx={6} fill={STONE} />
        <rect x={278} y={140} width={30} height={52} rx={6} fill={STONE_DARK} />
        <rect x={283} y={120} width={20} height={24} rx={6} fill={STONE} />
      </g>
      {/* ground fog */}
      <rect x={0} y={192} width={400} height={28} fill="#e8d4b0" />
      <ellipse cx={200} cy={196} rx={190} ry={10} fill="rgba(159,216,255,0.06)" />
    </svg>
  );
}

/* ------------------------------------------------------- dispatcher */

export default function RoomScene(props: SceneProps) {
  switch (props.room.kind) {
    case "giantGate":
      return <GiantGateScene {...props} />;
    case "lavaFloor":
      return <LavaFloorScene {...props} />;
    case "brokenBridge":
      return <BrokenBridgeScene {...props} />;
    case "guardianShield":
      return <GuardianShieldScene {...props} />;
    case "sunAltar":
      return <SunAltarScene {...props} />;
    case "goldenStar":
      return <GoldenStarScene {...props} />;
  }
}
