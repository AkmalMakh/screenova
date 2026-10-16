import { describe, expect, it } from "vitest";
import { googleAccessRequest } from "./google-access";
import { signInError } from "./github-access";

describe("Google sign-in", () => {
  it("requests basic identity only with a fixed same-origin callback", () => {
    expect(googleAccessRequest("https://screenova.example/login?next=https://evil.example")).toEqual({
      provider: "google",
      options: { scopes: "openid email profile", redirectTo: "https://screenova.example/auth/callback" },
    });
  });
  it("supports local cloud sign-in", () => {
    expect(googleAccessRequest("http://localhost:3001").options.redirectTo).toBe("http://localhost:3001/auth/callback");
  });
  it.each(["oauth", "cancelled"])("keeps shared %s errors provider-neutral", (reason) => {
    expect(signInError(reason)).not.toContain("GitHub");
    expect(signInError(reason)).toContain("Sign-in");
  });
});
