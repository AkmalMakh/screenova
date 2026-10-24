// Beta design credits. Mirrors supabase/migrations/202610240001_beta_credits.sql:
// the database is the source of truth and enforces these; the app only shows them.
export const BETA_CREDITS = 300;
export const CREDITS_PER_DESIGN = 10;

/** Name of the browser event the editor fires after any AI request settles. */
export const CREDITS_CHANGED_EVENT = "screenova:credits-changed";

export type CreditsSnapshot = { credits: number; perCall: number };
