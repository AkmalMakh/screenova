import { storageMode } from "@/lib/supabase/config";
import { LoginForm } from "@/components/auth/login-form";
import Link from "next/link";

export const dynamic = "force-dynamic";
export default function LoginPage() {
  if (storageMode() === "local") return <main className="mx-auto max-w-md space-y-4 p-8"><h1 className="text-2xl font-semibold">Your local workspace</h1><p>Cloud sign-in is not enabled in this installation.</p><Link href="/studio" className="text-primary underline">Open Studio</Link></main>;
  return <LoginForm configured={!!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY} />;
}
