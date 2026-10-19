import { ToastNotification } from "../../src/shared/ui/ToastNotification";
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
      <button onClick={() => toast("Ошибка", { type: "error" })}>Ошибка</button>
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
  it("keeps duplicate actions and independent five-second deadlines", () => {
    vi.useFakeTimers();
    const view = setup();
    fireEvent.click(screen.getByRole("button", { name: "Ошибка" }));
    expect(
      screen.getByRole("alert").closest(".notification-card"),
    ).toHaveAttribute("data-tone", "error");
    act(() => vi.advanceTimersByTime(4000));
    fireEvent.click(screen.getByRole("button", { name: "Обычное" }));
    fireEvent.click(screen.getByRole("button", { name: "Обычное" }));
    expect(screen.getAllByText("Выбрано")).toHaveLength(2);
    expect(document.querySelectorAll(".toast-countdown circle")).toHaveLength(
      3,
    );
    act(() => vi.advanceTimersByTime(1000));
    expect(
      screen.getByRole("alert").closest(".notification-card"),
    ).toHaveAttribute("data-leaving");
    act(() => vi.advanceTimersByTime(180));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getAllByRole("status")).toHaveLength(2);
    act(() => vi.advanceTimersByTime(3820));
    act(() => vi.advanceTimersByTime(180));
    expect(document.querySelectorAll(".notification-card")).toHaveLength(0);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("shows three messages and stacks overflow without stealing focus", () => {
    setup();
    const action = screen.getByRole("button", { name: "Обычное" });
    action.focus();
    for (let index = 0; index < 6; index++) fireEvent.click(action);
    expect(
      document.querySelectorAll(".notification-card:not([data-stacked])"),
    ).toHaveLength(3);
    expect(
      document.querySelectorAll(
        ".notification-card[data-stacked][inert][aria-hidden=true]",
      ),
    ).toHaveLength(3);
    expect(screen.getAllByRole("status")).toHaveLength(3);
    expect(action).toHaveFocus();
  });
  it("preserves elapsed lifetime when opening and closing a modal", () => {
    vi.useFakeTimers();
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Обычное" }));
    act(() => vi.advanceTimersByTime(2000));
    fireEvent.click(screen.getByRole("button", { name: "Пешка" }));
    expect(screen.getByRole("status").closest("dialog")).not.toBeNull();
    expect(document.querySelector(".toast-countdown circle")).toHaveStyle({
      animationDelay: "-2000ms",
    });
    fireEvent.click(screen.getByRole("button", { name: "Ферзь" }));
    act(() => vi.advanceTimersByTime(3000));
    act(() => vi.advanceTimersByTime(180));
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("positions variable-height cards continuously and retains visible overflow layers", () => {
    const height = vi
      .spyOn(HTMLElement.prototype, "offsetHeight", "get")
      .mockImplementation(function (this: HTMLElement) {
        return Number(this.textContent?.match(/height=(\d+)/)?.[1] || 44);
      });
    const messages = [44, 80, 60, 90, 44, 44].map((value, id) => ({
      id,
      text: `height=${value}`,
      type: "neutral" as const,
      createdAt: Date.now(),
    }));
    const view = render(
      <ToastNotification messages={messages} onDismiss={() => {}} />,
    );
    const slots = () => [
      ...document.querySelectorAll<HTMLElement>(".notification-slot"),
    ];
    const original = slots()[0];
    expect(slots()[1].style.transform).toBe("translateY(52px) scale(1)");
    expect(slots()[2].style.transform).toBe("translateY(140px) scale(1)");
    expect(slots()[3].style.transform).toBe("translateY(120px) scale(0.96)");
    expect(
      slots()
        .slice(3)
        .map((slot) => slot.style.opacity),
    ).toEqual(["0.75", "0.5", "0.25"]);
    expect(slots().every((slot) => Number(slot.style.zIndex) > 0)).toBe(true);
    expect(slots()[3].textContent).toContain("height=90");
    view.rerender(
      <ToastNotification
        messages={[
          {
            id: 99,
            text: "height=100",
            type: "neutral",
            createdAt: Date.now(),
          },
          ...messages,
        ]}
        onDismiss={() => {}}
      />,
    );
    expect(slots()[1]).toBe(original);
    expect(original.style.transform).toBe("translateY(108px) scale(1)");
    height.mockRestore();
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
    expect(animate.mock.calls.at(-1)?.[1]).toMatchObject({
      duration: 180,
      fill: "forwards",
    });
    expect(document.querySelector("dialog")).toHaveClass("is-closing");
    fireEvent.click(screen.getByText("Пешка"));
    expect(document.querySelector("dialog")).not.toHaveClass("is-closing");
    await act(async () => obsolete());
    expect(screen.getByText("Превращение")).toBeVisible();
  });
});
