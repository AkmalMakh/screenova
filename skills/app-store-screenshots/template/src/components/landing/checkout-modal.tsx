"use client";
import { ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { PricingPlan } from "./types";

export function CheckoutModal({ plan, onClose, onSuccess }: {
  plan: PricingPlan; onClose: () => void; onSuccess: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md bg-white text-neutral-900">
        <DialogTitle>{plan.name} in Studio</DialogTitle>
        <DialogDescription>
          Billing is not connected in this installation. You can use the editor and export screenshots without a subscription.
        </DialogDescription>
        <p className="text-sm text-neutral-600">
          Cloud access requires a verified email. AI design uses the server&apos;s OpenAI key.
        </p>
        <button type="button" onClick={onSuccess} className="flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-3 text-sm font-semibold text-white">
          Open Studio <ArrowRight className="h-4 w-4" />
        </button>
      </DialogContent>
    </Dialog>
  );
}
