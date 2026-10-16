import {
createContext,
useContext,
useEffect,
useState,
type ReactNode,
} from "react";
type Theme = "system" | "light" | "dark";
const valid = (value: unknown): value is Theme =>
  value === "system" || value === "light" || value === "dark";
const Context = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
}>({ theme: "system", setTheme: () => {} });
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem("gachachess-theme");
      return valid(saved) ? saved : "system";
    } catch {
      return "system";
    }
  });
  useEffect(() => {
    const system = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const resolved =
        theme === "system" ? (system.matches ? "dark" : "light") : theme;
      document.documentElement.dataset.theme = resolved;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", resolved === "dark" ? "#111113" : "#f4f4f5");
    };
    apply();
    system.addEventListener("change", apply);
    return () => system.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    const change = (event: StorageEvent) => {
      if (event.key === "gachachess-theme")
        setTheme(valid(event.newValue) ? event.newValue : "system");
    };
    window.addEventListener("storage", change);
    return () => window.removeEventListener("storage", change);
  }, []);
  const choose = (next: Theme) => {
    setTheme(next);
    try {
      localStorage.setItem("gachachess-theme", next);
    } catch {
      /* Theme still works without storage. */
    }
  };
  return <Context value={{ theme, setTheme: choose }}>{children}</Context>;
};
export const useTheme = () => useContext(Context);
