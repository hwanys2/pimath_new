/** Match SQL `pm_anonymize_display_name` (character length, middle glyph). */
export function anonymizeDisplayName(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  const chars = [...trimmed];
  const len = chars.length;
  if (len === 0 || len === 1) return "*";
  if (len === 2) return `${chars[0]}*`;
  chars[Math.floor(len / 2)] = "*";
  return chars.join("");
}
