import { describe, expect, it } from "vitest";
import { DeckStreamScanner, splitLines } from "./deck-stream";

const deck = {
  appName: "Mote",
  themeId: "clean-light",
  theme: { name: "Calm", bg: "#ffffff", bgAlt: "#000000", fg: "#111111", fgAlt: "#ffffff", accent: "#6d4aff", muted: "#777777" },
  summary: "Two screens {with braces} and \"quotes\", plus a ] bracket.",
  slides: [
    { layout: "hero", copy: { en: { label: "", headline: "Plan your day" } }, decorations: [{ id: "a", transform: { x: 1 } }] },
    { layout: "device-bottom", copy: { en: { label: "BUDGET", headline: "Know where it goes" } }, textElements: [] },
  ],
};

function scan(text: string, chunk: number) {
  const fields: Record<string, unknown> = {};
  const slides: Array<[number, unknown]> = [];
  const scanner = new DeckStreamScanner((key, value) => { fields[key] = value; }, (index, value) => slides.push([index, value]));
  for (let i = 0; i < text.length; i += chunk) scanner.push(text.slice(i, i + chunk));
  return { fields, slides };
}

describe("DeckStreamScanner", () => {
  it("reports every field and screen, whatever the chunk size", () => {
    const text = JSON.stringify(deck, null, 2);
    for (const chunk of [1, 3, 17, text.length]) {
      const { fields, slides } = scan(text, chunk);
      expect(fields).toEqual({ appName: deck.appName, themeId: deck.themeId, theme: deck.theme, summary: deck.summary });
      expect(slides).toEqual([[0, deck.slides[0]], [1, deck.slides[1]]]);
    }
  });

  it("reports a screen as soon as it closes, before the deck ends", () => {
    const text = JSON.stringify(deck);
    const cut = text.indexOf('{"layout":"device-bottom"');
    const { fields, slides } = scan(text.slice(0, cut), 5);
    expect(slides).toEqual([[0, deck.slides[0]]]);
    expect(fields.theme).toEqual(deck.theme);
  });

  it("ignores a code fence or sentence before the JSON", () => {
    const { slides } = scan(`Here it is:\n\`\`\`json\n${JSON.stringify(deck)}\n\`\`\``, 7);
    expect(slides).toHaveLength(2);
  });

  it("skips a screen that is not valid JSON and keeps counting", () => {
    const text = '{"appName":"A","slides":[{"layout":"hero",},{"layout":"hero"}]}';
    const { fields, slides } = scan(text, 4);
    expect(fields.appName).toBe("A");
    expect(slides).toEqual([[1, { layout: "hero" }]]);
  });
});

describe("splitLines", () => {
  it("keeps an unfinished line for the next chunk", () => {
    expect(splitLines('{"a":1}\n\n{"b":')).toEqual({ lines: ['{"a":1}'], rest: '{"b":' });
  });
});
