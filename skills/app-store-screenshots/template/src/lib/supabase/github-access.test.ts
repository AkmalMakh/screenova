import { describe, expect, it } from "vitest";
import { githubAccessRequest, signInError } from "./github-access";

describe("GitHub sign-in", () => {
  it("requests only email access and a same-origin callback", () => {
    expect(githubAccessRequest("https://screenova.example/login?next=https://evil.example")).toEqual({
      provider: "github", options: { scopes: "user:email", redirectTo: "https://screenova.example/auth/callback" },
    });
  });
  it("supports the local cloud test origin", () => {
    expect(githubAccessRequest("http://localhost:3001").options.redirectTo).toBe("http://localhost:3001/auth/callback");
  });
  it("handles cancellation, expiry and unknown error text without reflecting it", () => {
    expect(signInError("cancelled")).toContain("cancelled");
    expect(signInError("expired")).toContain("try signing in again");
    expect(signInError("oauth")).toContain("could not be completed");
    expect(signInError("session")).toContain("session ended");
    expect(signInError("access")).toContain("verified email");
    expect(signInError("provider-error-with-secret")).toBe("");
    expect(signInError(null)).toBe("");
  });
});
