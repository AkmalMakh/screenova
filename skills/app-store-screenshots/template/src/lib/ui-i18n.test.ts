import { describe, expect, it } from "vitest";
import { DICTIONARIES, plural, render, resolveUiLang } from "./ui-i18n";
import { de } from "./ui-translations/de";
import { en, type TranslationKey } from "./ui-translations/en";
import { es } from "./ui-translations/es";
import { fr } from "./ui-translations/fr";

const languages = { de, es, fr } as const;

function placeholders(text: string): string[] {
  return Array.from(text.matchAll(/\{(\w+)\}/g), (m) => m[1]);
}

describe("dictionary completeness", () => {
  it("every language defines exactly the en keys", () => {
    const enKeys = Object.keys(en).sort();
    for (const [code, dict] of Object.entries(languages)) {
      expect(Object.keys(dict).sort(), `${code} keys`).toEqual(enKeys);
    }
  });

  it("every translation uses the same placeholders as en", () => {
    for (const key of Object.keys(en) as TranslationKey[]) {
      const expected = placeholders(en[key]).sort();
      for (const [code, dict] of Object.entries(languages)) {
        expect(placeholders(dict[key]).sort(), `${code}:${key}`).toEqual(expected);
      }
    }
  });

  it("plural forms exist in the same keys in every language", () => {
    for (const key of Object.keys(en) as TranslationKey[]) {
      const hasPlural = en[key].includes("|");
      for (const [code, dict] of Object.entries(languages)) {
        expect(dict[key].includes("|"), `${code}:${key} plural presence`).toBe(hasPlural);
        if (hasPlural) {
          expect(dict[key].split("|").length, `${code}:${key} plural forms`).toBe(2);
        }
      }
    }
  });
});

describe("render", () => {
  it("substitutes variables", () => {
    expect(render(en, "toolbar.savedMinutes", { minutes: 3 })).toBe("saved 3m ago");
  });

  it("leaves unknown placeholders intact", () => {
    expect(render(en, "toolbar.savedMinutes", {})).toBe("saved {minutes}m ago");
  });

  it("picks the singular form when count is 1 and plural otherwise", () => {
    expect(render(en, "sidebar.screensCount", { count: 1 })).toBe("1 screen · drag to reorder");
    expect(render(en, "sidebar.screensCount", { count: 0 })).toBe("0 screens · drag to reorder");
    expect(render(en, "sidebar.screensCount", { count: 5 })).toBe("5 screens · drag to reorder");
  });

  it("applies the plural rule in every language", () => {
    for (const dict of Object.values(languages)) {
      const one = render(dict, "sidebar.screensCount", { count: 1 });
      const many = render(dict, "sidebar.screensCount", { count: 2 });
      expect(one).not.toBe(many);
      expect(one.split("·")[0].trim()).toMatch(/^1 /);
    }
  });

  it("returns the key itself for unknown keys", () => {
    expect(render(en, "nope.missing" as TranslationKey)).toBe("nope.missing");
  });
});

describe("resolveUiLang", () => {
  it("honors a valid stored choice", () => {
    expect(resolveUiLang("de", "en-US")).toBe("de");
  });

  it("falls through invalid stored values", () => {
    expect(resolveUiLang("xx", "fr")).toBe("fr");
    expect(resolveUiLang("not-a-lang", "pt-BR")).toBe("en");
  });

  it("matches the browser language prefix", () => {
    expect(resolveUiLang(null, "de-AT")).toBe("de");
    expect(resolveUiLang(null, "en-US")).toBe("en");
    expect(resolveUiLang(null, "pt-BR")).toBe("en");
    expect(resolveUiLang(null, "")).toBe("en");
  });
});

describe("plural", () => {
  it("picks one vs many by count", () => {
    expect(plural(1, "a", "b")).toBe("a");
    expect(plural(0, "a", "b")).toBe("b");
    expect(plural(2, "a", "b")).toBe("b");
  });
});

describe("DICTIONARIES", () => {
  it("exposes all four languages", () => {
    expect(Object.keys(DICTIONARIES).sort()).toEqual(["de", "en", "es", "fr"]);
  });
});
