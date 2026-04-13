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
      className="cursor-pointer rounded-md p-2 text-muted transition-colors duration-150 ease-in-out hover:bg-surface-alt hover:text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background active:scale-[0.98]"
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
