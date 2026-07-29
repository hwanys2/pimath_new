export { default as BoardApp } from "./board/BoardApp";
export type {
  BoardBrand,
  BoardAppProps,
  ClassRoster,
  MathKind,
} from "./board/types";
export type { MathApplyPayload } from "./board/MathRecognizePanel";
export { handleRecognizeMath, handleSolveMath } from "./server";
export type { RecognizeMathResult, SolveMathResult } from "./server";
