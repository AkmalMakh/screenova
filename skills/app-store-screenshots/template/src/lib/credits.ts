// Beta design credits. Mirrors supabase/migrations/202611090001_credits_by_call.sql:
// the database is the source of truth and enforces these; the app only shows them.
export const BETA_CREDITS = 400;
/** A first draft runs on the most capable model; a chat edit on a faster one. */
export const CREDIT_COST = { draft: 40, edit: 10 } as const;

/** Name of the browser event the editor fires after any AI request settles. */
export const CREDITS_CHANGED_EVENT = "screenova:credits-changed";

export type CreditsSnapshot = { credits: number; draft: number; edit: number; aiAccess: boolean };
