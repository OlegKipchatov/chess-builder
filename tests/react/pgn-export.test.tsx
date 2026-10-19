import { act, fireEvent, render, screen } from "@testing-library/react";
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
    expect(toast).not.toBeVisible();
    expect(document.querySelector("dialog")?.open).toBe(true);
  });
  it("dismisses by swipe and retains the dialog on clipboard failure", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    setup();
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Копировать" })),
    );
    const toast = screen.getByRole("status");
    expect(toast).toHaveAttribute("data-tone", "error");
    fireEvent.touchStart(toast, { touches: [{ identifier: 1, clientX: 10, clientY: 10 }] });
    fireEvent.touchEnd(toast, { changedTouches: [{ identifier: 1, clientX: 20, clientY: 10 }] });
    expect(toast).toBeVisible();
    fireEvent.touchStart(toast, { touches: [{ identifier: 1, clientX: 10, clientY: 10 }] });
    fireEvent.touchMove(toast, { touches: [{ identifier: 1, clientX: 70, clientY: 10 }] });
    fireEvent.touchCancel(toast);
    expect(toast).toBeVisible();
    expect(toast.style.translate).toBe('');
    fireEvent.touchStart(toast, {
      touches: [{ identifier: 1, clientX: 10, clientY: 10 }],
    });
    fireEvent.touchMove(toast, {
      touches: [{ identifier: 1, clientX: 50, clientY: 10 }],
    });
    expect(toast.style.translate).toBe("40px 0px");
    fireEvent.touchEnd(toast, {
      changedTouches: [{ identifier: 1, clientX: 90, clientY: 10 }],
    });
    expect(toast).not.toBeVisible();
    expect(document.querySelector("dialog")?.open).toBe(true);
  });
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
