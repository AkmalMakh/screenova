"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/landing/use-theme";
import { useMaybeT } from "@/lib/ui-i18n";
import { Button } from "./button";

/** Workspace appearance only; never changes a deck's theme or export. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const t = useMaybeT();
  const label = theme === "dark" ? t("theme.toLight") : t("theme.toDark");
  return <Button type="button" variant="ghost" size="icon" className={className} onClick={toggleTheme}
    aria-label={label} title={label}>
    {theme === "dark" ? <Sun /> : <Moon />}
  </Button>;
}
