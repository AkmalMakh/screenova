import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LoginForm } from "./login-form";

describe("sign-in provider presentation", () => {
  it("shows GitHub with email hidden for the OAuth-only launch", () => {
    const html = renderToStaticMarkup(createElement(LoginForm, { providers: { google: false, github: true, email: false } }));
    expect(html).toContain("Continue with GitHub");
    expect(html).toContain("No repository access requested");
    expect(html).not.toContain("Continue with email");
    expect(html).not.toContain("disabled=");
  });
  it("disables sign-in and explains an unavailable provider", () => {
    const html = renderToStaticMarkup(createElement(LoginForm, { providers: { google: false, github: false, email: false } }));
    expect(html).not.toContain("<button");
    expect(html).toContain("Sign-in is temporarily unavailable");
    expect(html).not.toContain("type=\"email\"");
  });
  it("retains email only when explicitly enabled", () => {
    const html = renderToStaticMarkup(createElement(LoginForm, { providers: { google: false, github: false, email: true } }));
    expect(html).toContain("Continue with email");
    expect(html).not.toContain("Continue with GitHub");
  });
  it.each([false, true])("shows Google with GitHub enabled=%s", (github) => {
    const html = renderToStaticMarkup(createElement(LoginForm, { providers: { google: true, github, email: false } }));
    expect(html).toContain("Continue with Google");
    expect(html).toContain("No Gmail or Drive access requested");
    expect(html.includes("Continue with GitHub")).toBe(github);
    expect(html).not.toContain("temporarily unavailable");
    expect(html).not.toContain("disabled=");
    expect(html).not.toContain("Continue with email");
  });
});
