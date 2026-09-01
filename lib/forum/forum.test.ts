import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isForumAdminEmail } from "@/lib/forum/admin";
import {
  isForumCategoryId,
  isForumImagePath,
  isForumPostId,
  mimeToForumExt,
} from "@/lib/forum/catalog";
import { mapForumError } from "@/lib/forum/errors";
import { sanitizeForumImagePaths } from "@/lib/forum/storage";

describe("forum catalog", () => {
  it("accepts the three category ids", () => {
    assert.equal(isForumCategoryId("issue"), true);
    assert.equal(isForumCategoryId("idea"), true);
    assert.equal(isForumCategoryId("talk"), true);
    assert.equal(isForumCategoryId("qna"), false);
  });

  it("accepts uuid post ids only", () => {
    assert.equal(isForumPostId("3f1c2a90-4b11-4d22-8e33-9f0011223344"), true);
    assert.equal(isForumPostId("not-a-uuid"), false);
  });

  it("accepts owner-folder image paths", () => {
    const uid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const file = "11111111-2222-3333-4444-555555555555.png";
    assert.equal(isForumImagePath(`${uid}/${file}`), true);
    assert.equal(isForumImagePath(`${uid}/../secret.png`), false);
    assert.equal(isForumImagePath("other/file.png"), false);
  });

  it("maps image mime types", () => {
    assert.equal(mimeToForumExt("image/jpeg"), "jpg");
    assert.equal(mimeToForumExt("image/png"), "png");
    assert.equal(mimeToForumExt("application/pdf"), null);
  });
});

describe("forum admin and errors", () => {
  it("matches the owner email", () => {
    assert.equal(isForumAdminEmail("hwanys2@naver.com"), true);
    assert.equal(isForumAdminEmail("other@example.com"), false);
  });

  it("maps rpc errors to Korean copy", () => {
    assert.equal(mapForumError("login_required"), "로그인이 필요해요.");
    assert.equal(mapForumError("too fast"), "조금 뒤에 다시 보내 주세요.");
  });
});

describe("sanitizeForumImagePaths", () => {
  it("keeps unique valid paths", () => {
    const uid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const a = `${uid}/11111111-2222-3333-4444-555555555555.png`;
    const bad = "https://evil.example/x.png";
    assert.deepEqual(sanitizeForumImagePaths([a, a, bad, 1]), [a]);
  });
});
