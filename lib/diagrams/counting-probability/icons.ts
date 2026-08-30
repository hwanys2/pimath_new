import type { SceneCmd } from "@/lib/diagrams/scene";

export type IconId =
  | "school"
  | "home"
  | "store"
  | "library"
  | "hospital"
  | "park"
  | "busStop"
  | "station"
  | "mart"
  | "cafe"
  | "post"
  | "gym"
  | "tree"
  | "mountain"
  | "bridge"
  | "person"
  | "bus"
  | "bike"
  | "playground"
  | "plaza";

export const ICON_OPTIONS: { id: IconId; label: string }[] = [
  { id: "school", label: "학교" },
  { id: "home", label: "집" },
  { id: "store", label: "가게" },
  { id: "library", label: "도서관" },
  { id: "hospital", label: "병원" },
  { id: "park", label: "공원" },
  { id: "busStop", label: "정류장" },
  { id: "station", label: "역" },
  { id: "mart", label: "마트" },
  { id: "cafe", label: "카페" },
  { id: "post", label: "우체국" },
  { id: "gym", label: "체육관" },
  { id: "tree", label: "나무" },
  { id: "mountain", label: "산" },
  { id: "bridge", label: "다리" },
  { id: "person", label: "사람" },
  { id: "bus", label: "버스" },
  { id: "bike", label: "자전거" },
  { id: "playground", label: "놀이터" },
  { id: "plaza", label: "광장" },
];

const INK = "#111111";

/** Draw a small line-art icon centered at (cx, cy) with given size. */
export function appendIconCmds(
  cmds: SceneCmd[],
  icon: IconId,
  cx: number,
  cy: number,
  size: number,
): void {
  const s = size / 2;
  const stroke = (x1: number, y1: number, x2: number, y2: number, w = 1.4) =>
    cmds.push({ t: "line", x1, y1, x2, y2, stroke: INK, width: w });
  const fillPoly = (pts: { x: number; y: number }[], fill: string) =>
    cmds.push({ t: "polygon", points: pts, fill });
  const dot = (x: number, y: number, r: number, color: string) =>
    cmds.push({ t: "dot", x, y, r, stroke: color });

  switch (icon) {
    case "school": {
      fillPoly(
        [
          { x: cx - s * 0.55, y: cy + s * 0.35 },
          { x: cx + s * 0.55, y: cy + s * 0.35 },
          { x: cx + s * 0.55, y: cy - s * 0.05 },
          { x: cx - s * 0.55, y: cy - s * 0.05 },
        ],
        "#e8a090",
      );
      fillPoly(
        [
          { x: cx, y: cy - s * 0.55 },
          { x: cx + s * 0.5, y: cy - s * 0.05 },
          { x: cx - s * 0.5, y: cy - s * 0.05 },
        ],
        "#c87060",
      );
      cmds.push({
        t: "circle",
        x: cx,
        y: cy - s * 0.15,
        r: s * 0.12,
        stroke: INK,
        width: 1.2,
      });
      break;
    }
    case "home": {
      fillPoly(
        [
          { x: cx, y: cy - s * 0.5 },
          { x: cx + s * 0.55, y: cy - s * 0.05 },
          { x: cx + s * 0.55, y: cy + s * 0.4 },
          { x: cx - s * 0.55, y: cy + s * 0.4 },
          { x: cx - s * 0.55, y: cy - s * 0.05 },
        ],
        "#f0c080",
      );
      fillPoly(
        [
          { x: cx - s * 0.18, y: cy + s * 0.4 },
          { x: cx + s * 0.18, y: cy + s * 0.4 },
          { x: cx + s * 0.18, y: cy + s * 0.05 },
          { x: cx - s * 0.18, y: cy + s * 0.05 },
        ],
        "#8b6914",
      );
      break;
    }
    case "store": {
      fillPoly(
        [
          { x: cx - s * 0.5, y: cy + s * 0.4 },
          { x: cx + s * 0.5, y: cy + s * 0.4 },
          { x: cx + s * 0.5, y: cy - s * 0.2 },
          { x: cx - s * 0.5, y: cy - s * 0.2 },
        ],
        "#a8d8a0",
      );
      stroke(cx - s * 0.35, cy - s * 0.45, cx + s * 0.35, cy - s * 0.45, 2);
      break;
    }
    case "library": {
      fillPoly(
        [
          { x: cx - s * 0.45, y: cy + s * 0.4 },
          { x: cx + s * 0.45, y: cy + s * 0.4 },
          { x: cx + s * 0.45, y: cy - s * 0.35 },
          { x: cx - s * 0.45, y: cy - s * 0.35 },
        ],
        "#b8c8e0",
      );
      for (let i = -1; i <= 1; i += 1) {
        stroke(cx + i * s * 0.18, cy - s * 0.25, cx + i * s * 0.18, cy + s * 0.3);
      }
      break;
    }
    case "hospital": {
      fillPoly(
        [
          { x: cx - s * 0.45, y: cy + s * 0.4 },
          { x: cx + s * 0.45, y: cy + s * 0.4 },
          { x: cx + s * 0.45, y: cy - s * 0.35 },
          { x: cx - s * 0.45, y: cy - s * 0.35 },
        ],
        "#f0f0f0",
      );
      stroke(cx, cy - s * 0.15, cx, cy + s * 0.15, 2.5);
      stroke(cx - s * 0.15, cy, cx + s * 0.15, cy, 2.5);
      break;
    }
    case "park": {
      dot(cx, cy - s * 0.15, s * 0.35, "#7ec87e");
      stroke(cx, cy - s * 0.15, cx, cy + s * 0.35, 2);
      break;
    }
    case "busStop": {
      cmds.push({
        t: "roundRect",
        x: cx - s * 0.4,
        y: cy - s * 0.35,
        w: s * 0.8,
        h: s * 0.7,
        r: 4,
        fill: "#e8e8e8",
        stroke: INK,
        width: 1.2,
      });
      stroke(cx - s * 0.25, cy + s * 0.35, cx + s * 0.25, cy + s * 0.35, 2);
      break;
    }
    case "station": {
      fillPoly(
        [
          { x: cx - s * 0.5, y: cy + s * 0.4 },
          { x: cx + s * 0.5, y: cy + s * 0.4 },
          { x: cx + s * 0.35, y: cy - s * 0.35 },
          { x: cx - s * 0.35, y: cy - s * 0.35 },
        ],
        "#c8d0e0",
      );
      break;
    }
    case "mart": {
      fillPoly(
        [
          { x: cx - s * 0.5, y: cy + s * 0.35 },
          { x: cx + s * 0.5, y: cy + s * 0.35 },
          { x: cx + s * 0.45, y: cy - s * 0.25 },
          { x: cx - s * 0.45, y: cy - s * 0.25 },
        ],
        "#ffd080",
      );
      stroke(cx - s * 0.3, cy - s * 0.4, cx + s * 0.3, cy - s * 0.4, 2);
      break;
    }
    case "cafe": {
      cmds.push({
        t: "roundRect",
        x: cx - s * 0.35,
        y: cy - s * 0.25,
        w: s * 0.7,
        h: s * 0.55,
        r: 6,
        fill: "#d4a574",
        stroke: INK,
        width: 1.2,
      });
      stroke(cx - s * 0.2, cy - s * 0.45, cx + s * 0.2, cy - s * 0.45, 1.5);
      break;
    }
    case "post": {
      fillPoly(
        [
          { x: cx - s * 0.45, y: cy + s * 0.35 },
          { x: cx + s * 0.45, y: cy + s * 0.35 },
          { x: cx + s * 0.45, y: cy - s * 0.3 },
          { x: cx - s * 0.45, y: cy - s * 0.3 },
        ],
        "#f5e6a0",
      );
      fillPoly(
        [
          { x: cx - s * 0.2, y: cy - s * 0.05 },
          { x: cx + s * 0.2, y: cy - s * 0.05 },
          { x: cx, y: cy + s * 0.15 },
        ],
        "#e04040",
      );
      break;
    }
    case "gym": {
      fillPoly(
        [
          { x: cx - s * 0.5, y: cy + s * 0.35 },
          { x: cx + s * 0.5, y: cy + s * 0.35 },
          { x: cx + s * 0.4, y: cy - s * 0.35 },
          { x: cx - s * 0.4, y: cy - s * 0.35 },
        ],
        "#c0c8d8",
      );
      stroke(cx - s * 0.3, cy, cx + s * 0.3, cy, 2);
      break;
    }
    case "tree": {
      dot(cx, cy - s * 0.2, s * 0.32, "#5cb85c");
      stroke(cx, cy + s * 0.05, cx, cy + s * 0.4, 2.5);
      break;
    }
    case "mountain": {
      fillPoly(
        [
          { x: cx - s * 0.55, y: cy + s * 0.35 },
          { x: cx, y: cy - s * 0.45 },
          { x: cx + s * 0.55, y: cy + s * 0.35 },
        ],
        "#98b898",
      );
      fillPoly(
        [
          { x: cx - s * 0.08, y: cy - s * 0.45 },
          { x: cx + s * 0.08, y: cy - s * 0.45 },
          { x: cx, y: cy - s * 0.15 },
        ],
        "#f0f0f0",
      );
      break;
    }
    case "bridge": {
      stroke(cx - s * 0.5, cy + s * 0.1, cx + s * 0.5, cy + s * 0.1, 2);
      cmds.push({
        t: "quad",
        x1: cx - s * 0.45,
        y1: cy + s * 0.1,
        cx: cx,
        cy: cy - s * 0.35,
        x2: cx + s * 0.45,
        y2: cy + s * 0.1,
        stroke: INK,
        width: 1.5,
      });
      break;
    }
    case "person": {
      dot(cx, cy - s * 0.25, s * 0.14, INK);
      stroke(cx, cy - s * 0.1, cx, cy + s * 0.2, 2);
      stroke(cx, cy + s * 0.05, cx - s * 0.2, cy + s * 0.25, 1.5);
      stroke(cx, cy + s * 0.05, cx + s * 0.2, cy + s * 0.25, 1.5);
      break;
    }
    case "bus": {
      cmds.push({
        t: "roundRect",
        x: cx - s * 0.5,
        y: cy - s * 0.2,
        w: s,
        h: s * 0.45,
        r: 5,
        fill: "#ffd040",
        stroke: INK,
        width: 1.2,
      });
      dot(cx - s * 0.25, cy + s * 0.3, s * 0.1, INK);
      dot(cx + s * 0.25, cy + s * 0.3, s * 0.1, INK);
      break;
    }
    case "bike": {
      dot(cx - s * 0.25, cy + s * 0.2, s * 0.15, INK);
      dot(cx + s * 0.25, cy + s * 0.2, s * 0.15, INK);
      stroke(cx - s * 0.25, cy + s * 0.2, cx, cy - s * 0.1, 1.5);
      stroke(cx, cy - s * 0.1, cx + s * 0.25, cy + s * 0.2, 1.5);
      stroke(cx, cy - s * 0.1, cx + s * 0.1, cy - s * 0.25, 1.5);
      break;
    }
    case "playground": {
      stroke(cx - s * 0.15, cy + s * 0.35, cx - s * 0.15, cy - s * 0.15, 2);
      stroke(cx + s * 0.15, cy + s * 0.35, cx + s * 0.15, cy - s * 0.15, 2);
      stroke(cx - s * 0.15, cy - s * 0.15, cx + s * 0.15, cy - s * 0.15, 2);
      cmds.push({
        t: "quad",
        x1: cx - s * 0.15,
        y1: cy - s * 0.15,
        cx: cx,
        cy: cy - s * 0.45,
        x2: cx + s * 0.15,
        y2: cy - s * 0.15,
        stroke: "#e04040",
        width: 1.5,
      });
      break;
    }
    case "plaza": {
      cmds.push({
        t: "circle",
        x: cx,
        y: cy,
        r: s * 0.38,
        stroke: INK,
        width: 1.2,
      });
      dot(cx, cy, s * 0.08, "#888888");
      break;
    }
    default:
      break;
  }
}
