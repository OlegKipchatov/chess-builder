import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Chess } from "chess.js";
import { OverlayProvider } from "../../src/app/providers/OverlayProvider";
import { PgnActions } from "../../src/features/game-review/PgnActions";
const setup = () => {
  render(
    <OverlayProvider>
      <PgnActions game={new Chess()} config={{}} />
    </OverlayProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Экспортировать PGN" }));
};
describe("PGN export notification", () => {
  it("uses icon actions and a separate dismissible top-layer notification", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const show = vi.spyOn(HTMLElement.prototype, "showPopover");
    setup();
    const textarea = screen.getByRole("textbox");
    for (const name of ["Копировать", "Скачать"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toHaveClass("quiet", "icon-button");
      expect(button.querySelector("svg")).not.toBeNull();
      expect(button.textContent).toBe("");
    }
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Копировать" })),
    );
    expect(writeText).toHaveBeenCalledWith(
      textarea.getAttribute("value") || textarea.textContent,
    );
    const toast = screen.getByRole("status");
    expect(toast).toHaveTextContent("PGN скопирован");
    expect(toast.closest("dialog")).not.toBeNull();
    expect(toast.closest("#modal-content")).toBeNull();
    expect(show).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Скрыть уведомление" }));
    await waitFor(() => expect(toast).not.toBeInTheDocument());
    expect(document.querySelector("dialog")?.open).toBe(true);
  });
  it.each(["left", "down"])(
    "dismisses %s and retains the dialog on clipboard failure",
    async (direction) => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
      });
      setup();
      await act(async () =>
        fireEvent.click(screen.getByRole("button", { name: "Копировать" })),
      );
      vi.useFakeTimers();
      const toast = screen
        .getByRole("alert")
        .closest(".notification-card") as HTMLElement;
      expect(toast).toHaveAttribute("data-tone", "error");
      const pointer = (type: string, x: number, y: number) => {
        const event = new Event(type, { bubbles: true });
        Object.assign(event, {
          pointerId: 1,
          isPrimary: true,
          button: 0,
          clientX: x,
          clientY: y,
        });
        fireEvent(toast, event);
      };
      // Right and up must neither dismiss nor move the card in that direction.
      pointer("pointerdown", 80, 80);
      pointer("pointermove", 140, 80);
      expect(toast.style.translate).toBe("0px 0px");
      pointer("pointerup", 140, 80);
      expect(toast).not.toHaveAttribute("data-leaving");
      pointer("pointerdown", 80, 80);
      pointer("pointermove", 80, 30);
      expect(toast.style.translate).toBe("0px 0px");
      pointer("pointerup", 80, 30);
      expect(toast).not.toHaveAttribute("data-leaving");
      const x = direction === "left" ? 30 : 80;
      const y = direction === "down" ? 130 : 80;
      pointer("pointerdown", 80, 80);
      pointer("pointermove", x, y);
      pointer("pointercancel", x, y);
      expect(toast.style.translate).toBe("");
      pointer("pointerdown", 80, 80);
      pointer("pointermove", x, y);
      expect(toast.style.translate).toBe(
        direction === "left" ? "-50px 0px" : "0px 50px",
      );
      pointer("pointerup", x, y);
      expect(toast).toHaveAttribute("data-leaving");
      act(() => vi.advanceTimersByTime(180));
      expect(toast).not.toBeInTheDocument();
      expect(document.querySelector("dialog")?.open).toBe(true);
    },
  );
  it("offers system file sharing instead of download when supported", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: share,
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    });
    setup();
    expect(screen.queryByRole("button", { name: "Скачать" })).toBeNull();
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Поделиться" })),
    );
    expect(share.mock.calls[0][0].files[0].name).toMatch(/\.pgn$/);
    delete (navigator as Partial<Navigator>).share;
    delete (navigator as Partial<Navigator>).canShare;
  });
});
