export const ADMIN_EMAIL = "hwanys2@naver.com";

/** @deprecated Prefer ADMIN_EMAIL / isAdminEmail */
export const FORUM_ADMIN_EMAIL = ADMIN_EMAIL;
/** @deprecated Prefer ADMIN_EMAIL / isAdminEmail */
export const DIAGRAM_ADMIN_EMAIL = ADMIN_EMAIL;

export function isAdminEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === ADMIN_EMAIL;
}

export const isForumAdminEmail = isAdminEmail;
export const isDiagramAdminEmail = isAdminEmail;
