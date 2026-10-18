import { storageMode } from "@/lib/supabase/config";
import { LoginForm } from "@/components/auth/login-form";
import Link from "next/link";
import { getSignInOptions } from "@/lib/supabase/sign-in-options";

export const dynamic = "force-dynamic";
export default async function LoginPage() {
  if (storageMode() === "local") return <main className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-12 text-foreground">
    <Link href="/" className="mb-8 flex items-center gap-2" aria-label="Screenova home">
      <span className="font-sans text-[19px] italic">S.</span>
      <span className="text-[13px] font-semibold tracking-tight">Screenova</span>
    </Link>
    <section className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-sm">
      <h1 className="text-title2 font-semibold tracking-tight">Your local workspace</h1>
      <p className="mt-2 text-body text-muted-foreground">Cloud sign-in is not enabled in this installation. Projects and images stay on this computer, so there is nothing to sign in to.</p>
      <Link href="/studio" className="btn-press mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-sm bg-primary px-5 text-footnote font-semibold text-primary-foreground hover:bg-primary-hover active:bg-primary-active">Open Studio</Link>
      <p className="mt-4 text-center text-caption text-muted-foreground"><Link href="/" className="underline underline-offset-4 hover:text-foreground">Back to the overview</Link></p>
    </section>
  </main>;
  return <LoginForm providers={await getSignInOptions()} />;
}
