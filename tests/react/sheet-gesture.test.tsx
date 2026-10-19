import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OverlayProvider,
  useOverlays,
} from "../../src/app/providers/OverlayProvider";

const bodyRender = vi.fn();
const Body = () => {
  bodyRender();
  return (
    <>
      <p>Содержимое</p>
      <textarea aria-label="PGN" />
      <button>Действие</button>
    </>
  );
};
const Harness = ({
  onClose = () => {},
  hidden = false,
}: {
  onClose?: () => void;
  hidden?: boolean;
}) => {
  const { show } = useOverlays();
  return (
    <button
      onClick={() =>
        show({
          title: "Тестовая шторка",
          titleHidden: hidden,
          onClose,
          body: <Body />,
        })
      }
    >
      Открыть
    </button>
  );
};
const setup = ({
  mobile = true,
  reduced = true,
  onClose = vi.fn(),
  hidden = false,
} = {}) => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("max-width") ? mobile : reduced,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  const view = render(
    <StrictMode>
      <OverlayProvider>
        <Harness onClose={onClose} hidden={hidden} />
      </OverlayProvider>
    </StrictMode>,
  );
  const trigger = screen.getByText("Открыть");
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = document.querySelector("dialog")!;
  const header = document.querySelector(".modal-header")!;
  const body = document.querySelector<HTMLElement>("#modal-content")!;
  vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
    top: 400,
    bottom: 800,
    left: 0,
    right: 390,
    height: 400,
    width: 390,
  } as DOMRect);
  return { ...view, dialog, header, body, onClose, trigger };
};
const touch = (target: Element, type: string, y: number, x = 100, id = 1) => {
  const point = { identifier: id, clientX: x, clientY: y };
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    touches: {
      value: type === "touchend" || type === "touchcancel" ? [] : [point],
    },
    changedTouches: { value: [point] },
  });
  fireEvent(target, event);
  return event;
};
const offset = (node: HTMLElement) =>
  Number.parseFloat(node.style.translate.split(" ")[1] || "0");
afterEach(() => {
  delete HTMLElement.prototype.animate;
});

describe("shared mobile sheet gestures", () => {
  it("supports mouse/pen header dragging and cancels on pointercancel", () => {
    const { header, dialog } = setup();
    const pointer = (type: string, y: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.assign(event, {
        pointerId: 7,
        pointerType: "pen",
        isPrimary: true,
        button: 0,
        clientX: 100,
        clientY: y,
      });
      fireEvent(header, event);
    };
    pointer("pointerdown", 500);
    pointer("pointermove", 650);
    expect(offset(dialog)).toBe(150);
    pointer("pointercancel", 650);
    expect(dialog.open).toBe(true);
    expect(offset(dialog)).toBe(0);
    pointer("pointerdown", 500);
    pointer("pointermove", 650);
    pointer("pointerup", 650);
    expect(dialog.open).toBe(false);
  });
  it("resets motion on viewport resize and preserves selected text", () => {
    const { header, dialog } = setup();
    touch(header, "touchstart", 500);
    touch(header, "touchmove", 450);
    fireEvent(window, new Event("resize"));
    expect(offset(dialog)).toBe(0);
    const text = screen.getByText("Содержимое");
    const range = document.createRange();
    range.selectNodeContents(text);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    expect(window.getSelection()?.isCollapsed).toBe(false);
    touch(text, "touchstart", 500);
    expect(touch(text, "touchmove", 700).defaultPrevented).toBe(false);
    touch(text, "touchend", 700);
    expect(dialog.open).toBe(true);
    window.getSelection()?.removeAllRanges();
  });

  it("renders a single shared icon close, even with a visually hidden title", () => {
    const { dialog, trigger } = setup({ hidden: true });
    const close = screen.getByRole("button", { name: "Закрыть" });
    expect(close.textContent).toBe("");
    expect(close.querySelector("svg")).not.toBeNull();
    expect(close.closest(".modal-header")).not.toBeNull();
    fireEvent.click(close);
    expect(dialog.open).toBe(false);
    expect(trigger).toHaveFocus();
  });
  it("follows upward drag with bounded resistance, returns, and does not render its body", () => {
    const { header, dialog, onClose } = setup();
    const renders = bodyRender.mock.calls.length;
    touch(header, "touchstart", 500);
    touch(header, "touchmove", 350);
    expect(offset(dialog)).toBeLessThan(-10);
    expect(offset(dialog)).toBeGreaterThan(-28);
    touch(header, "touchmove", -5000);
    expect(offset(dialog)).toBeGreaterThanOrEqual(-28);
    touch(header, "touchend", -5000);
    expect(offset(dialog)).toBe(0);
    expect(dialog.open).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    expect(bodyRender.mock.calls.length).toBe(renders);
  });
  it("closes on a downward drag and calls the dismissal exactly once", () => {
    const { header, dialog, onClose } = setup();
    touch(header, "touchstart", 500);
    touch(header, "touchmove", 640);
    expect(offset(dialog)).toBe(140);
    touch(header, "touchend", 640);
    expect(dialog.open).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dialog.style.translate).toBe("");
  });
  it("returns a short slow drag but recognizes a short fast downward swipe", () => {
    const { header, dialog } = setup();
    const clock = vi.spyOn(performance, "now");
    clock.mockReturnValue(0);
    touch(header, "touchstart", 500);
    clock.mockReturnValue(300);
    touch(header, "touchmove", 540);
    touch(header, "touchend", 540);
    expect(dialog.open).toBe(true);
    expect(offset(dialog)).toBe(0);
    clock.mockReturnValue(400);
    touch(header, "touchstart", 500);
    clock.mockReturnValue(430);
    touch(header, "touchmove", 540);
    touch(header, "touchend", 540);
    expect(dialog.open).toBe(false);
  });
  it("cancels instead of dismissing on touchcancel and multi-touch", () => {
    const { header, dialog, onClose } = setup();
    touch(header, "touchstart", 500);
    touch(header, "touchmove", 700);
    touch(header, "touchcancel", 700);
    expect(dialog.open).toBe(true);
    expect(offset(dialog)).toBe(0);
    touch(header, "touchstart", 500);
    touch(header, "touchmove", 700);
    const event = new Event("touchstart", { bubbles: true });
    Object.defineProperty(event, "touches", { value: [{}, {}] });
    fireEvent(header, event);
    expect(offset(dialog)).toBe(0);
    expect(onClose).not.toHaveBeenCalled();
  });
  it("preserves native scroll and horizontal gestures; only dismisses body at scroll top", () => {
    const { body, dialog } = setup();
    const text = screen.getByText("Содержимое");
    body.scrollTop = 80;
    touch(text, "touchstart", 500);
    expect(touch(text, "touchmove", 700).defaultPrevented).toBe(false);
    touch(text, "touchend", 700);
    expect(dialog.open).toBe(true);
    body.scrollTop = 0;
    touch(text, "touchstart", 500);
    expect(touch(text, "touchmove", 300).defaultPrevented).toBe(false);
    touch(text, "touchend", 300);
    touch(text, "touchstart", 500);
    expect(touch(text, "touchmove", 520, 300).defaultPrevented).toBe(false);
    touch(text, "touchend", 520, 300);
    expect(dialog.open).toBe(true);
    touch(text, "touchstart", 500);
    expect(touch(text, "touchmove", 650).defaultPrevented).toBe(true);
    touch(text, "touchend", 650);
    expect(dialog.open).toBe(false);
  });
  it("does not hijack fields or buttons", () => {
    const { dialog } = setup();
    for (const target of [
      screen.getByLabelText("PGN"),
      screen.getByText("Действие"),
      screen.getByLabelText("Закрыть"),
    ]) {
      touch(target, "touchstart", 500);
      expect(touch(target, "touchmove", 700).defaultPrevented).toBe(false);
      touch(target, "touchend", 700);
    }
    expect(dialog.open).toBe(true);
    expect(offset(dialog)).toBe(0);
  });
  it("keeps desktop dialogs stationary", () => {
    const { dialog, header } = setup({ mobile: false });
    touch(header, "touchstart", 500);
    touch(header, "touchmove", 700);
    touch(header, "touchend", 700);
    expect(dialog.open).toBe(true);
    expect(offset(dialog)).toBe(0);
  });
  it("does not treat a click inside the dialog bounds as a backdrop click", () => {
    const { dialog } = setup();
    fireEvent.click(dialog, { clientX: 100, clientY: 500 });
    expect(dialog.open).toBe(true);
    fireEvent.click(dialog, { clientX: 100, clientY: 100 });
    expect(dialog.open).toBe(false);
  });
  it("starts the exit at the dragged position and blocks duplicate dismissals", async () => {
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
    const { header, dialog, onClose } = setup({ reduced: false });
    touch(header, "touchstart", 500);
    touch(header, "touchmove", 640);
    touch(header, "touchend", 640);
    expect(animate.mock.calls.at(-1)).toEqual([
      [{ transform: "translate(0, 140px)" }, { transform: "translateY(100%)" }],
      { duration: 180, easing: "ease-in", fill: "forwards" },
    ]);
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    expect(dialog.open).toBe(false);
  });
  it("does not animate reduced-motion dismissal and cleans up an interrupted gesture", () => {
    const animate = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "animate", {
      configurable: true,
      value: animate,
    });
    const { header, dialog, unmount, onClose } = setup();
    touch(header, "touchstart", 500);
    touch(header, "touchmove", 480);
    unmount();
    touch(header, "touchend", 700);
    expect(dialog.style.translate).toBe("");
    expect(document.body).not.toHaveClass("dialog-open");
    expect(onClose).not.toHaveBeenCalled();
    expect(animate).not.toHaveBeenCalled();
  });
});
