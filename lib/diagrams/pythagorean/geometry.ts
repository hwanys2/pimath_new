import { formatMeasure } from "@/lib/diagrams/math-label";
import {
  add,
  clamp,
  len,
  mul,
  norm,
  parseMeasureInput,
  sub,
} from "@/lib/diagrams/polygon/geometry";
import { emptyLabel, type MeasLabel, type Vec } from "@/lib/diagrams/polygon/model";
import {
  findSeg,
  normalizeState,
  patchSegState,
  triangleFromLegs,
  type PythagoreanKind,
  type PythagoreanState,
  type SegMark,
} from "./model";

export type PythHit =
  | { kind: "point"; id: string }
  | { kind: "seg"; id: string }
  | { kind: "label"; id: string }
  | { kind: "dimLine"; id: string };

export type PythSelection =
  | { t: "point"; id: string }
  | { t: "seg"; id: string };

export function lerp(a: Vec, b: Vec, t: number): Vec {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function projectT(p: Vec, a: Vec, b: Vec): number {
  const ab = sub(b, a);
  const ap = sub(p, a);
  const l2 = ab.x * ab.x + ab.y * ab.y;
  if (l2 < 1e-12) return 0.5;
  return (ap.x * ab.x + ap.y * ab.y) / l2;
}

export function distToSeg(p: Vec, a: Vec, b: Vec): number {
  const t = clamp(projectT(p, a, b), 0, 1);
  const q = lerp(a, b, t);
  return len(sub(p, q));
}

export function angleAt(from: Vec, vertex: Vec, to: Vec): number {
  const u = norm(sub(from, vertex));
  const w = norm(sub(to, vertex));
  return (Math.acos(clamp(u.x * w.x + u.y * w.y, -1, 1)) * 180) / Math.PI;
}

export function footToLine(p: Vec, a: Vec, b: Vec): Vec {
  const t = clamp(projectT(p, a, b), 0, 1);
  return lerp(a, b, t);
}

export function derivedPoints(state: PythagoreanState): Record<string, Vec> {
  const { A, B, C } = state;
  const out: Record<string, Vec> = { A, B, C };
  if (state.kind === "altitude" && state.rightVertex === "A") {
    out.D = footToLine(A, B, C);
  }
  if (state.kind === "rectangle") {
    out.D = { x: A.x + (C.x - B.x), y: A.y + (C.y - B.y) };
  }
  return out;
}

export function figureStrokes(state: PythagoreanState): [string, string][] {
  switch (state.kind) {
    case "triangle":
    case "squares":
    case "coordinate":
      return [
        ["A", "B"],
        ["B", "C"],
        ["A", "C"],
      ];
    case "altitude":
      return [
        ["A", "B"],
        ["B", "C"],
        ["A", "C"],
        ["A", "D"],
      ];
    case "rectangle":
      return state.showDiagonal
        ? [
            ["A", "B"],
            ["B", "C"],
            ["C", "D"],
            ["D", "A"],
            ["A", "C"],
          ]
        : [
            ["A", "B"],
            ["B", "C"],
            ["C", "D"],
            ["D", "A"],
          ];
    default:
      return [];
  }
}

export function draggableIds(state: PythagoreanState): string[] {
  switch (state.kind) {
    case "proof":
      return [];
    case "rectangle":
      return ["A", "B", "C"];
    case "coordinate":
      return ["A", "B", "C"];
    default:
      return ["A", "B", "C"];
  }
}

export function displayName(state: PythagoreanState, id: string): string {
  return state.names[id]?.name?.trim() || id;
}

export function segDisplayName(state: PythagoreanState, seg: SegMark): string {
  return `${displayName(state, seg.a)}${displayName(state, seg.b)}`;
}

export function segLength(state: PythagoreanState, seg: SegMark): number {
  const pts = derivedPoints(state);
  const a = pts[seg.a];
  const b = pts[seg.b];
  if (!a || !b) return 0;
  return len(sub(b, a));
}

function legLengths(state: PythagoreanState): { left: number; right: number; hyp: number } {
  const pts = derivedPoints(state);
  const { A, B, C } = pts;
  const rv = state.rightVertex;
  if (rv === "C") {
    const left = len(sub(B!, C!));
    const right = len(sub(A!, C!));
    return { left, right, hyp: len(sub(A!, B!)) };
  }
  if (rv === "A") {
    const left = len(sub(B!, A!));
    const right = len(sub(C!, A!));
    return { left, right, hyp: len(sub(B!, C!)) };
  }
  const left = len(sub(A!, B!));
  const right = len(sub(C!, B!));
  return { left, right, hyp: len(sub(A!, C!)) };
}

export function syncLegFields(state: PythagoreanState): PythagoreanState {
  const { left, right } = legLengths(state);
  return {
    ...state,
    legLeft: Number(left.toFixed(4)),
    legRight: Number(right.toFixed(4)),
  };
}

function rebuildTriangle(state: PythagoreanState, legLeft: number, legRight: number): PythagoreanState {
  let ll = legLeft;
  let lr = legRight;
  if (state.isoscelesRight) {
    ll = Math.max(ll, lr);
    lr = ll;
  }
  const t = triangleFromLegs(ll, lr);
  return syncLegFields({ ...state, A: t.A, B: t.B, C: t.C });
}

function setLegFromEdit(
  state: PythagoreanState,
  which: "left" | "right" | "hyp",
  value: number,
): PythagoreanState {
  const legs = legLengths(state);
  let left = legs.left;
  let right = legs.right;
  if (which === "left") left = value;
  else if (which === "right") right = value;
  else {
    const ratio = value / Math.max(legs.hyp, 1e-6);
    left *= ratio;
    right *= ratio;
  }
  if (state.isoscelesRight) {
    const avg = which === "hyp" ? value / Math.SQRT2 : value;
    left = avg;
    right = avg;
  }
  return rebuildTriangle(state, left, right);
}

function labelFromParse(
  parsed: ReturnType<typeof parseMeasureInput>,
  text: string,
  prev: MeasLabel,
): MeasLabel {
  if (parsed.kind === "unknown") {
    return { ...prev, mode: "x", custom: parsed.unknown ?? "x" };
  }
  if (parsed.kind === "number" && parsed.value != null) {
    return { ...prev, mode: "custom", custom: String(parsed.value) };
  }
  if (!text.trim()) return { ...prev, mode: "hide", custom: "" };
  return { ...prev, mode: "custom", custom: text.trim() };
}

export function applyEditedLabel(state: PythagoreanState, labelId: string, text: string): PythagoreanState {
  const trimmed = text.trim();
  if (labelId.startsWith("s:")) {
    const segId = labelId.slice(2);
    const seg = findSeg(state, segId);
    if (!seg) return state;
    const parsed = parseMeasureInput(trimmed);
    let next = {
      ...state,
      segs: state.segs.map((s) =>
        s.id === segId
          ? { ...s, show: true, label: labelFromParse(parsed, trimmed, seg.label) }
          : s,
      ),
    };
    if (parsed.kind === "number" && parsed.value != null) {
      const rv = state.rightVertex;
      const mapHyp = segId === "AB" || (rv === "A" && segId === "BC") || (rv === "B" && segId === "AC");
      const mapLeft =
        segId === "BC" || (segId === "AB" && rv === "B") || (segId === "AC" && rv === "C");
      const mapRight =
        segId === "AC" || (segId === "AB" && rv === "C") || (segId === "BC" && rv === "A");
      if (mapHyp && (state.kind === "triangle" || state.kind === "squares")) {
        next = setLegFromEdit(next, "hyp", parsed.value);
      } else if (mapLeft) {
        next = setLegFromEdit(next, "left", parsed.value);
      } else if (mapRight) {
        next = setLegFromEdit(next, "right", parsed.value);
      } else if (state.kind === "rectangle") {
        if (segId === "AB") next = { ...next, rectWidth: parsed.value };
        else if (segId === "BC") next = { ...next, rectHeight: parsed.value };
        else if (segId === "AC") {
          const w = next.rectWidth;
          next = { ...next, rectHeight: Math.sqrt(Math.max(0, parsed.value ** 2 - w ** 2)) };
        }
      }
    }
    return next;
  }
  return state;
}

function maintainRightAngle(
  state: PythagoreanState,
  moved: string,
  pos: Vec,
): PythagoreanState {
  const pts = derivedPoints(state);
  const rv = state.rightVertex;
  let A = pts.A!;
  let B = pts.B!;
  let C = pts.C!;
  if (moved === "A") A = pos;
  if (moved === "B") B = pos;
  if (moved === "C") C = pos;

  if (state.kind === "coordinate") {
    return syncLegFields({ ...state, A, B, C });
  }

  if (state.kind === "rectangle") {
    if (moved === "A") {
      B = { x: A.x + state.rectWidth, y: A.y };
      C = { x: B.x, y: B.y + state.rectHeight };
    } else if (moved === "B") {
      A = { x: B.x - state.rectWidth, y: B.y };
      C = { x: B.x, y: B.y + state.rectHeight };
    } else if (moved === "C") {
      B = { x: C.x, y: C.y - state.rectHeight };
      A = { x: B.x - state.rectWidth, y: B.y };
    }
    return { ...state, A, B, C };
  }

  if (rv === "C") {
    if (moved === "B") {
      const hyp = len(sub(A, B));
      const dir = norm(sub(A, B));
      const perp = { x: -dir.y, y: dir.x };
      const leg = len(sub(C, B));
      C = add(B, mul(perp, leg));
      A = add(B, mul(dir, hyp));
    } else if (moved === "A") {
      const hyp = len(sub(A, B));
      const dir = norm(sub(A, B));
      const perp = { x: dir.y, y: -dir.x };
      const leg = len(sub(C, A));
      C = add(A, mul(perp, leg));
      B = add(A, mul(dir, -hyp));
    } else if (moved === "C") {
      const mid = mul(add(A, B), 0.5);
      const dir = norm(sub(A, B));
      const perp = { x: -dir.y, y: dir.x };
      const h = len(sub(C, mid));
      C = add(mid, mul(perp, h * Math.sign(sub(C, mid).x * perp.x + sub(C, mid).y * perp.y || 1)));
    }
  } else if (rv === "A") {
    if (moved === "A") {
      const bcMid = mul(add(B, C), 0.5);
      const dir = norm(sub(C, B));
      const perp = { x: -dir.y, y: dir.x };
      const h = len(sub(A, bcMid));
      A = add(bcMid, mul(perp, h * Math.sign(sub(A, bcMid).x * perp.x + sub(A, bcMid).y * perp.y || 1)));
    } else if (moved === "B") {
      const ab = len(sub(A, B));
      const dir = norm(sub(C, B));
      const perp = { x: -dir.y, y: dir.x };
      B = add(A, mul(norm(sub(B, A)), ab));
      C = add(B, mul(dir, len(sub(C, B))));
    } else if (moved === "C") {
      const ac = len(sub(A, C));
      const dir = norm(sub(B, C));
      const perp = { x: dir.y, y: -dir.x };
      C = add(A, mul(norm(sub(C, A)), ac));
      B = add(C, mul(dir, len(sub(B, C))));
    }
  }

  return syncLegFields({ ...state, A, B, C });
}

export function movePoint(state: PythagoreanState, id: string, p: Vec): PythagoreanState {
  if (!draggableIds(state).includes(id)) return state;
  return maintainRightAngle(state, id, p);
}

export function nudgeLabel(state: PythagoreanState, id: string, dx: number, dy: number): PythagoreanState {
  if (id.startsWith("n:")) {
    const pid = id.slice(2);
    const prev = state.names[pid];
    if (!prev) return state;
    return {
      ...state,
      names: {
        ...state.names,
        [pid]: { ...prev, dx: prev.dx + dx, dy: prev.dy + dy },
      },
    };
  }
  if (id.startsWith("s:")) {
    const segId = id.slice(2);
    const seg = findSeg(state, segId);
    if (!seg) return state;
    return patchSegState(state, segId, {
      label: { ...seg.label, dx: seg.label.dx + dx, dy: seg.label.dy + dy },
    });
  }
  if (id.endsWith(":line")) {
    const segId = id.slice(0, -5).replace(/^s:/, "");
    const seg = findSeg(state, segId);
    if (!seg) return state;
    return patchSegState(state, segId, {
      label: {
        ...seg.label,
        lineDx: (seg.label.lineDx ?? 0) + dx,
        lineDy: (seg.label.lineDy ?? 0) + dy,
      },
    });
  }
  return state;
}

export function toggleSeg(state: PythagoreanState, id: string): PythagoreanState {
  const seg = findSeg(state, id);
  if (!seg) return state;
  return patchSegState(state, id, { show: !seg.show });
}

export function hitTestPythagorean(
  sceneTexts: { id: string; x: number; y: number }[],
  layoutPts: Record<string, Vec>,
  strokes: [string, string][],
  x: number,
  y: number,
): PythHit | null {
  for (const t of sceneTexts) {
    if (Math.hypot(t.x - x, t.y - y) < 22) {
      if (t.id.endsWith(":line")) return { kind: "dimLine", id: t.id.replace(/:line$/, "") };
      if (t.id.startsWith("s:")) return { kind: "label", id: t.id };
      if (t.id.startsWith("n:")) return { kind: "point", id: t.id.slice(2) };
      return { kind: "label", id: t.id };
    }
  }
  for (const [a, b] of strokes) {
    const pa = layoutPts[a];
    const pb = layoutPts[b];
    if (!pa || !pb) continue;
    if (distToSeg({ x, y }, pa, pb) < 12) {
      return { kind: "seg", id: `${a}${b}` };
    }
  }
  for (const [id, p] of Object.entries(layoutPts)) {
    if (id.startsWith("_")) continue;
    if (Math.hypot(p.x - x, p.y - y) < 16) return { kind: "point", id };
  }
  return null;
}

export function formatLeg(n: number, unit: string): string {
  return formatMeasure(n, unit);
}

export function resolveSegText(state: PythagoreanState, seg: SegMark): string | null {
  const auto = segLength(state, seg);
  if (seg.label.mode === "hide") return null;
  if (seg.label.mode === "x") return `$${seg.label.custom || state.unknownLetter}$ ${state.unit}`.trim();
  if (seg.label.mode === "custom") return seg.label.custom;
  return formatLeg(auto, state.unit);
}

export function pointIdsFor(kind: PythagoreanKind): string[] {
  if (kind === "altitude") return ["A", "B", "C", "D"];
  if (kind === "rectangle") return ["A", "B", "C", "D"];
  return ["A", "B", "C"];
}

export function normalizeAndSync(state: PythagoreanState): PythagoreanState {
  return syncLegFields(normalizeState(state));
}
