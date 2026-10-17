"use client";
import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface TemplatesModalProps {
  onClose: () => void;
  onSelectTemplate: (prompt: string) => void;
}

export const TemplatesModal: React.FC<TemplatesModalProps> = ({ onClose, onSelectTemplate }) => {
  const templates = [
    {
      id: 'fintech',
      title: 'Fintech & Digital Banking',
      description: 'Sleek lilac and violet gradients with security certifications and balance metrics.',
      tag: 'FINANCE',
      prompt: 'Minimalist fintech budget tracker with violet gradients',
    },
    {
      id: 'fitness',
      title: 'Fitness & Workout Pulse',
      description: 'Energetic coral and rose gradients with GPS tracking and calorie progress ring.',
      tag: 'HEALTH',
      prompt: 'High energy fitness workout tracker with coral gradients',
    },
    {
      id: 'habit',
      title: 'Mindful Daily Habit Tracker',
      description: 'Calm sage green and cream tones for mindfulness, journaling, and meditation.',
      tag: 'LIFESTYLE',
      prompt: 'Serene mindful meditation habit tracker in emerald green',
    },
    {
      id: 'ai-notes',
      title: 'AI Note-Taker & Audio Transcriber',
      description: 'Futuristic indigo and obsidian layout featuring voice waveform visualizations.',
      tag: 'PRODUCTIVITY',
      prompt: 'AI audio voice note transcriber with indigo theme',
    },
  ];

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto rounded-2xl border-border bg-card p-6 shadow-pop sm:p-8">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div>
            <DialogTitle className="text-title2 font-semibold text-foreground">App Store Design Directions</DialogTitle>
            <DialogDescription className="mt-0.5 text-footnote text-muted-foreground">Choose a starting prompt, then add your app details and screenshots in Studio.</DialogDescription>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {templates.map((tpl) => (
            <button type="button"
              key={tpl.id}
              onClick={() => onSelectTemplate(tpl.prompt)}
              className="group cursor-pointer rounded-lg border border-border bg-background p-4 text-left transition-colors hover:border-primary"
            >
              <div className="flex items-center justify-between">
                <span className={`rounded-sm border px-2 py-0.5 text-caption font-semibold uppercase tracking-wider border-border bg-muted text-muted-foreground`}>
                  {tpl.tag}
                </span>
                <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
              </div>

              <h3 className="mt-3 text-subhead font-semibold text-foreground transition-colors group-hover:text-primary">
                {tpl.title}
              </h3>
              <p className="mt-1 text-footnote text-muted-foreground">
                {tpl.description}
              </p>

              <div className="mt-4 flex items-center justify-between pt-3 border-t border-border">
                <span className="flex items-center gap-1 text-caption font-semibold text-muted-foreground transition-colors group-hover:text-primary">
                  Use in Studio <ArrowRight aria-hidden="true" className="h-3 w-3" />
                </span>
                <span className="text-caption text-muted-foreground">Editable draft</span>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
