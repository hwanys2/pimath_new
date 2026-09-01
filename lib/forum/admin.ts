export const FORUM_ADMIN_EMAIL = "hwanys2@naver.com";

export function isForumAdminEmail(
  email: string | null | undefined,
): boolean {
  return (email ?? "").trim().toLowerCase() === FORUM_ADMIN_EMAIL;
}
