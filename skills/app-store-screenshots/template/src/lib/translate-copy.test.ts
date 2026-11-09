import { describe, expect, it } from "vitest";
import { applyTranslations, collectCopy } from "./translate-copy";
import type { ProjectState, Slide } from "./types";

const slide = (label: Record<string, string>, headline: Record<string, string>, extra: Record<string, string>[] = []) =>
  ({ id: Math.random().toString(36), label, headline, textElements: extra.map((text, i) => ({ id: `text:${i}`, text })) }) as unknown as Slide;
const project = (iphone: Slide[], ipad: Slide[] = []) => ({ slidesByDevice: { iphone, ipad } }) as unknown as ProjectState;

describe("collecting copy to translate", () => {
  it("sends each distinct caption once, across devices, from the language being edited", () => {
    const state = project(
      [slide({ en: "PLAN" }, { en: "Plan your day" }, [{ en: "Voice-first" }]), slide({ en: "" }, { de: "Nur deutsch" })],
      [slide({ en: "PLAN" }, { en: "Plan your day" })],
    );
    expect(collectCopy(state, "en")).toEqual([
      { id: "t1", kind: "label", text: "PLAN" },
      { id: "t2", kind: "headline", text: "Plan your day" },
      { id: "t3", kind: "text", text: "Voice-first" },
    ]);
  });
});

describe("writing translations back", () => {
  const state = project([slide({ en: "PLAN", de: "PLANEN" }, { en: "Plan your day" }, [{ en: "Voice-first" }])], [slide({}, { en: "Plan your day" })]);
  const translations = {
    PLAN: { de: "TAG", ko: "계획" },
    "Plan your day": { de: "Plane deinen Tag", ko: "하루를 계획하세요" },
    "Voice-first": { ko: "음성 우선" },
  };

  it("fills missing languages everywhere the source text appears, keeping what was already written", () => {
    const next = applyTranslations(state, "en", translations, false);
    const [phone] = next.slidesByDevice.iphone!;
    expect(phone.label).toEqual({ en: "PLAN", de: "PLANEN", ko: "계획" });
    expect(phone.headline).toEqual({ en: "Plan your day", de: "Plane deinen Tag", ko: "하루를 계획하세요" });
    expect(phone.textElements?.[0].text).toEqual({ en: "Voice-first", ko: "음성 우선" });
    expect(next.slidesByDevice.ipad![0].headline.ko).toBe("하루를 계획하세요");
  });

  it("rewrites existing languages only when asked", () => {
    expect(applyTranslations(state, "en", translations, true).slidesByDevice.iphone![0].label.de).toBe("TAG");
  });

  it("leaves a caption edited during the request alone", () => {
    const edited = project([slide({ en: "PLAN" }, { en: "Plan your week" })]);
    expect(applyTranslations(edited, "en", translations, false).slidesByDevice.iphone![0].headline).toEqual({ en: "Plan your week" });
  });
});
