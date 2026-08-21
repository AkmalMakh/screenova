"use client";
import React, { useState } from 'react';
import { X, Check, Sparkles, ShieldCheck } from 'lucide-react';
import confetti from 'canvas-confetti';
import { PricingPlan } from './types';

interface CheckoutModalProps {
  plan: PricingPlan;
  onClose: () => void;
  onSuccess: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ plan, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);

  const handleSubscribe = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setComplete(true);
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.5 },
      });
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-neutral-200 bg-white p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#6E3FF3] text-white">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-bold text-neutral-900">Upgrade to {plan.name}</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 rounded-2xl bg-purple-50/70 border border-purple-200/80 p-4">
          <div className="flex items-baseline justify-between">
            <h4 className="text-base font-bold text-neutral-900">{plan.name} Plan</h4>
            <div className="text-xl font-extrabold text-neutral-950">
              ${plan.priceMonthly}<span className="text-xs text-neutral-500 font-normal">/month</span>
            </div>
          </div>
          <p className="mt-1 text-xs text-neutral-600">{plan.tagline}</p>

          <ul className="mt-3 space-y-1.5 border-t border-purple-200/60 pt-3">
            {plan.features.map((f, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-neutral-700">
                <Check className="h-3 w-3 text-purple-600 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 space-y-3">
          <button
            onClick={handleSubscribe}
            disabled={loading || complete}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#6E3FF3] py-3 text-xs font-bold text-white shadow-md shadow-purple-600/25 hover:bg-[#5C2EE0] transition disabled:opacity-75"
          >
            {complete ? (
              <>
                <Check className="h-4 w-4 text-emerald-300" />
                <span>Plan Activated!</span>
              </>
            ) : loading ? (
              <span>Activating subscription...</span>
            ) : (
              <span>Confirm & Start 14-Day Free Trial</span>
            )}
          </button>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-neutral-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>Cancel anytime. No lock-in contracts.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
