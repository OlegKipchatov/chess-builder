import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ThemeProvider, useTheme } from "../../src/app/providers/ThemeProvider";
const Choice = () => {
  const { theme, setTheme } = useTheme();
  return (
    <select
      aria-label="Тема"
      value={theme}
      onChange={(e) => setTheme(e.target.value as "system" | "light" | "dark")}
    >
      <option>system</option>
      <option>light</option>
      <option>dark</option>
    </select>
  );
};
const setup = () => {
  let callback = () => {};
  const system = {
    matches: true,
    addEventListener: vi.fn((_name, fn) => {
      callback = fn;
    }),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal("matchMedia", () => system);
  const view = render(
    <ThemeProvider>
      <Choice />
    </ThemeProvider>,
  );
  return { ...view, system, change: () => act(() => callback()) };
};
describe("theme parity", () => {
  it("tracks OS until explicitly overridden and cleans up its subscription", () => {
    const view = setup();
    expect(document.documentElement.dataset.theme).toBe("dark");
    view.system.matches = false;
    view.change();
    expect(document.documentElement.dataset.theme).toBe("light");
    fireEvent.change(screen.getByLabelText("Тема"), {
      target: { value: "dark" },
    });
    expect(localStorage.getItem("gachachess-theme")).toBe("dark");
    view.change();
    expect(document.documentElement.dataset.theme).toBe("dark");
    fireEvent.change(screen.getByLabelText("Тема"), {
      target: { value: "system" },
    });
    expect(document.documentElement.dataset.theme).toBe("light");
    view.unmount();
    expect(view.system.removeEventListener).toHaveBeenCalled();
  });
  it("restores preferences, handles cross-tab clearing and still works when storage is blocked", () => {
    localStorage.setItem("gachachess-theme", "light");
    const view = setup();
    expect(document.documentElement.dataset.theme).toBe("light");
    act(() =>
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "gachachess-theme",
          newValue: "dark",
        }),
      ),
    );
    expect(screen.getByLabelText("Тема")).toHaveValue("dark");
    act(() =>
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "gachachess-theme",
          newValue: null,
        }),
      ),
    );
    expect(screen.getByLabelText("Тема")).toHaveValue("system");
    view.unmount();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw Error("Blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw Error("Blocked");
    });
    setup();
    fireEvent.change(screen.getByLabelText("Тема"), {
      target: { value: "light" },
    });
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
