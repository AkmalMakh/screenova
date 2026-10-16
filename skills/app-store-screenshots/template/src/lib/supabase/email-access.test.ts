import { describe, expect, it } from "vitest";
import { emailAccessRequest } from "./email-access";

describe("public email access", () => {
  it("allows new accounts through the same verified-email flow as returning users", () => {
    expect(emailAccessRequest("  developer@example.com  ", "https://screenova.example")).toEqual({
      email: "developer@example.com", options: { shouldCreateUser: true, emailRedirectTo: "https://screenova.example/auth/callback" },
    });
  });
  it("keeps the callback on the app origin and discards paths and query parameters", () => {
    expect(emailAccessRequest("dev@example.com", "http://localhost:3001/login?next=https://evil.example").options.emailRedirectTo).toBe("http://localhost:3001/auth/callback");
  });
});
