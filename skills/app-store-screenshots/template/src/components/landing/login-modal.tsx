"use client";
import { Sparkles, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export function LoginModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm bg-card text-card-foreground">
        <Sparkles className="h-6 w-6 text-primary" />
        <DialogTitle>Open your workspace</DialogTitle>
        <DialogDescription>
          Create and edit your screenshot decks in Studio. Local mode needs no account or email verification.
        </DialogDescription>
        <p className="text-sm text-muted-foreground">
          Local projects stay on this computer. Cloud installations sign in with a verified email account and keep projects in private storage.
        </p>
        <button type="button" onClick={onSuccess} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">
          Open Studio <ArrowRight className="h-4 w-4" />
        </button>
      </DialogContent>
    </Dialog>
  );
}
