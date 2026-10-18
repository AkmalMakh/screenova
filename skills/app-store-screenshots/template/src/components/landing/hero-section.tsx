"use client";
import React, { useState } from "react";
import { ArrowRight, Check } from "lucide-react";

interface HeroSectionProps {
  onGenerate: (prompt: string) => void;
  onStart?: () => void;
  onSelectPreset?: (presetId: string) => void;
}

export function HeroSection({ onGenerate, onStart }: HeroSectionProps) {
  const [prompt, setPrompt] = useState("");
  return (
    <section id="hero-section" className="overflow-hidden bg-background py-12 text-foreground sm:py-20">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
        <div>
          <p className="text-caption font-semibold uppercase tracking-[0.12em] text-muted-foreground">App Store &amp; Google Play screenshots</p>
          <h1 className="mt-5 text-[38px] font-semibold leading-[1.05] tracking-[-0.04em] sm:text-[52px]">Give your app the introduction it deserves.</h1>
          <p className="mt-6 max-w-lg text-body text-muted-foreground">Turn your app captures into a polished screenshot deck. Start with a description. Refine every detail.</p>
          <form className="mt-8 rounded-lg border border-input bg-card p-3 shadow-sm" onSubmit={(event) => { event.preventDefault(); onGenerate(prompt.trim() || "Make this feel like a calm premium wellness app."); }}>
            <label htmlFor="hero-direction" className="mb-2 block px-1 text-footnote font-medium">Your app or design direction</label>
            <input id="hero-direction" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Describe a design direction…" className="min-h-11 w-full rounded-sm bg-transparent px-1 text-base placeholder:text-muted-foreground" />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <span className="px-1 text-caption text-muted-foreground">Add screenshots in Studio</span>
              <button id="hero-generate-btn" type="submit" className="btn-press flex min-h-11 items-center gap-2 rounded-sm bg-primary px-5 text-footnote font-semibold text-primary-foreground hover:bg-primary-hover active:bg-primary-active">Design with AI <ArrowRight aria-hidden="true" className="h-4 w-4" /></button>
            </div>
          </form>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-caption text-muted-foreground"><span className="flex items-center gap-2"><Check aria-hidden="true" className="h-4 w-4" />Editable layouts</span><span className="flex items-center gap-2"><Check aria-hidden="true" className="h-4 w-4" />Exact export sizes</span></div>
        </div>
        <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3"><span className="text-footnote font-medium">MoteCalendar · Real output</span><button type="button" onClick={onStart} className="flex items-center gap-2 rounded-sm px-2 text-footnote text-primary">Open Studio <ArrowRight aria-hidden="true" className="h-4 w-4" /></button></div>
          <div className="grid grid-cols-3 items-start gap-3 bg-muted p-4 sm:gap-4 sm:p-6">
            {["01-hero","02-split-landscape","03-device-bottom"].map((slide, index) => <img key={slide} src={"/deck/" + slide + ".webp"} width={520} height={1125} alt={"MoteCalendar screenshot " + (index + 1)} className="hero-rise h-auto w-full rounded-xs shadow-sm" style={{ animationDelay: `${120 + index * 80}ms` }} />)}
          </div>
          <p className="border-t border-border px-5 py-4 text-caption text-muted-foreground">One coordinated story. Every screen stays yours to edit.</p>
        </div>
      </div>
    </section>
  );
}
