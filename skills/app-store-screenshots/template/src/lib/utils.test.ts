import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("custom typography class merging", () => {
  it("preserves button contrast when a custom font size overrides the default", () => {
    expect(cn("text-sm text-primary-foreground", "text-footnote")).toBe("text-primary-foreground text-footnote");
  });
  it("still allows deliberate text color overrides", () => {
    expect(cn("text-body text-muted-foreground", "text-foreground")).toBe("text-body text-foreground");
  });
});
