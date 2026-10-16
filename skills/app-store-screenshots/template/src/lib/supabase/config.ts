export function storageMode(): "local" | "supabase" {
  const mode = process.env.APP_STORAGE_MODE;
  if (mode && mode !== "local" && mode !== "supabase") throw new Error("Invalid APP_STORAGE_MODE");
  // A copied local environment must never expose a shared workspace on Vercel.
  // Local development remains available when run outside the hosted runtime.
  if (process.env.VERCEL === "1") return "supabase";
  if (mode === "local" || mode === "supabase") return mode;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) return "supabase";
  // Production must never silently expose the developer's local workspace.
  return process.env.NODE_ENV === "production" ? "supabase" : "local";
}

export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured");
  return { url, key };
}
