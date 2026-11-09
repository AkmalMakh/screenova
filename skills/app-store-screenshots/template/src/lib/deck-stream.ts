import type { SlideAnalysis } from "./import-slides";
import type { DeckSuggestion } from "./suggest-deck";
import type { Theme, ThemeId } from "./types";

// A first draft takes Claude a minute or more. Instead of a spinner, the
// route streams each screen the moment the model finishes writing it, so the
// editor can fill in while the rest of the deck is still being drafted.

/** One line of the suggest-deck stream (application/x-ndjson). */
export type DraftEvent =
  | { type: "start"; count: number }
  | { type: "ping" }
  | { type: "theme"; appName?: string; themeId?: ThemeId; customTheme?: Theme }
  | { type: "slide"; index: number; slide: SlideAnalysis }
  // The first attempt failed validation; screens streamed so far are discarded.
  | { type: "retry" }
  | { type: "done"; deck: DeckSuggestion }
  | { type: "error"; error: string; status: number };

export const DRAFT_STREAM_TYPE = "application/x-ndjson";

/**
 * Reads a JSON deck while it is still being written. Reports each top-level
 * field once its value is complete, and each element of the top-level
 * "slides" array as soon as that element closes. Text before the first "{"
 * (a code fence, a stray sentence) is ignored. Malformed fragments are
 * skipped: the complete reply is validated on its own afterwards.
 */
export class DeckStreamScanner {
  private text = "";
  private pos = 0;
  private started = false;
  private depth = 0;
  private inString = false;
  private escaped = false;
  private stringStart = -1;
  private pendingKey: string | null = null;
  private key: string | null = null;
  private valueStart = -1;
  private slideStart = -1;
  private slideIndex = 0;

  constructor(
    private readonly onField: (key: string, value: unknown) => void,
    private readonly onSlide: (index: number, value: unknown) => void,
  ) {}

  push(delta: string) {
    this.text += delta;
    for (; this.pos < this.text.length; this.pos += 1) this.step(this.text[this.pos], this.pos);
  }

  private step(char: string, at: number) {
    if (!this.started) {
      if (char === "{") {
        this.started = true;
        this.depth = 1;
      }
      return;
    }
    if (this.inString) {
      if (this.escaped) this.escaped = false;
      else if (char === "\\") this.escaped = true;
      else if (char === '"') {
        this.inString = false;
        // A string that closes directly inside the top-level object is a key
        // unless a value is already open there.
        if (this.depth === 1 && this.key === null) {
          this.pendingKey = parse(this.text.slice(this.stringStart, at + 1)) as string | null;
        }
      }
      return;
    }
    if (char === '"') {
      this.inString = true;
      this.stringStart = at;
      return;
    }
    if (this.depth === 1 && char === ":" && this.pendingKey !== null) {
      this.key = this.pendingKey;
      this.pendingKey = null;
      this.valueStart = at + 1;
      return;
    }
    if (char === "{" || char === "[") {
      this.depth += 1;
      if (this.depth === 3 && char === "{" && this.key === "slides") this.slideStart = at;
      return;
    }
    if (char === "}" || char === "]") {
      this.depth -= 1;
      if (this.depth === 2 && char === "}" && this.slideStart >= 0) {
        const slide = parse(this.text.slice(this.slideStart, at + 1));
        this.slideStart = -1;
        if (slide !== undefined) this.onSlide(this.slideIndex, slide);
        this.slideIndex += 1;
      }
      if (this.depth === 0) this.closeField(at);
      return;
    }
    if (this.depth === 1 && char === ",") this.closeField(at);
  }

  private closeField(end: number) {
    if (this.key === null) return;
    const key = this.key;
    this.key = null;
    if (key === "slides") return;
    const value = parse(this.text.slice(this.valueStart, end));
    if (value !== undefined) this.onField(key, value);
  }
}

function parse(fragment: string): unknown {
  try {
    return JSON.parse(fragment);
  } catch {
    return undefined;
  }
}

/** Splits a streamed body into complete lines, keeping the unfinished tail. */
export function splitLines(buffer: string): { lines: string[]; rest: string } {
  const parts = buffer.split("\n");
  const rest = parts.pop() ?? "";
  return { lines: parts.filter((line) => line.trim()), rest };
}
