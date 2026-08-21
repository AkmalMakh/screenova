"use client";
import React from 'react';
import { X, Sparkles, ArrowRight, Smartphone } from 'lucide-react';
import { SAMPLE_CAMPAIGNS } from './mock-data';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-neutral-200 bg-white p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
          <div>
            <h3 className="text-xl font-bold text-neutral-950">
              App Store Campaign Templates
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Pick a verified high-converting template to start customized editing.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              onClick={() => onSelectTemplate(tpl.prompt)}
              className="group cursor-pointer rounded-2xl border border-neutral-200 p-4 transition-all hover:border-purple-500 hover:shadow-md bg-[#FAFAFC]"
            >
              <div className="flex items-center justify-between">
                <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${tpl.color}`}>
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
                <span className="text-[11px] font-bold text-neutral-600 group-hover:text-purple-700 flex items-center gap-1">
                  Use in Studio <ArrowRight className="h-3 w-3" />
                </span>
                <span className="text-[10px] text-neutral-400">3 Screens</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
