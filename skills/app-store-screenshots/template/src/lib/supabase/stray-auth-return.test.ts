import { describe, expect, it } from "vitest";
import { strayAuthReturn } from "./stray-auth-return";

describe("strayAuthReturn", () => {
  it("forwards a PKCE code that landed on the landing page to the callback", () => {
    expect(strayAuthReturn(new URLSearchParams("code=92c26067-703d-4ef8-97d1-72f4426e62b3")))
      .toBe("/auth/callback?code=92c26067-703d-4ef8-97d1-72f4426e62b3");
  });
  it("forwards a provider error so the callback can show its login notice", () => {
    expect(strayAuthReturn(new URLSearchParams("error=access_denied&error_description=secret")))
      .toBe("/auth/callback?error=access_denied");
  });
  it("keeps only code and error, never other query parameters", () => {
    expect(strayAuthReturn(new URLSearchParams("code=abc&next=https://evil.example&utm_source=x")))
      .toBe("/auth/callback?code=abc");
  });
  it("leaves ordinary landing visits alone", () => {
    expect(strayAuthReturn(new URLSearchParams(""))).toBeNull();
    expect(strayAuthReturn(new URLSearchParams("utm_source=newsletter"))).toBeNull();
    expect(strayAuthReturn(new URLSearchParams("code="))).toBeNull();
  });
});
