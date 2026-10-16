export function googleAccessRequest(origin: string) {
  return {
    provider: "google" as const,
    options: {
      redirectTo: `${new URL(origin).origin}/auth/callback`,
      // Basic identity only: no Gmail, Drive, or offline access.
      scopes: "openid email profile",
    },
  };
}
