import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isDiagramAdminEmail } from "@/lib/diagrams/admin";

describe("isDiagramAdminEmail", () => {
  it("matches the owner email case-insensitively", () => {
    assert.equal(isDiagramAdminEmail("hwanys2@naver.com"), true);
    assert.equal(isDiagramAdminEmail("Hwanys2@Naver.com"), true);
  });

  it("rejects other addresses", () => {
    assert.equal(isDiagramAdminEmail("other@example.com"), false);
    assert.equal(isDiagramAdminEmail(null), false);
    assert.equal(isDiagramAdminEmail("  "), false);
  });
});
