"use client";

import { useThemeStore } from "@/stores/useThemeStore";
import MoonIcon from "./icons/MoonIcon";
import SunIcon from "./icons/SunIcon";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <button
      onClick={toggleTheme}
      data-testid="theme-toggle"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      className="cursor-pointer rounded-md p-2 text-muted transition-colors duration-150 hover:bg-surface-alt hover:text-foreground"
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
