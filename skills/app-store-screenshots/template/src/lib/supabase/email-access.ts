// Passwordless sign-in also registers a new account. Supabase must confirm the
// email before the database enrollment trigger grants private workspace access.
export function emailAccessRequest(email: string, origin: string) {
  return { email: email.trim(), options: { shouldCreateUser: true, emailRedirectTo: `${new URL(origin).origin}/auth/callback` } };
}
