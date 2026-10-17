import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The one marketing section title. Every landing section used to hand-roll
 * `text-3xl sm:text-4xl font-semibold tracking-tight`; this keeps size,
 * tracking and balanced wrapping in one place. Layout (width, margin,
 * alignment) stays with the caller.
 */
export function SectionHeading({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <h2 className={cn("text-[30px] font-semibold leading-[1.15] tracking-[-0.03em] text-foreground [text-wrap:balance] sm:text-[36px]", className)}>
      {children}
    </h2>
  );
}
