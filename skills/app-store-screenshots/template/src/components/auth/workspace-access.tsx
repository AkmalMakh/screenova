import { redirect } from "next/navigation";
import { authorizeRequest } from "@/lib/supabase/access";
import { AccountBoundary } from "./account-boundary";

export async function WorkspaceAccess({ children }: { children: React.ReactNode }) {
  const access = await authorizeRequest();
  if ("response" in access) {
    const { status } = access.response;
    // 503 is our outage, not the user's session: never ask them to sign in again.
    redirect(`/login?reason=${status === 403 ? "access" : status === 503 ? "unavailable" : "session"}`);
  }
  return <AccountBoundary key={access.userId || "local"} userId={access.userId}>{children}</AccountBoundary>;
}
