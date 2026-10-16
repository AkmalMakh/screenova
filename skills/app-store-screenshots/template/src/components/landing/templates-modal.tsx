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
      color: 'bg-purple-100 text-purple-700 border-purple-200',
      prompt: 'Minimalist fintech budget tracker with violet gradients',
    },
    {
      id: 'fitness',
      title: 'Fitness & Workout Pulse',
      description: 'Energetic coral and rose gradients with GPS tracking and calorie progress ring.',
      tag: 'HEALTH',
      color: 'bg-rose-100 text-rose-700 border-rose-200',
      prompt: 'High energy fitness workout tracker with coral gradients',
    },
    {
      id: 'habit',
      title: 'Mindful Daily Habit Tracker',
      description: 'Calm sage green and cream tones for mindfulness, journaling, and meditation.',
      tag: 'LIFESTYLE',
      color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      prompt: 'Serene mindful meditation habit tracker in emerald green',
    },
    {
      id: 'ai-notes',
      title: 'AI Note-Taker & Audio Transcriber',
      description: 'Futuristic indigo and obsidian layout featuring voice waveform visualizations.',
      tag: 'PRODUCTIVITY',
      color: 'bg-indigo-100 text-indigo-700 border-indigo-200',
      prompt: 'AI audio voice note transcriber with indigo theme',
    },
  ];

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto rounded-3xl border-neutral-200 bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
          <div>
            <DialogTitle className="text-xl font-bold text-neutral-950">App Store Design Directions</DialogTitle>
            <DialogDescription className="mt-0.5 text-xs text-neutral-500">Choose a starting prompt, then add your app details and screenshots in Studio.</DialogDescription>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {templates.map((tpl) => (
            <button type="button"
              key={tpl.id}
              onClick={() => onSelectTemplate(tpl.prompt)}
              className="group cursor-pointer rounded-2xl border border-neutral-200 bg-[#FAFAFC] p-4 text-left transition-colors hover:border-purple-500 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className={`rounded-sm border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${tpl.color}`}>
                  {tpl.tag}
                </span>
                <Sparkles className="h-3.5 w-3.5 text-neutral-400 group-hover:text-purple-600 transition" />
              </div>

              <h4 className="mt-3 text-sm font-bold text-neutral-900 group-hover:text-purple-700 transition">
                {tpl.title}
              </h4>
              <p className="mt-1 text-xs text-neutral-500 leading-relaxed">
                {tpl.description}
              </p>

              <div className="mt-4 flex items-center justify-between pt-3 border-t border-neutral-200/60">
                <span className="text-[12px] font-bold text-neutral-600 group-hover:text-purple-700 flex items-center gap-1">
                  Use in Studio <ArrowRight className="h-3 w-3" />
                </span>
                <span className="text-[12px] text-neutral-400">Editable draft</span>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
