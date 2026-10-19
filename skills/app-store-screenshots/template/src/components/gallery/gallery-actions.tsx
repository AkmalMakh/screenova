"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, EyeOff, LayoutTemplate, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PENDING_TEMPLATE_KEY } from "@/lib/gallery";

type Viewer =
  | { state: "loading" }
  | { state: "signed-out" }
  | { state: "signed-in"; mine: boolean; moderator: boolean; viewerId: string | null }
  | { state: "error" };

export function GalleryActions({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [viewer, setViewer] = React.useState<Viewer>({ state: "loading" });
  const [copied, setCopied] = React.useState(false);
  const [confirming, setConfirming] = React.useState<"unpublish" | "hide" | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/gallery/${encodeURIComponent(id)}`)
      .then(async (response) => {
        if (cancelled) return;
        if (response.status === 401) return setViewer({ state: "signed-out" });
        const json = (await response.json().catch(() => ({}))) as { ok?: boolean; mine?: boolean; moderator?: boolean; viewerId?: string | null };
        setViewer(response.ok && json.ok
          ? { state: "signed-in", mine: !!json.mine, moderator: !!json.moderator, viewerId: json.viewerId ?? null }
          : { state: "error" });
      })
      .catch(() => !cancelled && setViewer({ state: "error" }));
    return () => { cancelled = true; };
  }, [id]);

  function openTemplate() {
    // The studio picks this up after sign-in (or right away if signed in),
    // creates a project from the template and opens it in the editor.
    try { localStorage.setItem(PENDING_TEMPLATE_KEY, id); } catch { /* storage blocked: studio shows nothing */ }
    router.push("/studio");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy the link. Copy it from the address bar.");
    }
  }

  async function remove(kind: "unpublish" | "hide") {
    if (viewer.state !== "signed-in") return;
    setBusy(true);
    setError(null);
    try {
      const headers = new Headers({ "content-type": "application/json" });
      if (viewer.viewerId) headers.set("x-screenova-owner", viewer.viewerId);
      const response = await fetch(`/api/gallery/${encodeURIComponent(id)}`, {
        method: kind === "unpublish" ? "DELETE" : "PATCH",
        headers,
        ...(kind === "hide" ? { body: JSON.stringify({ hidden: true }) } : {}),
      });
      const json = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || !json.ok) throw new Error(json.error || "That didn't work. Try again.");
      router.push("/gallery");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That didn't work. Try again.");
      setBusy(false);
      setConfirming(null);
    }
  }

  const canUnpublish = viewer.state === "signed-in" && viewer.mine;
  const canHide = viewer.state === "signed-in" && viewer.moderator && !viewer.mine;

  return (
    <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="h-10 gap-2 rounded-sm" onClick={copyLink}>
          {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {copied ? "Link copied" : "Copy link"}
        </Button>
        <Button type="button" className="h-10 gap-2 rounded-sm px-5" onClick={openTemplate} aria-describedby="use-template-note">
          <LayoutTemplate className="h-4 w-4" aria-hidden />
          Use this template
        </Button>
      </div>
      <p id="use-template-note" className="text-caption text-muted-foreground sm:text-right">
        {viewer.state === "signed-out"
          ? `Sign in first; "${title}" opens as a new project after that.`
          : "Opens as a new project in your Studio."}
      </p>
      {(canUnpublish || canHide) && (
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {confirming ? (
            <>
              <Button type="button" variant="ghost" className="h-9 rounded-sm" onClick={() => setConfirming(null)} disabled={busy}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" className="h-9 gap-2 rounded-sm" onClick={() => void remove(confirming)} disabled={busy}>
                {confirming === "unpublish" ? "Remove from gallery" : "Hide for everyone"}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="h-9 gap-2 rounded-sm"
              onClick={() => setConfirming(canUnpublish ? "unpublish" : "hide")}
            >
              {canUnpublish ? <Trash2 className="h-4 w-4" aria-hidden /> : <EyeOff className="h-4 w-4" aria-hidden />}
              {canUnpublish ? "Unpublish" : "Hide post"}
            </Button>
          )}
        </div>
      )}
      {error && <p role="alert" className="text-caption text-destructive sm:text-right">{error}</p>}
    </div>
  );
}
