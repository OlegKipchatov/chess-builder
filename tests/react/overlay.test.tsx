import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, it, expect, vi } from "vitest";
import {
  OverlayProvider,
  useOverlays,
} from "../../src/app/providers/OverlayProvider";
const Harness = () => {
  const { show, toast } = useOverlays();
  const next = () =>
    show({ title: "Вторая награда", body: <button>Готово</button> });
  return (
    <main>
      <h1>Игра</h1>
      <button
        onClick={() =>
          show({
            title: "Первая награда",
            onClose: next,
            body: (
              <>
                <textarea aria-label="PGN" />
                <button onClick={next}>Продолжить</button>
              </>
            ),
          })
        }
      >
        Открыть
      </button>
      <button
        onClick={() =>
          show({
            title: "Превращение",
            dismissible: false,
            body: <button onClick={() => show(null)}>Ферзь</button>,
          })
        }
      >
        Пешка
      </button>
      <button onClick={() => toast("Ошибка", { error: true })}>Ошибка</button>
      <button onClick={() => toast("Выбрано")}>Обычное</button>
    </main>
  );
};
const setup = () =>
  render(
    <StrictMode>
      <OverlayProvider>
        <Harness />
      </OverlayProvider>
    </StrictMode>,
  );
describe("React overlays parity", () => {
  it("keeps one native modal during a sequence, focuses static heading and restores focus", () => {
    setup();
    const trigger = screen.getByText("Открыть");
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = document.querySelector("dialog")!;
    expect(dialog.open).toBe(true);
    expect(document.body).toHaveClass("dialog-open");
    expect(screen.getByText("Первая награда")).toHaveFocus();
    expect(screen.getByLabelText("PGN")).not.toHaveFocus();
    const close = vi.spyOn(dialog, "close");
    fireEvent.click(screen.getByLabelText("Закрыть"));
    expect(screen.getByText("Вторая награда")).toHaveFocus();
    expect(close).not.toHaveBeenCalled();
    expect(document.querySelectorAll("dialog")).toHaveLength(1);
    fireEvent.click(screen.getByLabelText("Закрыть"));
    expect(dialog.open).toBe(false);
    expect(document.body).not.toHaveClass("dialog-open");
    expect(trigger).toHaveFocus();
  });
  it("non-dismissible promotion survives cancel and backdrop", () => {
    setup();
    fireEvent.click(screen.getByText("Пешка"));
    const dialog = document.querySelector("dialog")!;
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    fireEvent.click(dialog);
    expect(dialog.open).toBe(true);
    expect(screen.queryByLabelText("Закрыть")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Ферзь"));
    expect(dialog.open).toBe(false);
  });
  it("restores a safe fallback if the trigger disappears", () => {
    setup();
    const trigger = screen.getByText("Пешка");
    trigger.focus();
    fireEvent.click(trigger);
    trigger.remove();
    fireEvent.click(screen.getByText("Ферзь"));
    expect(screen.getByText("Игра")).toHaveFocus();
  });
  it("a normal toast resets the error tone and its five second timeout", () => {
    vi.useFakeTimers();
    const view = setup();
    fireEvent.click(screen.getByText("Ошибка"));
    expect(screen.getByRole("status")).toHaveAttribute("data-tone", "error");
    act(() => vi.advanceTimersByTime(4000));
    fireEvent.click(screen.getByText("Обычное"));
    expect(screen.getByRole("status")).toHaveAttribute("data-tone", "neutral");
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole("status")).toBeVisible();
    act(() => vi.advanceTimersByTime(4000));
    expect(document.querySelector("#toast")).not.toBeVisible();
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
  it("mobile height morph is 200ms; obsolete exit completion cannot close the next dialog", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("max-width"),
      addEventListener() {},
      removeEventListener() {},
    }));
    let finish!: () => void;
    const animate = vi.fn(() => ({
      cancel: vi.fn(),
      finished: new Promise<void>((resolve) => {
        finish = resolve;
      }),
    }));
    Object.defineProperty(HTMLElement.prototype, "animate", {
      configurable: true,
      value: animate,
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function () {
        return {
          height: this.textContent?.includes("Вторая") ? 200 : 100,
        } as DOMRect;
      },
    );
    setup();
    fireEvent.click(screen.getByText("Открыть"));
    fireEvent.click(screen.getByText("Продолжить"));
    expect(animate.mock.calls[0][1]).toMatchObject({ duration: 200 });
    fireEvent.click(screen.getByLabelText("Закрыть"));
    const obsolete = finish;
    fireEvent.click(screen.getByText("Пешка"));
    await act(async () => obsolete());
    expect(screen.getByText("Превращение")).toBeVisible();
  });
});
