"use client";
import { Analytics } from "@vercel/analytics/next";

// Vercel Web Analytics: page views only, cookieless. Query strings and
// fragments are dropped before anything leaves the browser, so sign-in codes
// and other one-off parameters never reach the dashboard.
export function PageAnalytics() {
  return <Analytics beforeSend={(event) => ({ ...event, url: event.url.split(/[?#]/)[0] })} />;
}
