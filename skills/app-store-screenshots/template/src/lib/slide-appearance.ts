import { z } from "zod";

export const backgroundFillSchema = z.object({
  angle: z.number().finite().min(0).max(360),
  stops: z.array(z.object({
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    position: z.number().finite().min(0).max(100),
  })).min(2).max(5),
});
export const frameStyleSchema = z.enum(["device", "white", "dark"]);
export const headlineStyleSchema = z.object({
  fontSize: z.number().finite().min(20).max(250),
  fontWeight: z.number().int().min(300).max(900),
  lineHeight: z.number().finite().min(0.9).max(1.6),
  align: z.enum(["left", "center", "right"]),
});
export type BackgroundFill = z.infer<typeof backgroundFillSchema>;
export type FrameStyle = z.infer<typeof frameStyleSchema>;
export type HeadlineStyle = z.infer<typeof headlineStyleSchema>;

export function backgroundFillCss(fill: BackgroundFill): string {
  const stops = [...fill.stops].sort((a, b) => a.position - b.position);
  return `linear-gradient(${fill.angle}deg, ${stops.map(s => `${s.color} ${s.position}%`).join(", ")})`;
}
