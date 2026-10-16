import { redirect } from "next/navigation";
import { authorizeRequest } from "@/lib/supabase/access";
import { AccountBoundary } from "./account-boundary";

export async function WorkspaceAccess({ children }: { children: React.ReactNode }) {
  const access = await authorizeRequest();
  if ("response" in access) redirect(`/login?reason=${access.response.status === 403 ? "access" : "session"}`);
  return <AccountBoundary key={access.userId || "local"} userId={access.userId}>{children}</AccountBoundary>;
}
