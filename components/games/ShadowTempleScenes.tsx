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

type SceneProps = {
  room: Room;
  /** Clue ids already inspected. */
  found: ReadonlySet<string>;
  onFind: (clueId: string) => void;
  /** For rooms with multiple puzzles (sun altar). */
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

/* --------------------------------------------------- Play 1 · 거인의 문 */

function GiantGateScene({ room, found, onFind }: SceneProps) {
  const { d, deg } = room.params as { d: number; deg: number };
  // Keep an exact elevation angle: adj / opp = cot θ (or opp = adj · tan θ).
  // Prefer keyhole near the statue forehead; if 30° would run off-canvas, clamp
  // the observer and drop the keyhole so the drawn angle stays exact.
  const base = { x: 292, y: 224 };
  const foreheadY = 56;
  const oppPreferred = base.y - foreheadY;
  const adjPreferred = oppPreferred / Math.tan((deg * Math.PI) / 180);
  const obsX = Math.max(40, base.x - adjPreferred);
  const adj = base.x - obsX;
  const opp = adj * Math.tan((deg * Math.PI) / 180);
  const obs = { x: obsX, y: base.y };
  const key = { x: base.x, y: base.y - opp };
  const dirToKey = -deg; // horizontal → keyhole elevation (SVG y-down)
  const hasFloor = found.has("floor");
  const hasDevice = found.has("device");
  const midFloorX = (obs.x + base.x) / 2;
  return (
    <Frame>
      <Torch x={24} y={150} />
      <Torch x={376} y={150} flip />
      {/* statue */}
      <g>
        <rect x={256} y={128} width={72} height={100} rx={6} fill={STONE_DARK} />
        <rect x={266} y={92} width={52} height={44} rx={8} fill={STONE} />
        <rect x={270} y={44} width={44} height={52} rx={10} fill={STONE} />
        {/* face */}
        <rect x={278} y={66} width={10} height={4} rx={2} fill="#6b4423" />
        <rect x={296} y={66} width={10} height={4} rx={2} fill="#6b4423" />
        <rect x={287} y={78} width={10} height={3} rx={1.5} fill="#6b4423" />
        {/* keyhole on forehead / upper face */}
        <circle cx={key.x} cy={key.y} r={13} fill="url(#st-star-glow)" className="st-glow" />
        <circle cx={key.x} cy={key.y} r={4.2} fill="#6b4423" stroke={GOLD} strokeWidth={1.4} />
        <rect x={key.x - 1.4} y={key.y + 2} width={2.8} height={5.5} fill="#6b4423" stroke={GOLD} strokeWidth={0.8} />
        {/* arms */}
        <rect x={242} y={136} width={18} height={72} rx={8} fill={STONE} />
        <rect x={324} y={136} width={18} height={72} rx={8} fill={STONE} />
      </g>
      {/* wall mural — atmospheric only; what to solve comes from reading it */}
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
      <line x1={base.x} y1={base.y} x2={key.x} y2={key.y} stroke={LINE} strokeWidth={1.2} strokeDasharray="4 5" opacity={0.55} />
      {/* right-angle mark at base */}
      <path d={`M ${base.x - 9} ${base.y} L ${base.x - 9} ${base.y - 9} L ${base.x} ${base.y - 9}`} fill="none" stroke={LINE} strokeWidth={1.1} opacity={0.8} />
      {hasDevice ? (
        <>
          <path d={arcPath(obs.x, obs.y, 26, dirToKey, 0)} fill="none" stroke={GOLD} strokeWidth={1.5} />
          <MeasureLabel x={obs.x + 44} y={obs.y - 15} text={`${deg}°`} color={GOLD} />
        </>
      ) : null}
      {hasFloor ? (
        <MeasureLabel x={midFloorX} y={base.y + 16} text={`${d} m`} />
      ) : null}
      <Hotspot x={midFloorX} y={205} label="바닥의 표식" found={hasFloor} onClick={() => onFind("floor")} />
      <Hotspot x={obs.x} y={obs.y - 38} label="관측 장치" found={hasDevice} onClick={() => onFind("device")} />
      <Hotspot x={47} y={106} label="벽화" found={found.has("mural")} onClick={() => onFind("mural")} />
    </Frame>
  );
}

/* ----------------------------------------------- Play 4 · 붕괴하는 바닥 */

function LavaFloorScene({ room, found, onFind }: SceneProps) {
  const { a, b, deg } = room.params as { a: number; b: number; deg: number };
  // Place AB horizontal (platforms), P below so ∠APB is visually honest —
  // avoids near-right angles at A that the old symmetric fan produced.
  const ab = Math.sqrt(
    Math.max(0, a * a + b * b - 2 * a * b * Math.cos((deg * Math.PI) / 180)),
  );
  const fit = 210 / Math.max(ab, a, b);
  const A = { x: 200 - (ab * fit) / 2, y: 78 };
  const B = { x: 200 + (ab * fit) / 2, y: 78 };
  const ra = a * fit;
  const rb = b * fit;
  const bx = ab * fit;
  const px = (ra * ra - rb * rb + bx * bx) / (2 * bx);
  const py = Math.sqrt(Math.max(0, ra * ra - px * px));
  const P = { x: A.x + px, y: A.y + py };
  const hasA = found.has("ropeA");
  const hasB = found.has("ropeB");
  const hasG = found.has("gauge");
  const midA = { x: (P.x + A.x) / 2, y: (P.y + A.y) / 2 };
  const midB = { x: (P.x + B.x) / 2, y: (P.y + B.y) / 2 };
  const dirPA = (Math.atan2(A.y - P.y, A.x - P.x) * 180) / Math.PI;
  const dirPB = (Math.atan2(B.y - P.y, B.x - P.x) * 180) / Math.PI;
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
      {/* platforms A and B */}
      <g>
        <ellipse cx={A.x} cy={A.y + 3} rx={22} ry={7} fill={STONE} />
        <rect x={A.x - 14} y={A.y + 6} width={28} height={36} rx={4} fill={STONE_DARK} />
        <text x={A.x} y={A.y - 10} textAnchor="middle" fontSize={12} fontWeight={900} fill={CRYSTAL}>A</text>
      </g>
      <g>
        <ellipse cx={B.x} cy={B.y + 3} rx={22} ry={7} fill={STONE} />
        <rect x={B.x - 14} y={B.y + 6} width={28} height={36} rx={4} fill={STONE_DARK} />
        <text x={B.x} y={B.y - 10} textAnchor="middle" fontSize={12} fontWeight={900} fill={CRYSTAL}>B</text>
      </g>
      {/* pillar P */}
      <rect x={P.x - 12} y={P.y} width={24} height={Math.max(20, 230 - P.y)} rx={4} fill={STONE_DARK} />
      <ellipse cx={P.x} cy={P.y} rx={16} ry={6} fill={STONE} />
      <text x={P.x + 20} y={P.y + 12} fontSize={12} fontWeight={900} fill={CRYSTAL}>P</text>
      {/* chains PA, PB — no AB=? spoon-feed; rope path is a quiet guide only */}
      <line x1={P.x} y1={P.y} x2={A.x} y2={A.y} stroke={LINE} strokeWidth={1.6} strokeDasharray="6 3" opacity={0.9} />
      <line x1={P.x} y1={P.y} x2={B.x} y2={B.y} stroke={LINE} strokeWidth={1.6} strokeDasharray="6 3" opacity={0.9} />
      <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={LINE} strokeWidth={1.2} strokeDasharray="4 5" opacity={0.55} />
      {hasG ? (
        <>
          <path d={arcPath(P.x, P.y, 24, dirPA, dirPB)} fill="none" stroke={GOLD} strokeWidth={1.5} />
          <MeasureLabel x={P.x} y={P.y - 28} text={`${deg}°`} color={GOLD} />
        </>
      ) : null}
      {hasA ? <MeasureLabel x={midA.x - 18} y={midA.y} text={`${a} m`} /> : null}
      {hasB ? <MeasureLabel x={midB.x + 18} y={midB.y} text={`${b} m`} /> : null}
      <Hotspot x={midA.x} y={midA.y + 22} label="A 쪽 사슬" found={hasA} onClick={() => onFind("ropeA")} />
      <Hotspot x={midB.x} y={midB.y + 22} label="B 쪽 사슬" found={hasB} onClick={() => onFind("ropeB")} />
      <Hotspot x={P.x} y={P.y + 34} label="각도 원판" found={hasG} onClick={() => onFind("gauge")} />
    </Frame>
  );
}

/* ------------------------------------------ Play 5 · 끊어진 지혜의 다리 */

function BrokenBridgeScene({ room, found, onFind }: SceneProps) {
  const { alpha, beta, d } = room.params as {
    alpha: number;
    beta: number;
    d: number;
  };
  const y0 = 196;
  const h = 118;
  const C = { x: 0, y: y0 - h };
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
      <rect x={0} y={0} width={400} height={C.y - 14} fill="#d4c4ff" />
      <path d={`M 0 ${C.y - 14} Q 70 ${C.y - 24} 140 ${C.y - 14} T 280 ${C.y - 14} T 400 ${C.y - 14} L 400 0 L 0 0 Z`} fill="#c4b4e8" />
      <rect x={0} y={y0 + 14} width={400} height={260 - y0 - 14} fill="#e8d4b0" />
      <path d={`M 0 ${y0 + 14} Q 80 ${y0 + 26} 160 ${y0 + 14} T 320 ${y0 + 14} T 400 ${y0 + 14} L 400 260 L 0 260 Z`} fill="#d4b896" />
      <g opacity={0.7}>
        <rect x={C.x - 9} y={C.y - 10} width={18} height={12} rx={2} fill="#5d4a33" transform={`rotate(-14 ${C.x} ${C.y})`} />
        <rect x={C.x - 30} y={y0 - 4} width={20} height={8} rx={2} fill="#5d4a33" transform={`rotate(22 ${C.x - 20} ${y0})`} />
      </g>
      <Torch x={30} y={y0 + 26} />
      <Torch x={370} y={y0 + 26} flip />
      <circle cx={C.x} cy={C.y - 16} r={22} fill="url(#st-crystal-glow)" className="st-glow" />
      <path d={`M ${C.x} ${C.y - 34} L ${C.x + 9} ${C.y - 12} L ${C.x} ${C.y - 2} L ${C.x - 9} ${C.y - 12} Z`} fill={CRYSTAL} stroke="#e6f4ff" strokeWidth={1} className="st-float" />
      <text x={C.x + 15} y={C.y - 20} fontSize={12} fontWeight={900} fill={CRYSTAL}>C</text>
      {[{ p: A, id: "A" }, { p: B, id: "B" }].map(({ p, id }) => (
        <g key={id} transform={`translate(${p.x} ${p.y})`}>
          <rect x={-6} y={-4} width={12} height={18} rx={3} fill={STONE} />
          <circle cx={0} cy={-8} r={5} fill={STONE_DARK} stroke={LINE} strokeWidth={1} />
          <text x={id === "A" ? -18 : 12} y={4} fontSize={12} fontWeight={900} fill={CRYSTAL}>{id}</text>
        </g>
      ))}
      <line x1={A.x} y1={A.y} x2={C.x} y2={C.y} stroke={GOLD} strokeWidth={1.2} strokeDasharray="5 4" opacity={0.85} />
      <line x1={B.x} y1={B.y} x2={C.x} y2={C.y} stroke={GOLD} strokeWidth={1.2} strokeDasharray="5 4" opacity={0.85} />
      <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={LINE} strokeWidth={1.4} strokeDasharray="6 3" opacity={0.9} />
      {/* foot H only — no h=? label */}
      <line x1={C.x} y1={C.y} x2={C.x} y2={y0} stroke={LINE} strokeWidth={1.1} strokeDasharray="3 4" opacity={0.45} />
      <path d={`M ${C.x - 8} ${y0} L ${C.x - 8} ${y0 - 8} L ${C.x} ${y0 - 8}`} fill="none" stroke={LINE} strokeWidth={1} opacity={0.75} />
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

/* ------------------------------------------- Play 2 · 수호자의 방패 */

function GuardianShieldScene({ room, found, onFind }: SceneProps) {
  const { a, b, deg } = room.params as { a: number; b: number; deg: number };
  const hasGroove = found.has("groove");
  const hasScript = found.has("script");

  // Fit the true-angle parallelogram as large as the chest panel allows.
  const rad = (deg * Math.PI) / 180;
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);
  const natW = a + b * Math.abs(cos);
  const natH = Math.max(0.2, b * sin);
  const scale = Math.min(240 / natW, 78 / natH);
  const ax = a * scale;
  const bx = b * scale * cos;
  const by = -b * scale * sin;
  // Anchor on the chest; pad so labels sit outside the polygon.
  const cx = 210;
  const cy = 136;
  const V = { x: cx - (ax + bx) / 2, y: cy - by / 2 };
  const pA = { x: V.x + ax, y: V.y };
  const pAB = { x: V.x + ax + bx, y: V.y + by };
  const pB = { x: V.x + bx, y: V.y + by };
  const pts = `${V.x},${V.y} ${pA.x},${pA.y} ${pAB.x},${pAB.y} ${pB.x},${pB.y}`;
  const sideB = Math.hypot(bx, by);
  const arcR = Math.min(22, ax * 0.24, sideB * 0.3);
  // Labels clearly outside each edge / the angle wedge.
  const midA = {
    x: (V.x + pA.x) / 2,
    y: (V.y + pA.y) / 2 + 22,
  };
  const midB = {
    x: (V.x + pB.x) / 2 - 26,
    y: (V.y + pB.y) / 2,
  };
  const angleLabel = polar(V.x, V.y, arcR + 22, -deg / 2);
  const panelL = Math.max(72, Math.min(V.x, pA.x, pAB.x, pB.x) - 34);
  const panelR = Math.min(348, Math.max(V.x, pA.x, pAB.x, pB.x) + 34);
  const panelT = Math.max(74, Math.min(V.y, pA.y, pAB.y, pB.y) - 14);
  const panelB = Math.min(190, Math.max(V.y, pA.y, pAB.y, pB.y) + 28);

  return (
    <Frame>
      <Torch x={22} y={128} />
      <Torch x={378} y={128} flip />

      {/* Guardian statue — armor, helm, pauldrons (not just boxes) */}
      <g>
        {/* soft ground shadow */}
        <ellipse cx={200} cy={228} rx={78} ry={10} fill="rgba(139,94,60,0.12)" />
        {/* pedestal */}
        <rect x={132} y={198} width={136} height={28} rx={6} fill={STONE_DARK} />
        <rect x={140} y={192} width={120} height={10} rx={4} fill={STONE} />
        <line x1={152} y1={206} x2={248} y2={206} stroke="rgba(255,255,255,0.18)" strokeWidth={1} />
        {/* legs / lower armor */}
        <rect x={168} y={168} width={28} height={36} rx={6} fill={STONE_DARK} />
        <rect x={204} y={168} width={28} height={36} rx={6} fill={STONE_DARK} />
        <rect x={162} y={198} width={40} height={10} rx={3} fill={STONE} />
        <rect x={198} y={198} width={40} height={10} rx={3} fill={STONE} />
        {/* torso */}
        <path
          d="M 156 88 L 244 88 L 252 168 L 148 168 Z"
          fill={STONE}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={1}
        />
        {/* chest plate ridge */}
        <path
          d="M 170 96 L 230 96 L 236 150 L 164 150 Z"
          fill={STONE_DARK}
          opacity={0.55}
        />
        {/* belt */}
        <rect x={154} y={158} width={92} height={12} rx={3} fill="#8b5e3c" />
        <circle cx={200} cy={164} r={4} fill={GOLD} />
        {/* pauldrons */}
        <ellipse cx={148} cy={100} rx={22} ry={16} fill={STONE_DARK} />
        <ellipse cx={252} cy={100} rx={22} ry={16} fill={STONE_DARK} />
        <path d="M 130 100 Q 148 86 166 100" fill="none" stroke={GOLD} strokeWidth={1.2} opacity={0.7} />
        <path d="M 234 100 Q 252 86 270 100" fill="none" stroke={GOLD} strokeWidth={1.2} opacity={0.7} />
        {/* arms */}
        <path d="M 128 108 L 118 170 L 136 174 L 148 116 Z" fill={STONE} />
        <path d="M 272 108 L 282 170 L 264 174 L 252 116 Z" fill={STONE} />
        {/* fists */}
        <rect x={110} y={168} width={28} height={18} rx={6} fill={STONE_DARK} />
        <rect x={262} y={168} width={28} height={18} rx={6} fill={STONE_DARK} />
        {/* head + helm */}
        <rect x={172} y={42} width={56} height={48} rx={12} fill={STONE} />
        <path
          d="M 168 58 L 200 28 L 232 58 L 226 72 L 174 72 Z"
          fill={STONE_DARK}
          stroke={GOLD}
          strokeWidth={1.2}
        />
        <circle cx={200} cy={36} r={4} fill={GOLD} className="st-flame-inner" />
        {/* glowing eyes */}
        <rect x={182} y={62} width={14} height={6} rx={2} fill="#ffb347" className="st-flame-inner" />
        <rect x={204} y={62} width={14} height={6} rx={2} fill="#ffb347" className="st-flame-inner" />
        <path d="M 190 78 Q 200 84 210 78" fill="none" stroke="#6b4423" strokeWidth={1.4} strokeLinecap="round" opacity={0.55} />
      </g>

      {/* Large diagram panel on the chest — room for shape + labels */}
      <g>
        <rect
          x={panelL}
          y={panelT}
          width={panelR - panelL}
          height={panelB - panelT}
          rx={10}
          fill="rgba(255,248,235,0.94)"
          stroke={GOLD}
          strokeWidth={1.8}
          className={hasGroove ? "" : "st-hotspot"}
        />
        <polygon
          points={pts}
          fill={hasGroove ? "rgba(196,180,232,0.38)" : "rgba(212,160,23,0.14)"}
          stroke={GOLD}
          strokeWidth={2.4}
        />
        {hasGroove ? (
          <>
            <path d={arcPath(V.x, V.y, arcR, -deg, 0)} fill="none" stroke={GOLD} strokeWidth={1.7} />
            <MeasureLabel x={midA.x} y={midA.y} text={`${a}`} color={MINT} size={12} />
            <MeasureLabel x={midB.x} y={midB.y} text={`${b}`} color={MINT} size={12} />
            <MeasureLabel
              x={angleLabel.x}
              y={angleLabel.y}
              text={`${deg}°`}
              color={GOLD}
              size={11}
            />
          </>
        ) : null}
      </g>

      {/* Pedestal inscription stone */}
      <g>
        <rect x={28} y={188} width={58} height={40} rx={6} fill={STONE_DARK} stroke="rgba(255,255,255,0.12)" />
        <rect x={34} y={194} width={46} height={28} rx={3} fill="#fff8eb" opacity={0.85} />
        <line x1={40} y1={202} x2={74} y2={202} stroke={LINE} strokeWidth={1.1} opacity={0.55} />
        <line x1={40} y1={209} x2={68} y2={209} stroke={LINE} strokeWidth={1.1} opacity={0.45} />
        <line x1={40} y1={216} x2={72} y2={216} stroke={LINE} strokeWidth={1.1} opacity={0.45} />
      </g>

      <rect x={0} y={232} width={400} height={28} fill="#e8d4b0" />
      {/* Hotspot to the side — never covers the parallelogram or its labels */}
      <Hotspot
        x={Math.min(372, panelR + 28)}
        y={(panelT + panelB) / 2 - 6}
        label="가슴의 홈"
        found={hasGroove}
        onClick={() => onFind("groove")}
      />
      <Hotspot
        x={57}
        y={178}
        label="받침돌의 문장"
        found={hasScript}
        onClick={() => onFind("script")}
      />
    </Frame>
  );
}

/* --------------------------------------------- Play 3 · 태양의 제단 */

/** Stepped wooden altar — triangle rests on the top plank. */
function WoodAltar({
  cx,
  topY,
  width,
  lit = false,
}: {
  cx: number;
  topY: number;
  width: number;
  lit?: boolean;
}) {
  const half = width / 2;
  const top = lit ? "#c9a66b" : "#a67c52";
  const mid = lit ? "#9a7348" : "#8b5e3c";
  const base = lit ? "#7a5632" : "#6b4423";
  return (
    <g>
      <ellipse
        cx={cx}
        cy={topY + 34}
        rx={half + 14}
        ry={8}
        fill="rgba(139,94,60,0.16)"
      />
      <rect
        x={cx - half - 12}
        y={topY + 18}
        width={width + 24}
        height={14}
        rx={4}
        fill={base}
      />
      <rect
        x={cx - half - 5}
        y={topY + 8}
        width={width + 10}
        height={12}
        rx={3}
        fill={mid}
      />
      <rect
        x={cx - half}
        y={topY}
        width={width}
        height={10}
        rx={3}
        fill={top}
      />
      <line
        x1={cx - half + 8}
        y1={topY + 3}
        x2={cx + half - 8}
        y2={topY + 3}
        stroke="rgba(255,248,235,0.4)"
        strokeWidth={1.2}
        strokeLinecap="round"
      />
    </g>
  );
}

/**
 * SAS triangle with the included angle on the altar: one leg along the wood,
 * the other rising at −includedDeg. Picks the orientation that stands taller
 * within the given box so skinny acute cases don't look flat.
 */
function altarOnWood(
  lenA: number,
  lenB: number,
  includedDeg: number,
  region: { left: number; right: number; baseY: number; maxH: number },
) {
  const rad = (includedDeg * Math.PI) / 180;
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);
  const maxW = region.right - region.left;

  type Cand = {
    along: number;
    rising: number;
    labelAlong: number;
    labelRising: number;
    s: number;
    height: number;
    span: number;
    tipX: number;
  };

  const tryOrient = (along: number, rising: number, labelAlong: number, labelRising: number): Cand => {
    const tipX = rising * cos;
    const span = Math.max(along, tipX) - Math.min(0, tipX);
    const rawH = rising * sin;
    const s = Math.min(maxW / (span + 0.01), region.maxH / (rawH + 0.01), 13.5);
    return {
      along,
      rising,
      labelAlong,
      labelRising,
      s,
      height: rawH * s,
      span: span * s,
      tipX: tipX * s,
    };
  };

  const c1 = tryOrient(lenA, lenB, lenA, lenB);
  const c2 = tryOrient(lenB, lenA, lenB, lenA);
  const best = c1.height >= c2.height ? c1 : c2;

  // Anchor so the full figure sits inside the region.
  const minLocalX = Math.min(0, best.tipX);
  const V = {
    x: region.left - minLocalX + (maxW - best.span) / 2,
    y: region.baseY,
  };
  const A = { x: V.x + best.along * best.s, y: V.y };
  const B = polar(V.x, V.y, best.rising * best.s, -includedDeg);
  return {
    V,
    A,
    B,
    s: best.s,
    labelAlong: best.labelAlong,
    labelRising: best.labelRising,
    along: best.along,
    rising: best.rising,
  };
}

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

  const baseY = 168;

  // Acute altar — included angle at the wood corner (left half of the room).
  const acute = altarOnWood(a1, b1, deg1, {
    left: 28,
    right: 188,
    baseY,
    maxH: 92,
  });
  const acutePts = `${acute.V.x},${acute.V.y} ${acute.A.x},${acute.A.y} ${acute.B.x},${acute.B.y}`;
  const acuteLeft = Math.min(acute.V.x, acute.A.x, acute.B.x);
  const acuteRight = Math.max(acute.V.x, acute.A.x, acute.B.x);
  const acuteWoodW = Math.max(118, acuteRight - acuteLeft + 44);
  const acuteWoodCx = (acuteLeft + acuteRight) / 2;
  const acuteArcR = Math.min(
    20,
    acute.along * acute.s * 0.2,
    acute.rising * acute.s * 0.26,
  );
  const acuteAngleLabel = polar(acute.V.x, acute.V.y, acuteArcR + 20, -deg1 / 2);
  const acuteCentroid = {
    x: (acute.V.x + acute.A.x + acute.B.x) / 3,
    y: (acute.V.y + acute.A.y + acute.B.y) / 3,
  };
  const acuteMidA = altarBaseLabel(acute.V, acute.A, baseY);
  const acuteMidB = sideLabelAway(acute.V, acute.B, acuteCentroid, 24);
  const acutePanel = {
    l: Math.min(acute.V.x, acute.A.x, acute.B.x, acuteMidB.x, acuteAngleLabel.x) - 20,
    r: Math.max(acute.V.x, acute.A.x, acute.B.x, acuteMidA.x, acuteMidB.x) + 20,
    t: Math.min(acute.V.y, acute.A.y, acute.B.y, acuteMidB.y) - 12,
    // Stop above the wood so the altar plank reads as a real base.
    b: baseY - 1,
  };

  // Obtuse altar — same pose in the right half.
  const obtuse = altarOnWood(a2, b2, deg2, {
    left: 208,
    right: 378,
    baseY,
    maxH: 86,
  });
  const obtusePts = `${obtuse.V.x},${obtuse.V.y} ${obtuse.A.x},${obtuse.A.y} ${obtuse.B.x},${obtuse.B.y}`;
  const obtuseLeft = Math.min(obtuse.V.x, obtuse.A.x, obtuse.B.x);
  const obtuseRight = Math.max(obtuse.V.x, obtuse.A.x, obtuse.B.x);
  const obtuseWoodW = Math.max(122, obtuseRight - obtuseLeft + 40);
  const obtuseWoodCx = (obtuseLeft + obtuseRight) / 2;
  const obtuseArcR = Math.min(
    18,
    obtuse.along * obtuse.s * 0.18,
    obtuse.rising * obtuse.s * 0.24,
  );
  // Obtuse badges are wider ("120°") and the wood side is short — keep ∠θ
  // higher inside the wedge and the base length further down the altar.
  const obtuseAngleLabel = polar(
    obtuse.V.x,
    obtuse.V.y,
    obtuseArcR + 28,
    -Math.min(80, deg2 / 2 + 14),
  );
  const obtuseCentroid = {
    x: (obtuse.V.x + obtuse.A.x + obtuse.B.x) / 3,
    y: (obtuse.V.y + obtuse.A.y + obtuse.B.y) / 3,
  };
  const obtuseMidA = altarBaseLabel(obtuse.V, obtuse.A, baseY, 12);
  const obtuseMidB = sideLabelAway(obtuse.V, obtuse.B, obtuseCentroid, 24);
  const obtusePanel = {
    l: Math.min(obtuse.V.x, obtuse.A.x, obtuse.B.x, obtuseMidB.x, obtuseAngleLabel.x) - 20,
    r: Math.max(obtuse.V.x, obtuse.A.x, obtuse.B.x, obtuseMidA.x, obtuseMidB.x) + 20,
    t: Math.min(obtuse.V.y, obtuse.A.y, obtuse.B.y, obtuseMidB.y) - 12,
    b: baseY - 1,
  };

  return (
    <Frame>
      {/* Sun disc */}
      <circle cx={200} cy={38} r={26} fill="url(#st-star-glow)" opacity={sunLit ? 1 : 0.4} className={sunLit ? "st-glow" : ""} />
      <circle cx={200} cy={38} r={13} fill={sunLit ? GOLD : "#5d4a33"} stroke={GOLD} strokeWidth={1.4} />
      {Array.from({ length: 8 }, (_, i) => {
        const p1 = polar(200, 38, 17, i * 45);
        const p2 = polar(200, 38, 24, i * 45);
        return (
          <line
            key={i}
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            stroke={sunLit ? GOLD : "#5d4a33"}
            strokeWidth={2.2}
            strokeLinecap="round"
          />
        );
      })}
      <Torch x={20} y={96} />
      <Torch x={380} y={96} flip />

      {/* Floor */}
      <rect x={0} y={206} width={400} height={54} fill="#e8d4b0" />
      <ellipse cx={acuteWoodCx} cy={210} rx={78} ry={9} fill="rgba(139,94,60,0.08)" />
      <ellipse cx={obtuseWoodCx} cy={210} rx={86} ry={9} fill="rgba(139,94,60,0.08)" />

      {/* —— First altar (acute) —— */}
      <g opacity={onFirst || solvedCount >= 1 ? 1 : 0.4}>
        <WoodAltar
          cx={acuteWoodCx}
          topY={baseY}
          width={acuteWoodW}
          lit={solvedCount >= 1}
        />
        {/* parchment only behind the triangle — wood stays visible below */}
        <rect
          x={acutePanel.l}
          y={acutePanel.t}
          width={acutePanel.r - acutePanel.l}
          height={Math.max(36, acutePanel.b - acutePanel.t)}
          rx={14}
          fill={onFirst ? "rgba(255,248,235,0.88)" : "rgba(255,248,235,0.48)"}
          stroke={onFirst ? GOLD : "rgba(139,94,60,0.2)"}
          strokeWidth={onFirst ? 1.6 : 1}
        />
        <polygon
          points={acutePts}
          fill={
            solvedCount >= 1
              ? "rgba(255,215,106,0.38)"
              : onFirst
                ? "rgba(196,180,232,0.38)"
                : "rgba(159,216,255,0.1)"
          }
          stroke={onFirst ? GOLD : LINE}
          strokeWidth={onFirst ? 2.4 : 1.4}
        />
        {hasAltar1 ? (
          <>
            <path
              d={arcPath(acute.V.x, acute.V.y, acuteArcR, -deg1, 0)}
              fill="none"
              stroke={GOLD}
              strokeWidth={1.7}
            />
            <MeasureLabel
              x={acuteAngleLabel.x}
              y={acuteAngleLabel.y}
              text={`${deg1}°`}
              color={GOLD}
              size={11}
            />
            <MeasureLabel
              x={acuteMidB.x}
              y={acuteMidB.y}
              text={`${acute.labelRising}`}
              color={MINT}
              size={12}
            />
            <MeasureLabel
              x={acuteMidA.x}
              y={acuteMidA.y}
              text={`${acute.labelAlong}`}
              color={MINT}
              size={12}
            />
          </>
        ) : null}
      </g>

      {/* —— Second altar (obtuse) —— */}
      <g opacity={!onFirst || allLit ? 1 : 0.35}>
        <WoodAltar
          cx={obtuseWoodCx}
          topY={baseY}
          width={obtuseWoodW}
          lit={allLit}
        />
        <rect
          x={obtusePanel.l}
          y={obtusePanel.t}
          width={obtusePanel.r - obtusePanel.l}
          height={Math.max(36, obtusePanel.b - obtusePanel.t)}
          rx={14}
          fill={!onFirst ? "rgba(255,248,235,0.88)" : "rgba(255,248,235,0.36)"}
          stroke={!onFirst ? GOLD : "rgba(139,94,60,0.16)"}
          strokeWidth={!onFirst ? 1.6 : 1}
        />
        <polygon
          points={obtusePts}
          fill={
            allLit
              ? "rgba(255,215,106,0.38)"
              : !onFirst
                ? "rgba(196,180,232,0.38)"
                : "rgba(159,216,255,0.08)"
          }
          stroke={!onFirst ? GOLD : LINE}
          strokeWidth={!onFirst ? 2.4 : 1.3}
        />
        {hasAltar2 ? (
          <>
            <path
              d={arcPath(obtuse.V.x, obtuse.V.y, obtuseArcR, -deg2, 0)}
              fill="none"
              stroke={GOLD}
              strokeWidth={1.7}
            />
            <MeasureLabel
              x={obtuseAngleLabel.x}
              y={obtuseAngleLabel.y}
              text={`${deg2}°`}
              color={GOLD}
              size={11}
            />
            <MeasureLabel
              x={obtuseMidB.x}
              y={obtuseMidB.y}
              text={`${obtuse.labelRising}`}
              color={MINT}
              size={12}
            />
            <MeasureLabel
              x={obtuseMidA.x}
              y={obtuseMidA.y}
              text={`${obtuse.labelAlong}`}
              color={MINT}
              size={12}
            />
          </>
        ) : null}
      </g>

      {onFirst ? (
        <>
          <Hotspot
            x={acuteWoodCx}
            y={232}
            label="제단의 눈금"
            found={hasAltar1}
            onClick={() => onFind("altar1")}
          />
          <Hotspot x={200} y={68} label="태양 문양" found={hasSun} onClick={() => onFind("sun")} />
        </>
      ) : (
        <>
          <Hotspot
            x={obtuseWoodCx}
            y={232}
            label="두 번째 제단"
            found={hasAltar2}
            onClick={() => onFind("altar2")}
          />
          <Hotspot
            x={Math.min(372, obtusePanel.r + 16)}
            y={82}
            label="그림자 문양"
            found={hasShadow}
            onClick={() => onFind("shadow")}
          />
        </>
      )}
    </Frame>
  );
}

/** Base length sits on the wood, below the triangle, so it never covers ∠θ. */
function altarBaseLabel(
  vertex: { x: number; y: number },
  far: { x: number; y: number },
  baseY: number,
  extraDown = 0,
) {
  const span = far.x - vertex.x;
  const nudge = Math.sign(span) * Math.min(16, Math.abs(span) * 0.2);
  return {
    x: (vertex.x + far.x) / 2 + nudge,
    y: baseY + 22 + extraDown,
  };
}

/** Midpoint of PQ, nudged away from the triangle centroid (outside the figure). */
function sideLabelAway(
  p: { x: number; y: number },
  q: { x: number; y: number },
  centroid: { x: number; y: number },
  dist: number,
) {
  const mx = (p.x + q.x) / 2;
  const my = (p.y + q.y) / 2;
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len;
  let ny = dx / len;
  if (nx * (centroid.x - mx) + ny * (centroid.y - my) > 0) {
    nx = -nx;
    ny = -ny;
  }
  return { x: mx + nx * dist, y: my + ny * dist };
}

/* --------------------------------------------- Play 6 · 황금의 별 */

function GoldenStarScene({ room, found, onFind }: SceneProps) {
  const { d1, d2, deg } = room.params as { d1: number; d2: number; deg: number };
  const hasD1 = found.has("diag1");
  const hasD2 = found.has("diag2");
  const hasCross = found.has("cross");

  // Floor diagram region — keep clear of the hanging star / dome apex.
  const box = { l: 78, r: 322, t: 118, b: 208 };
  const boxW = box.r - box.l;
  const boxH = box.b - box.t;
  const dir1 = 18; // slight tilt so both diagonals read clearly

  // Unit diagonals crossing at origin, then scale+center into the box.
  const u1 = (d1 / 2);
  const u2 = (d2 / 2);
  const raw = {
    a: polar(0, 0, u1, dir1),
    c: polar(0, 0, u1, dir1 + 180),
    d: polar(0, 0, u2, dir1 + deg),
    b: polar(0, 0, u2, dir1 + deg + 180),
  };
  const rawXs = [raw.a.x, raw.b.x, raw.c.x, raw.d.x];
  const rawYs = [raw.a.y, raw.b.y, raw.c.y, raw.d.y];
  const rawW = Math.max(...rawXs) - Math.min(...rawXs);
  const rawH = Math.max(...rawYs) - Math.min(...rawYs);
  const scale = Math.min((boxW - 36) / rawW, (boxH - 28) / rawH);
  const cx = (box.l + box.r) / 2;
  const cy = (box.t + box.b) / 2;
  const midRawX = (Math.min(...rawXs) + Math.max(...rawXs)) / 2;
  const midRawY = (Math.min(...rawYs) + Math.max(...rawYs)) / 2;
  const map = (p: { x: number; y: number }) => ({
    x: cx + (p.x - midRawX) * scale,
    y: cy + (p.y - midRawY) * scale,
  });
  const Q = {
    a: map(raw.a),
    b: map(raw.b),
    c: map(raw.c),
    d: map(raw.d),
  };
  const X = map({ x: 0, y: 0 });
  const centroid = {
    x: (Q.a.x + Q.b.x + Q.c.x + Q.d.x) / 4,
    y: (Q.a.y + Q.b.y + Q.c.y + Q.d.y) / 4,
  };
  const angBisect = dir1 + deg / 2;
  const arcR = Math.min(24, 0.28 * Math.min(d1, d2) * scale);
  const d1Cand = [
    sideLabelAway(Q.a, X, centroid, 22),
    sideLabelAway(Q.c, X, centroid, 22),
  ];
  const d2Cand = [
    sideLabelAway(Q.b, X, centroid, 22),
    sideLabelAway(Q.d, X, centroid, 22),
  ];
  const pickPair = (ang: { x: number; y: number }) => {
    let best = {
      d1: d1Cand[0],
      d2: d2Cand[0],
      score: -Infinity,
    };
    for (const p1 of d1Cand) {
      for (const p2 of d2Cand) {
        const gap12 = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        const gap1a = Math.hypot(p1.x - ang.x, p1.y - ang.y);
        const gap2a = Math.hypot(p2.x - ang.x, p2.y - ang.y);
        const score = Math.min(gap12, gap1a, gap2a);
        if (score > best.score) best = { d1: p1, d2: p2, score };
      }
    }
    return best;
  };
  let angLabel = polar(X.x, X.y, arcR + 26, angBisect);
  let angFrom = dir1;
  let picked = pickPair(angLabel);
  const flipped = polar(X.x, X.y, arcR + 26, angBisect + 180);
  const pickedFlip = pickPair(flipped);
  if (pickedFlip.score > picked.score) {
    angLabel = flipped;
    picked = pickedFlip;
    angFrom = dir1 + 180;
  }
  const d1Label = picked.d1;
  const d2Label = picked.d2;
  const panelPad = 28;
  const panel = {
    l: Math.min(Q.a.x, Q.b.x, Q.c.x, Q.d.x, d1Label.x, d2Label.x, angLabel.x) - panelPad,
    r: Math.max(Q.a.x, Q.b.x, Q.c.x, Q.d.x, d1Label.x, d2Label.x, angLabel.x) + panelPad,
    t: Math.min(Q.a.y, Q.b.y, Q.c.y, Q.d.y, d1Label.y, d2Label.y, angLabel.y) - 20,
    b: Math.max(Q.a.y, Q.b.y, Q.c.y, Q.d.y, d1Label.y, d2Label.y, angLabel.y) + 18,
  };

  return (
    <Frame>
      {/* night sparkles */}
      {[
        [36, 28], [72, 16], [120, 34], [280, 20], [340, 30], [368, 14], [190, 12], [240, 38],
      ].map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={1.3}
          fill="#e6f4ff"
          opacity={0.7}
          className={i % 2 ? "st-flame-inner" : ""}
        />
      ))}
      <Torch x={22} y={120} />
      <Torch x={378} y={120} flip />

      {/* glass dome — star hangs above the floor diagram */}
      <path
        d="M 100 112 A 100 92 0 0 1 300 112"
        fill="rgba(159,216,255,0.12)"
        stroke={CRYSTAL}
        strokeWidth={1.6}
      />
      <path
        d="M 100 112 L 300 112"
        stroke="rgba(61,143,217,0.35)"
        strokeWidth={1.2}
        strokeDasharray="4 5"
      />
      <path
        d="M 130 96 A 78 70 0 0 1 200 48"
        fill="none"
        stroke="rgba(230,244,255,0.55)"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <circle cx={200} cy={72} r={26} fill="url(#st-star-glow)" className="st-glow" />
      <path
        d="M 200 54 L 204.8 66.2 L 218 66.6 L 207.4 74.4 L 211.4 86.6 L 200 79.2 L 188.6 86.6 L 192.6 74.4 L 182 66.6 L 195.2 66.2 Z"
        fill={GOLD}
        stroke="#fff1c4"
        strokeWidth={1}
        className="st-float"
      />

      {/* stone floor under the diagram */}
      <ellipse cx={200} cy={222} rx={150} ry={14} fill="rgba(139,94,60,0.1)" />
      <rect x={0} y={228} width={400} height={32} fill="#e8d4b0" />

      {/* parchment plate for the floor quadrilateral */}
      <rect
        x={Math.max(56, panel.l)}
        y={Math.max(108, panel.t)}
        width={Math.min(344, panel.r) - Math.max(56, panel.l)}
        height={Math.min(220, panel.b) - Math.max(108, panel.t)}
        rx={14}
        fill="rgba(255,248,235,0.92)"
        stroke={GOLD}
        strokeWidth={1.6}
      />

      {/* quadrilateral */}
      <polygon
        points={`${Q.a.x},${Q.a.y} ${Q.b.x},${Q.b.y} ${Q.c.x},${Q.c.y} ${Q.d.x},${Q.d.y}`}
        fill="rgba(196,180,232,0.28)"
        stroke={LINE}
        strokeWidth={2}
      />
      {/* diagonals as starlight */}
      <line
        x1={Q.a.x}
        y1={Q.a.y}
        x2={Q.c.x}
        y2={Q.c.y}
        stroke={GOLD}
        strokeWidth={hasD1 ? 2.4 : 1.6}
        strokeDasharray={hasD1 ? undefined : "7 5"}
        opacity={0.95}
      />
      <line
        x1={Q.d.x}
        y1={Q.d.y}
        x2={Q.b.x}
        y2={Q.b.y}
        stroke={CRYSTAL}
        strokeWidth={hasD2 ? 2.4 : 1.6}
        strokeDasharray={hasD2 ? undefined : "7 5"}
        opacity={0.95}
      />
      {/* vertices */}
      {[Q.a, Q.b, Q.c, Q.d].map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3.2} fill="#fff8eb" stroke={LINE} strokeWidth={1.2} />
      ))}
      {/* intersection */}
      <circle
        cx={X.x}
        cy={X.y}
        r={hasCross ? 4.5 : 3.2}
        fill={hasCross ? GOLD : "#fff8eb"}
        stroke={hasCross ? "#fff1c4" : LINE}
        strokeWidth={1.3}
      />

      {hasD1 ? (
        <MeasureLabel x={d1Label.x} y={d1Label.y} text={`d₁ = ${d1} m`} color={GOLD} size={11} />
      ) : null}
      {hasD2 ? (
        <MeasureLabel x={d2Label.x} y={d2Label.y} text={`d₂ = ${d2} m`} color={CRYSTAL} size={11} />
      ) : null}
      {hasCross ? (
        <>
          <path
            d={arcPath(X.x, X.y, arcR, angFrom, angFrom + deg)}
            fill="none"
            stroke={GOLD}
            strokeWidth={1.8}
          />
          <MeasureLabel x={angLabel.x} y={angLabel.y} text={`${deg}°`} color={GOLD} size={11} />
        </>
      ) : null}

      {/* Hotspots around the plate — never on the diagonals / labels */}
      <Hotspot
        x={Math.max(36, Math.max(56, panel.l) - 28)}
        y={(Q.a.y + Q.c.y) / 2}
        label="첫 번째 별빛 선"
        found={hasD1}
        onClick={() => onFind("diag1")}
      />
      <Hotspot
        x={Math.min(364, Math.min(344, panel.r) + 28)}
        y={(Q.d.y + Q.b.y) / 2}
        label="두 번째 별빛 선"
        found={hasD2}
        onClick={() => onFind("diag2")}
      />
      <Hotspot
        x={200}
        y={Math.min(234, Math.min(220, panel.b) + 18)}
        label="교차점의 문양"
        found={hasCross}
        onClick={() => onFind("cross")}
      />
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
