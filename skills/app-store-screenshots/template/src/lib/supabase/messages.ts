// User-facing copy for cloud access failures. Kept free of server-only imports
// so the edge middleware and the node route helpers can share one wording.
import { SUPPORT_EMAIL } from "../support";

export const LIMIT_REACHED = "Daily beta limit reached. Please try again tomorrow.";
export const WORKSPACE_UNAVAILABLE = "Cloud workspace is unavailable. No local data was accessed.";
export const ACCESS_UNAVAILABLE = "Workspace access is unavailable. Confirm your email or contact support.";
// The database refused an already signed-in member (not a quota): no email advice.
export const ACTION_UNAVAILABLE = `This action isn't available for your account. Contact ${SUPPORT_EMAIL} if this keeps happening.`;

// One outage headline and one reassurance for the /login?reason=unavailable
// banner, where the middleware and workspace guard both send users in an outage.
export const OUTAGE_TITLE = "Cloud workspace is unavailable";
export const OUTAGE_REASSURANCE = "The problem is on our side. Edits already saved in this browser are kept.";
