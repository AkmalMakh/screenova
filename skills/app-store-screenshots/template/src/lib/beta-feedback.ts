import { z } from "zod";

// Beta cohort signals: a finished export, and what a member tells us about it.
// Both are insert-only for members; the operator reads them in the SQL Editor.

export const WOULD_USE = ["yes", "maybe", "no"] as const;
export type WouldUse = (typeof WOULD_USE)[number];
export type FeedbackContext = "menu" | "export";
export const FEEDBACK_MAX = 2000;

const projectId = z.string().trim().min(1).max(100).nullable().default(null);
const count = z.number().int().min(0).max(100_000);

export const feedbackSchema = z
  .object({
    projectId,
    wouldUse: z.enum(WOULD_USE).nullable().default(null),
    message: z.string().max(FEEDBACK_MAX).default(""),
    context: z.enum(["menu", "export"]).default("menu"),
  })
  .refine((value) => value.wouldUse !== null || value.message.trim().length > 0, {
    message: "Choose an answer or write a message.",
  });

export const exportEventSchema = z.object({
  kind: z.literal("export"),
  projectId,
  detail: z
    .object({
      device: z.string().max(40),
      screens: count,
      locales: count,
      sizes: count,
      files: count,
      failed: count,
    })
    .strict(),
});

export type Feedback = z.infer<typeof feedbackSchema>;
export type ExportEvent = z.infer<typeof exportEventSchema>;
