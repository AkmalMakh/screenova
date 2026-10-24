import { describe, expect, it } from "vitest";
import { formatUpdatedAt } from "./relative-time";
import { en } from "./ui-translations/en";
import { render } from "./ui-i18n";

const t = (key: Parameters<typeof render>[1], vars?: Record<string, string | number>) =>
  render(en, key, vars);

describe("formatUpdatedAt", () => {
  const now = Date.UTC(2026, 9, 18, 12, 0, 0);

  it("reads 'just now' for missing or sub-minute timestamps", () => {
    expect(formatUpdatedAt(0, t, now)).toBe("just now");
    expect(formatUpdatedAt(now - 30_000, t, now)).toBe("just now");
  });

  it("steps through minutes, hours and days", () => {
    expect(formatUpdatedAt(now - 5 * 60_000, t, now)).toBe("5m ago");
    expect(formatUpdatedAt(now - 3 * 3_600_000, t, now)).toBe("3h ago");
    expect(formatUpdatedAt(now - 4 * 86_400_000, t, now)).toBe("4d ago");
  });

  it("switches to a calendar date after a month", () => {
    const old = now - 40 * 86_400_000;
    expect(formatUpdatedAt(old, t, now)).toBe(new Date(old).toLocaleDateString());
  });
});
