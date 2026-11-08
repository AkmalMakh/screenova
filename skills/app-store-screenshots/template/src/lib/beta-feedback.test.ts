import { describe, expect, it } from "vitest";
import { exportEventSchema, feedbackSchema } from "./beta-feedback";

describe("beta feedback", () => {
  it("accepts an answer alone or a message alone, and needs one of them", () => {
    expect(feedbackSchema.safeParse({ wouldUse: "yes" }).success).toBe(true);
    expect(feedbackSchema.safeParse({ message: "Fonts are limited" }).success).toBe(true);
    expect(feedbackSchema.safeParse({ message: "   " }).success).toBe(false);
    expect(feedbackSchema.safeParse({}).success).toBe(false);
  });

  it("rejects unknown answers, contexts and oversized messages", () => {
    expect(feedbackSchema.safeParse({ wouldUse: "sure" }).success).toBe(false);
    expect(feedbackSchema.safeParse({ wouldUse: "no", context: "landing" }).success).toBe(false);
    expect(feedbackSchema.safeParse({ message: "x".repeat(2001) }).success).toBe(false);
  });

  it("fills defaults so the route stores a complete row", () => {
    const parsed = feedbackSchema.parse({ wouldUse: "maybe" });
    expect(parsed).toEqual({ projectId: null, wouldUse: "maybe", message: "", context: "menu" });
  });

  it("only records export events with the known detail fields", () => {
    const detail = { device: "iphone", screens: 5, locales: 2, sizes: 1, files: 10, failed: 0 };
    expect(exportEventSchema.safeParse({ kind: "export", projectId: "p1", detail }).success).toBe(true);
    expect(exportEventSchema.safeParse({ kind: "export", detail: { ...detail, appName: "Secret" } }).success).toBe(false);
    expect(exportEventSchema.safeParse({ kind: "page_view", detail }).success).toBe(false);
  });
});
