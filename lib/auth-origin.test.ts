import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAuthCallbackUrl } from "./auth-origin";

describe("getAuthCallbackUrl", () => {
  it("keeps the OAuth callback exact so the shared allow list can match", () => {
    assert.equal(
      getAuthCallbackUrl("https://pimath.kr"),
      "https://pimath.kr/auth/callback",
    );
    assert.equal(
      getAuthCallbackUrl("https://pimath.kr/"),
      "https://pimath.kr/auth/callback",
    );
  });

  it("allows a next query only when callers opt in (password reset)", () => {
    assert.equal(
      getAuthCallbackUrl("https://pimath.kr", "/reset-password"),
      "https://pimath.kr/auth/callback?next=%2Freset-password",
    );
  });
});
