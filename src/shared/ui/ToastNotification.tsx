import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ControlIcon } from "./ControlIcon.js";
import { motionDuration } from "../styles/motion.js";

export type NotificationType = "error" | "warning" | "success" | "neutral";
export interface ToastOptions {
  type?: NotificationType;
}
export interface Notification {
  id: number;
  text: string;
  type: NotificationType;
  createdAt: number;
}
export const NOTIFICATION_DURATION = 5000;

const NotificationCard = ({
  item,
  index,
  onDismiss,
}: {
  item: Notification;
  index: number;
  onDismiss: (id: number) => void;
}) => {
  const node = useRef<HTMLDivElement>(null);
  const [leaving, setLeaving] = useState(false);
  const origin = useRef<{ id: number; x: number; y: number } | null>(null);
  const [elapsed] = useState(() => Date.now() - item.createdAt);
  useEffect(() => {
    const timer = setTimeout(
      () => setLeaving(true),
      Math.max(0, item.createdAt + NOTIFICATION_DURATION - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [item.createdAt]);
  useEffect(() => {
    if (!leaving) return;
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const timer = setTimeout(
      () => onDismiss(item.id),
      reduced ? 0 : motionDuration.exit,
    );
    return () => clearTimeout(timer);
  }, [leaving, item.id, onDismiss]);
  const reset = () => {
    origin.current = null;
    node.current?.style.removeProperty("translate");
    node.current?.style.removeProperty("opacity");
  };
  return (
    <div
      ref={node}
      className="notification-card"
      data-tone={item.type}
      data-leaving={leaving || undefined}
      data-stacked={index >= 3 || undefined}
      aria-hidden={index >= 3 || undefined}
      inert={index >= 3 || undefined}
      data-no-sheet-drag
      onPointerDown={(event) => {
        if (
          !event.isPrimary ||
          event.button !== 0 ||
          (event.target as Element).closest("button")
        )
          return;
        origin.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
        };
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerMove={(event) => {
        const start = origin.current;
        if (!start || start.id !== event.pointerId) return;
        const dx = Math.min(0, event.clientX - start.x);
        const dy = Math.max(0, event.clientY - start.y);
        event.currentTarget.style.translate = `${dx}px ${dy}px`;
        event.currentTarget.style.opacity = String(
          Math.max(0.15, 1 - Math.hypot(dx, dy) / 140),
        );
      }}
      onPointerUp={(event) => {
        const start = origin.current;
        if (!start || start.id !== event.pointerId) return;
        const dy = event.clientY - start.y;
        const dx = event.clientX - start.x;
        if (
          (dy >= 32 && dy >= Math.abs(dx)) ||
          (dx <= -32 && -dx > Math.abs(dy))
        ) {
          event.currentTarget.style.setProperty(
            "--dismiss-x",
            dx < 0 && -dx > Math.abs(dy) ? "-16px" : "0px",
          );
          event.currentTarget.style.setProperty(
            "--dismiss-y",
            dy >= Math.abs(dx) ? "16px" : "0px",
          );
          origin.current = null;
          setLeaving(true);
        } else reset();
      }}
      onPointerCancel={reset}
      onLostPointerCapture={() => {
        if (origin.current) reset();
      }}
    >
      <span
        className="notification-text"
        role={item.type === "error" ? "alert" : "status"}
        aria-atomic="true"
      >
        {item.text}
      </span>
      <button
        type="button"
        className="toast-dismiss"
        aria-label="Скрыть уведомление"
        onClick={() => setLeaving(true)}
      >
        <svg className="toast-countdown" viewBox="0 0 36 36" aria-hidden="true">
          <circle
            cx="18"
            cy="18"
            r="15"
            pathLength="1"
            style={{
              animationDuration: `${NOTIFICATION_DURATION}ms`,
              animationDelay: `${-elapsed}ms`,
            }}
          />
        </svg>
        <ControlIcon name="close" />
      </button>
    </div>
  );
};

export const ToastNotification = ({
  messages,
  onDismiss,
}: {
  messages: Notification[];
  onDismiss: (id: number) => void;
}) => {
  const host = useRef<HTMLDivElement>(null);
  const hasMessages = messages.length > 0;
  const updateLayout = useRef(() => {});
  useLayoutEffect(() => {
    const layer = host.current;
    if (!layer) return;
    const slots = Array.from(
      layer.querySelectorAll<HTMLElement>(".notification-slot"),
    );
    const measure = () => {
      // Read intrinsic sizes together before writing transforms. The cards never
      // switch between flow and absolute positioning as they enter the stack.
      const heights = slots.map(
        (slot) => (slot.firstElementChild as HTMLElement)?.offsetHeight || 44,
      );
      let bottom = 0;
      let lastHeight = 44;
      slots.forEach((slot, index) => {
        const height = heights[index];
        const depth = Math.max(0, index - 2);
        const y =
          index < 3 ? bottom : bottom - 8 - height + Math.min(depth, 3) * 10;
        slot.style.transform = `translateY(${y}px) scale(${1 - Math.min(depth, 3) * 0.04})`;
        slot.style.opacity = String(
          depth === 0
            ? 1
            : depth === 1
              ? 0.75
              : depth === 2
                ? 0.5
                : depth === 3
                  ? 0.25
                  : 0,
        );
        slot.style.zIndex = String(slots.length - index);
        slot.style.clipPath = depth
          ? `inset(${Math.max(0, height - lastHeight)}px 0 0)`
          : "none";
        if (index < 3) {
          bottom += height + 8;
          lastHeight = height;
        }
      });
      layer.style.height = `${Math.max(0, bottom - 8) + Math.min(Math.max(0, slots.length - 3), 3) * 10}px`;
    };
    updateLayout.current = measure;
    measure();
    const observer = new ResizeObserver(measure);
    slots.forEach((slot) => {
      if (slot.firstElementChild) observer.observe(slot.firstElementChild);
    });
    return () => observer.disconnect();
  }, [messages]);
  useEffect(() => {
    const node = host.current;
    if (!node || !hasMessages) return;
    node.showPopover?.();
    updateLayout.current();
    return () => node.hidePopover?.();
  }, [hasMessages]);
  return (
    <div
      ref={host}
      className="toast-layer"
      aria-label="Уведомления"
      popover={
        typeof HTMLElement !== "undefined" &&
        "showPopover" in HTMLElement.prototype
          ? "manual"
          : undefined
      }
      hidden={!hasMessages}
    >
      {messages.map((item, index) => (
        <div className="notification-slot" key={item.id}>
          <NotificationCard item={item} index={index} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
};
