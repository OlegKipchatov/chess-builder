import { useEffect, useRef } from "react";
import { ControlIcon } from "./ControlIcon.js";
export const ToastNotification = ({
  message,
  onDismiss,
}: {
  message: { text: string; error: boolean } | null;
  onDismiss: () => void;
}) => {
  const host = useRef<HTMLDivElement>(null);
  const toast = useRef<HTMLDivElement>(null);
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  useEffect(() => {
    const node = host.current,
      target = toast.current;
    if (!message || !node || !target) return;
    node.showPopover?.();
    let origin: { id: number; x: number; y: number } | null = null;
    const reset = () => {
      origin = null;
      target.style.removeProperty("translate");
      target.style.removeProperty("opacity");
    };
    const begin = (
      element: EventTarget | null,
      id: number,
      x: number,
      y: number,
    ) => {
      if (element instanceof Element && element.closest("button")) return;
      origin = { id, x, y };
    };
    const move = (x: number, y: number) => {
      if (!origin) return;
      const dx = x - origin.x,
        dy = y - origin.y;
      target.style.translate = `${dx}px ${dy}px`;
      target.style.opacity = String(
        Math.max(0.25, 1 - Math.hypot(dx, dy) / 180),
      );
    };
    const end = (x: number, y: number) => {
      const distance = origin ? Math.hypot(x - origin.x, y - origin.y) : 0;
      reset();
      if (distance >= 32) dismiss.current();
    };
    const touchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        reset();
        return;
      }
      const point = event.touches[0];
      begin(event.target, point.identifier, point.clientX, point.clientY);
    };
    const touchMove = (event: TouchEvent) => {
      if (!origin) return;
      const point = Array.from(event.touches).find(
        (t) => t.identifier === origin!.id,
      );
      if (!point) return;
      if (event.cancelable) event.preventDefault();
      move(point.clientX, point.clientY);
    };
    const touchEnd = (event: TouchEvent) => {
      const point = Array.from(event.changedTouches).find(
        (t) => t.identifier === origin?.id,
      );
      if (point) end(point.clientX, point.clientY);
    };
    const pointerDown = (event: PointerEvent) => {
      if (
        event.pointerType === "touch" ||
        !event.isPrimary ||
        event.button !== 0
      )
        return;
      begin(event.target, event.pointerId, event.clientX, event.clientY);
      if (origin) target.setPointerCapture?.(event.pointerId);
    };
    const pointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "touch" && origin?.id === event.pointerId)
        move(event.clientX, event.clientY);
    };
    const pointerUp = (event: PointerEvent) => {
      if (event.pointerType !== "touch" && origin?.id === event.pointerId)
        end(event.clientX, event.clientY);
    };
    const pointerCancel = (event: PointerEvent) => {
      if (event.pointerType !== "touch") reset();
    };
    target.addEventListener("touchstart", touchStart, { passive: true });
    target.addEventListener("touchmove", touchMove, { passive: false });
    target.addEventListener("touchend", touchEnd);
    target.addEventListener("touchcancel", reset);
    target.addEventListener("pointerdown", pointerDown);
    target.addEventListener("pointermove", pointerMove);
    target.addEventListener("pointerup", pointerUp);
    target.addEventListener("pointercancel", pointerCancel);
    return () => {
      target.removeEventListener("touchstart", touchStart);
      target.removeEventListener("touchmove", touchMove);
      target.removeEventListener("touchend", touchEnd);
      target.removeEventListener("touchcancel", reset);
      target.removeEventListener("pointerdown", pointerDown);
      target.removeEventListener("pointermove", pointerMove);
      target.removeEventListener("pointerup", pointerUp);
      target.removeEventListener("pointercancel", pointerCancel);
      reset();
      node.hidePopover?.();
    };
  }, [message]);
  return (
    <div
      ref={host}
      className="notification-stack toast-layer"
      popover={
        typeof HTMLElement !== "undefined" &&
        "showPopover" in HTMLElement.prototype
          ? "manual"
          : undefined
      }
      hidden={!message}
    >
      <div
        ref={toast}
        id="toast"
        data-no-sheet-drag
        role="status"
        hidden={!message}
        data-tone={message?.error ? "error" : "neutral"}
      >
        <span>{message?.text}</span>
        <button
          type="button"
          className="toast-dismiss"
          aria-label="Скрыть уведомление"
          onClick={onDismiss}
        >
          <ControlIcon name="close" />
        </button>
      </div>
    </div>
  );
};
