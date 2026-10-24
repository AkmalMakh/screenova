import type { T } from "./ui-i18n";

// "Updated 3h ago" for project lists (Studio cards, editor project menu).
// Past a month the date reads better than a large relative number.
export function formatUpdatedAt(updatedAt: number, t: T["t"], now = Date.now()): string {
  if (!updatedAt) return t("home.updatedNow");
  const seconds = Math.max(0, (now - updatedAt) / 1000);
  if (seconds < 60) return t("home.updatedNow");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t("home.updatedMinutes", { minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("home.updatedHours", { hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return t("home.updatedDays", { days });
  return new Date(updatedAt).toLocaleDateString();
}
