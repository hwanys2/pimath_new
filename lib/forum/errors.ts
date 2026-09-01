export function mapForumError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("login_required")) return "로그인이 필요해요.";
  if (lower.includes("not allowed")) return "이 글은 지우거나 고칠 수 없어요.";
  if (lower.includes("title_required") || lower.includes("title_too_short")) {
    return "제목을 두 글자 이상 적어 주세요.";
  }
  if (lower.includes("title_too_long")) return "제목은 80자까지예요.";
  if (lower.includes("body_required")) return "내용을 입력해 주세요.";
  if (lower.includes("body_too_long") || lower.includes("comment_too_long")) {
    return "내용이 너무 길어요.";
  }
  if (lower.includes("too many images")) return "그림은 정해진 장수까지예요.";
  if (lower.includes("invalid image")) return "그림 파일이 올바르지 않아요.";
  if (lower.includes("invalid category")) return "글 종류를 골라 주세요.";
  if (lower.includes("too fast")) return "조금 뒤에 다시 보내 주세요.";
  if (lower.includes("not found")) return "글을 찾을 수 없어요.";
  if (lower.includes("file too large") || lower.includes("exceeded the maximum")) {
    return "그림은 장당 4MB까지예요.";
  }
  if (lower.includes("mime type") || lower.includes("invalid mime")) {
    return "jpg, png, webp, gif만 올릴 수 있어요.";
  }
  return `처리하지 못했어요. (${message})`;
}
