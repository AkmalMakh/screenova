// Single source of truth for the beta support contact. Override per deployment
// with NEXT_PUBLIC_SUPPORT_EMAIL; the default is the project owner's address so
// the "contact support" copy in the login form and access errors is reachable.
export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "akmal.makhmudov.career@gmail.com";

export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`;
