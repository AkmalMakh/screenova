import { storageMode } from "@/lib/supabase/config";
import { LoginForm } from "@/components/auth/login-form";
import Link from "next/link";
import { getSignInOptions } from "@/lib/supabase/sign-in-options";

export const dynamic = "force-dynamic";
export default async function LoginPage() {
  if (storageMode() === "local") return <main className="mx-auto max-w-md space-y-4 p-8"><h1 className="text-2xl font-semibold">Your local workspace</h1><p>Cloud sign-in is not enabled in this installation.</p><Link href="/studio" className="text-primary underline">Open Studio</Link></main>;
  return <LoginForm providers={await getSignInOptions()} />;
}
