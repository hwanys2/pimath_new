import type {
  LabelOffset,
  SketchSeg,
} from "@/lib/inquiry-tangent-sketch";

export type SketchpadPersisted = {
  v: 1;
  segs: SketchSeg[];
  measuredChunks: string[];
  labelOffsets: Record<string, LabelOffset>;
  nextId: number;
  /** Sincos sketchpad: first segment id (hypotenuse). */
  hypSegId?: string | null;
};

const PREFIX = "pm_inquiry_sketch:";

function storageKey(persistKey: string): string {
  return `${PREFIX}${persistKey}`;
}

export function readSketchDraft(
  persistKey: string | null | undefined,
): SketchpadPersisted | null {
  if (!persistKey || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(persistKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SketchpadPersisted;
    if (parsed?.v !== 1 || !Array.isArray(parsed.segs)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSketchDraft(
  persistKey: string,
  draft: SketchpadPersisted,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(persistKey), JSON.stringify(draft));
  } catch {
    // Quota or private mode — ignore.
  }
}

export function clearSketchDraft(persistKey: string | null | undefined): void {
  if (!persistKey || typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(persistKey));
  } catch {
    // ignore
  }
}

export function sketchPersistKey(
  contentKey: string,
  sessionId: string,
  stepIndex: number,
): string {
  return `${contentKey}:${sessionId}:${stepIndex}`;
}
