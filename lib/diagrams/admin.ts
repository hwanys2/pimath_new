export const DIAGRAM_ADMIN_EMAIL = "hwanys2@naver.com";

export function isDiagramAdminEmail(
  email: string | null | undefined,
): boolean {
  return (email ?? "").trim().toLowerCase() === DIAGRAM_ADMIN_EMAIL;
}
