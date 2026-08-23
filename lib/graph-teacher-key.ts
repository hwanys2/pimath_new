export const GRAPH_TEACHER_KEY_STORAGE = "pm_graph_teacher_key";

export function getOrCreateGuestTeacherKey(): string {
  if (typeof window === "undefined") return "";
  let key = localStorage.getItem(GRAPH_TEACHER_KEY_STORAGE);
  if (!key || key.length < 8) {
    key =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `t-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(GRAPH_TEACHER_KEY_STORAGE, key);
  }
  return key;
}
