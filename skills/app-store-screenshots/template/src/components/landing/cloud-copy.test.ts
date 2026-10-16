import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FAQ } from "./faq";
import { PricingSection } from "./pricing-section";
import { SocialProof } from "./social-proof";

// Regression: hosted visitors were told they needed no account and that
// their designs lived on their computer, despite private cloud persistence.
describe("storage-mode-specific landing copy", () => {
  it("describes private account storage and usage limits in cloud mode", () => {
    const html = renderToStaticMarkup(createElement(PricingSection, {
      cloud: true, onSelectPlan: () => {},
    }));
    expect(html).toContain("Your private design workspace");
    expect(html).toContain("daily usage limits");
    expect(html).not.toContain("without an account");
    expect(html).not.toContain("stay on your computer");
  });
  it("preserves the account-free local entry", () => {
    const html = renderToStaticMarkup(createElement(PricingSection, {
      cloud: false, onSelectPlan: () => {},
    }));
    expect(html).toContain("Use local Studio without an account");
    expect(html).toContain("stay on your computer");
  });
  it("explains cloud sign-in without requiring a visitor API key", () => {
    const html = renderToStaticMarkup(createElement(FAQ, { cloud: true }));
    expect(html).toContain("Sign in to create your private workspace");
    expect(html).toContain("No. Screenova handles the server-side AI connection");
    expect(html).not.toContain("Not in local mode");
    expect(html).not.toContain("Local mode keeps a JSON workspace");
  });
  it("does not promise Git storage or a generation time for hosted accounts", () => {
    const html = renderToStaticMarkup(createElement(SocialProof, { cloud: true }));
    expect(html).toContain("Private account storage");
    expect(html).not.toContain("Git-tracked");
    expect(html).not.toContain("2 min");
  });
});
