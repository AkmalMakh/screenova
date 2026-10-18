import { OUTAGE_REASSURANCE, OUTAGE_TITLE } from "./messages";
export function githubAccessRequest(origin: string) {
  return {
    provider: "github" as const,
    options: {
      redirectTo: `${new URL(origin).origin}/auth/callback`,
      // Required for confirmed-email workspace enrollment, including accounts
      // whose primary GitHub email is private. Never request repo permissions.
      scopes: "user:email",
    },
  };
}

export function signInError(reason: string | null): string {
  if (reason === "invite" || reason === "access") return "Workspace access is unavailable for this account. Use an account with a verified email or contact support.";
  if (reason === "expired") return "That sign-in attempt expired or was already used. Please try signing in again.";
  if (reason === "cancelled") return "Sign-in was cancelled. You can try again when you’re ready.";
  if (reason === "oauth") return "Sign-in could not be completed. Please try again.";
  if (reason === "session") return "Your session ended. Please sign in again.";
  if (reason === "unavailable") return `${OUTAGE_TITLE}. ${OUTAGE_REASSURANCE} Try again shortly.`;
  return "";
}
