import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";
const KEY = "cronrunner.theme";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem(KEY) as Theme) || "system";
    } catch {
      return "system";
    }
  });
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && mq.matches);
      document.documentElement.classList.toggle("dark", dark);
    };
    apply();
    mq.addEventListener("change", apply);
    try {
      localStorage.setItem(KEY, theme);
    } catch {}
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
  return { theme, setTheme };
}
