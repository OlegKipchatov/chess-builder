import { useEffectEvent, useLayoutEffect, type RefObject } from "react";

const interactive =
  "button,a,input,textarea,select,[contenteditable]:not([contenteditable=false]),[role=slider],[data-no-sheet-drag]";
const slop = 8;
const maxLift = 28;

// The native dialog owns focus/inertness. This hook only owns transient motion;
// no React state or content rendering occurs while a finger is moving.
export const useSheetGesture = (
  ref: RefObject<HTMLDialogElement | null>,
  contentKey: unknown,
  enabled: boolean,
  onDismiss: () => void,
) => {
  const dismiss = useEffectEvent(onDismiss);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    let gesture: {
      id: number;
      x: number;
      y: number;
      lastY: number;
      lastTime: number;
      velocity: number;
      offset: number;
      header: boolean;
      active: boolean;
    } | null = null;
    let suppressClick = false;
    const mobile = matchMedia("(max-width: 760px)");
    const reset = () => {
      gesture = null;
      delete node.dataset.dragging;
      delete node.dataset.settling;
      node.style.removeProperty("translate");
    };
    reset();
    if (!enabled) return reset;
    const start = (
      target: EventTarget | null,
      id: number,
      x: number,
      y: number,
    ) => {
      suppressClick = false;
      if (
        !mobile.matches ||
        !node.open ||
        node.classList.contains("is-closing") ||
        !(target instanceof Element)
      )
        return;
      if (
        target === node ||
        target.closest(interactive) ||
        window.getSelection()?.isCollapsed === false
      )
        return;
      const header = !!target.closest(".modal-header");
      // Never take over a gesture that started in scrolled or horizontal content.
      if (!header) {
        for (
          let el: Element | null = target;
          el && el !== node;
          el = el.parentElement
        ) {
          if (el.scrollTop > 0 || el.scrollWidth > el.clientWidth + 1) return;
        }
      }
      gesture = {
        id,
        x,
        y,
        lastY: y,
        lastTime: performance.now(),
        velocity: 0,
        offset: 0,
        header,
        active: false,
      };
    };
    const move = (id: number, x: number, y: number, event: Event) => {
      const g = gesture;
      if (!g || g.id !== id) return;
      if (!g.header && window.getSelection()?.isCollapsed === false) {
        reset();
        return;
      }
      const dy = y - g.y;
      if (!g.active) {
        if (Math.max(Math.abs(x - g.x), Math.abs(dy)) < slop) return;
        if (
          Math.abs(x - g.x) > Math.abs(dy) ||
          (!g.header && dy < 0) ||
          !event.cancelable
        ) {
          gesture = null;
          return;
        }
        g.active = true;
        delete node.dataset.settling;
        node.dataset.dragging = "true";
        node.dataset.gestureStarted = "true";
      }
      if (!event.cancelable) {
        reset();
        return;
      }
      event.preventDefault();
      const now = performance.now();
      const elapsed = now - g.lastTime;
      if (elapsed > 0) g.velocity = (y - g.lastY) / elapsed;
      g.lastY = y;
      g.lastTime = now;
      // Asymptotic resistance caps the upward lift and avoids a bottom gap.
      g.offset = dy < 0 ? -maxLift * (1 - Math.exp(dy / 100)) : dy;
      node.style.translate = `0 ${g.offset}px`;
    };
    const end = (id: number, cancelled = false) => {
      const g = gesture;
      if (!g || g.id !== id) return;
      gesture = null;
      if (!g.active) return;
      suppressClick = true;
      delete node.dataset.dragging;
      const threshold = Math.min(
        120,
        Math.max(64, node.getBoundingClientRect().height * 0.25),
      );
      const recent = performance.now() - g.lastTime < 100;
      const shouldClose =
        !cancelled &&
        g.offset > 0 &&
        (g.offset >= threshold ||
          (g.offset > 24 && recent && g.velocity > 0.65));
      if (shouldClose) dismiss();
      else {
        node.dataset.settling = g.offset < 0 ? "up" : "true";
        node.style.translate = "0 0px";
      }
    };
    const touchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        reset();
        return;
      }
      const touch = event.touches[0];
      start(event.target, touch.identifier, touch.clientX, touch.clientY);
    };
    const touchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        reset();
        return;
      }
      const touch = event.touches[0];
      move(touch.identifier, touch.clientX, touch.clientY, event);
    };
    const touchEnd = (event: TouchEvent) => {
      for (const touch of Array.from(event.changedTouches))
        end(touch.identifier, event.type === "touchcancel");
    };
    const pointerDown = (event: PointerEvent) => {
      if (
        event.pointerType === "touch" ||
        !event.isPrimary ||
        event.button !== 0
      )
        return;
      // Mouse/pen drag is deliberately limited to the header: body text stays selectable.
      if (
        !(event.target instanceof Element) ||
        !event.target.closest(".modal-header")
      )
        return;
      start(event.target, event.pointerId, event.clientX, event.clientY);
      // Capture only after a real drag; a click on the header must not become a backdrop click.
    };
    const pointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      move(event.pointerId, event.clientX, event.clientY, event);
      if (gesture?.active && !node.hasPointerCapture?.(event.pointerId))
        node.setPointerCapture?.(event.pointerId);
    };
    const pointerEnd = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      end(event.pointerId, event.type !== "pointerup");
      if (node.hasPointerCapture?.(event.pointerId))
        node.releasePointerCapture(event.pointerId);
    };
    const click = (event: MouseEvent) => {
      if (!suppressClick) return;
      suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
    };
    node.addEventListener("touchstart", touchStart, { passive: true });
    node.addEventListener("touchmove", touchMove, { passive: false });
    node.addEventListener("touchend", touchEnd);
    node.addEventListener("touchcancel", touchEnd);
    node.addEventListener("pointerdown", pointerDown);
    node.addEventListener("pointermove", pointerMove);
    node.addEventListener("pointerup", pointerEnd);
    node.addEventListener("pointercancel", pointerEnd);
    node.addEventListener("lostpointercapture", pointerEnd);
    node.addEventListener("click", click, true);
    mobile.addEventListener("change", reset);
    window.addEventListener("resize", reset);
    window.visualViewport?.addEventListener("resize", reset);
    return () => {
      node.removeEventListener("touchstart", touchStart);
      node.removeEventListener("touchmove", touchMove);
      node.removeEventListener("touchend", touchEnd);
      node.removeEventListener("touchcancel", touchEnd);
      node.removeEventListener("pointerdown", pointerDown);
      node.removeEventListener("pointermove", pointerMove);
      node.removeEventListener("pointerup", pointerEnd);
      node.removeEventListener("pointercancel", pointerEnd);
      node.removeEventListener("lostpointercapture", pointerEnd);
      node.removeEventListener("click", click, true);
      mobile.removeEventListener("change", reset);
      window.removeEventListener("resize", reset);
      window.visualViewport?.removeEventListener("resize", reset);
      reset();
    };
  }, [ref, contentKey, enabled]);
};
