import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getAuthCallbackUrl,
  isAllowedAuthHost,
  resolveAuthOrigin,
} from "./auth-origin";

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

describe("resolveAuthOrigin", () => {
  it("uses the request host when the user is already on pimath", () => {
    assert.equal(
      resolveAuthOrigin({
        configured: "https://pimath.kr",
        host: "www.pimath.kr",
        protocol: "https",
      }),
      "https://www.pimath.kr",
    );
  });

  it("falls back to PM_SITE_URL for unknown hosts", () => {
    assert.equal(
      resolveAuthOrigin({
        configured: "https://pimath.kr",
        host: "pimath-new.vercel.app",
        protocol: "https",
      }),
      "https://pimath.kr",
    );
  });

  it("allows localhost without PM_SITE_URL", () => {
    assert.equal(
      resolveAuthOrigin({
        host: "localhost:3000",
        nodeEnv: "development",
      }),
      "http://localhost:3000",
    );
    assert.equal(isAllowedAuthHost("localhost:3000"), true);
  });
});
