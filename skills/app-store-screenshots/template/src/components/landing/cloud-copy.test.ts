import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FAQ } from "./faq";

// Regression: hosted visitors were told they needed no account and that
// their designs lived on their computer, despite private cloud persistence.
describe("storage-mode-specific landing copy", () => {
  it("explains cloud sign-in without requiring a visitor API key", () => {
    const html = renderToStaticMarkup(createElement(FAQ, { cloud: true }));
    expect(html).toContain("Sign in to create your private workspace");
    expect(html).toContain("No. Screenova handles the server-side AI connection");
    expect(html).not.toContain("Not in local mode");
    expect(html).not.toContain("Local mode keeps a JSON workspace");
  });
  it("preserves the account-free local answers", () => {
    const html = renderToStaticMarkup(createElement(FAQ, { cloud: false }));
    expect(html).toContain("Not in local mode");
    expect(html).toContain("projects stay on your computer");
  });
});
