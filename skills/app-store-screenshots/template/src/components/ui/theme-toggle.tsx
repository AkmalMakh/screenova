"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/landing/use-theme";
import { Button } from "./button";

/** Workspace appearance only; never changes a deck's theme or export. */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return <Button type="button" variant="ghost" size="icon" onClick={toggleTheme}
    aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}>
    {theme === "dark" ? <Sun /> : <Moon />}
  </Button>;
}
