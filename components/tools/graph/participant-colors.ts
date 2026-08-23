/** 참가자별 점 색상 팔레트 (투사 환경에서 잘 구분되는 진한 색) */
const PALETTE = [
  "#e74c3c",
  "#2980b9",
  "#27ae60",
  "#8e44ad",
  "#d35400",
  "#16a085",
  "#c0392b",
  "#2c3e50",
  "#f39c12",
  "#7f4fc9",
  "#0b8457",
  "#b33771",
];

export function colorForParticipant(key: string | null | undefined): string {
  if (!key) return "#555555";
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0;
  }
  return PALETTE[h % PALETTE.length];
}

export const WRONG_POINT_COLOR = "#9aa0a6";
