export const FORUM_CATEGORIES = [
  {
    id: "issue",
    label: "불편해요",
    emoji: "🛠️",
    hint: "쓰다 막히거나 어색한 점",
  },
  {
    id: "idea",
    label: "이런 거 있으면 좋겠어요",
    emoji: "💡",
    hint: "새 프로그램·기능 제안",
  },
  {
    id: "talk",
    label: "이야기",
    emoji: "💬",
    hint: "사용하면서 나누고 싶은 말",
  },
] as const;

export type ForumCategoryId = (typeof FORUM_CATEGORIES)[number]["id"];

export const FORUM_TITLE_MAX = 80;
export const FORUM_BODY_MAX = 4000;
export const FORUM_COMMENT_MAX = 2000;
export const FORUM_POST_IMAGE_MAX = 5;
export const FORUM_COMMENT_IMAGE_MAX = 3;
export const FORUM_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export const FORUM_PAGE_SIZE = 20;
export const FORUM_BUCKET = "pm_forum";

const CATEGORY_IDS = new Set<string>(FORUM_CATEGORIES.map((c) => c.id));

export function isForumCategoryId(value: string): value is ForumCategoryId {
  return CATEGORY_IDS.has(value);
}

export function getForumCategory(id: string) {
  return FORUM_CATEGORIES.find((c) => c.id === id);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isForumPostId(value: string): boolean {
  return UUID_RE.test(value);
}

export const FORUM_IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "gif"] as const;
export type ForumImageExt = (typeof FORUM_IMAGE_EXT)[number];

const IMAGE_PATH_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|gif)$/;

export function isForumImagePath(value: string): boolean {
  return IMAGE_PATH_RE.test(value);
}

export function mimeToForumExt(mime: string): ForumImageExt | null {
  const lower = mime.trim().toLowerCase();
  if (lower === "image/jpeg" || lower === "image/jpg") return "jpg";
  if (lower === "image/png") return "png";
  if (lower === "image/webp") return "webp";
  if (lower === "image/gif") return "gif";
  return null;
}
