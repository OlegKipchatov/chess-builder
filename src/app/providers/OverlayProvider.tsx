import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { motionDuration, motionEasing } from "../../shared/styles/motion.js";
export interface ModalContent {
  title: string;
  titleHidden?: boolean;
  body: ReactNode;
  onClose?: () => void;
  dismissible?: boolean;
  closeLabel?: string;
  closeVariant?: "primary" | "quiet";
}
interface Overlays {
  isOpen: boolean;
  show: (content: ModalContent | null) => void;
  toast: (message: string, options?: { error?: boolean }) => void;
}
const Context = createContext<Overlays | null>(null);
export const OverlayProvider = ({ children }: { children: ReactNode }) => {
  const [content, setContent] = useState<ModalContent | null>(null),
    [closing, setClosing] = useState(false),
    [message, setMessage] = useState<{ text: string; error: boolean } | null>(
      null,
    ),
    dialog = useRef<HTMLDialogElement>(null),
    heading = useRef<HTMLHeadingElement>(null),
    returnTo = useRef<HTMLElement | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    animation = useRef<Animation | null>(null),
    generation = useRef(0),
    height = useRef(0),
    current = useRef(content),
    mounted = useRef(false);
  const canAnimate = () =>
    matchMedia("(max-width: 760px)").matches &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const show = useCallback((next: ModalContent | null) => {
    const token = ++generation.current;
    animation.current?.cancel();
    animation.current = null;
    if (next) {
      setClosing(false);
      current.current = next;
      setContent(next);
      return;
    }
    const finish = () => {
      if (!mounted.current || token !== generation.current) return;
      current.current = null;
      setContent(null);
    };
    if (dialog.current?.open && canAnimate() && dialog.current.animate) {
      setClosing(true);
      const owned = dialog.current.animate(
        [{ transform: "translateY(0)" }, { transform: "translateY(100%)" }],
        {
          duration: motionDuration.exit,
          easing: motionEasing.exit,
          fill: "forwards",
        },
      );
      animation.current = owned;
      void owned.finished.then(finish, () => {});
    } else finish();
  }, []);
  const close = () => {
    const previous = current.current;
    if (!previous || previous.dismissible === false) return;
    const token = generation.current;
    previous.onClose?.();
    if (generation.current === token) show(null);
  };
  const dispose = useCallback(() => {
    mounted.current = false;
    generation.current++;
    clearTimeout(timer.current);
    animation.current?.cancel();
    dialog.current?.close();
    document.body.classList.remove("dialog-open");
  }, []);
  useEffect(() => {
    mounted.current = true;
    return dispose;
  }, [dispose]);
  useLayoutEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (content) {
      document.body.classList.add("dialog-open");
      const first = !node.open;
      if (first) {
        returnTo.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        node.showModal();
      }
      const nextHeight = node.getBoundingClientRect().height;
      if (
        !first &&
        height.current &&
        height.current !== nextHeight &&
        canAnimate() &&
        node.animate
      ) {
        const owned = node.animate(
          [{ height: `${height.current}px` }, { height: `${nextHeight}px` }],
          { duration: motionDuration.standard, easing: motionEasing.sheet },
        );
        animation.current = owned;
      }
      height.current = nextHeight;
      heading.current?.focus({ preventScroll: true });
    } else if (node.open) {
      node.close();
      animation.current?.cancel();
      animation.current = null;
      document.body.classList.remove("dialog-open");
      height.current = 0;
      const previous = returnTo.current;
      const target =
        previous?.isConnected &&
        !previous.closest("[hidden],[inert]") &&
        !previous.matches(":disabled")
          ? previous
          : document.querySelector<HTMLElement>(
              "main h1,main button,header button",
            );
      if (target) {
        if (
          !target.hasAttribute("tabindex") &&
          !target.matches("button,a,input,select,textarea")
        )
          target.tabIndex = -1;
        target.focus({ preventScroll: true });
      }
    }
  }, [content]);
  const toast = useCallback(
    (text: string, options: { error?: boolean } = {}) => {
      clearTimeout(timer.current);
      setMessage({ text, error: !!options.error });
      timer.current = setTimeout(() => setMessage(null), 5000);
    },
    [],
  );
  const touchStart = useRef<number | null>(null);
  return (
    <Context value={{ show, toast, isOpen: !!content }}>
      {children}
      {createPortal(
        <>
          <dialog
            ref={dialog}
            id="modal"
            className={closing ? "is-closing" : undefined}
            aria-labelledby="modal-title"
            onCancel={(event) => {
              event.preventDefault();
              close();
            }}
            onClick={(event) => {
              if (event.target === dialog.current) close();
            }}
            onTouchStart={(event) => {
              if (
                event.target === dialog.current ||
                (event.target as HTMLElement).closest("h2")
              )
                touchStart.current = event.touches[0]?.clientY ?? null;
            }}
            onTouchEnd={(event) => {
              if (
                touchStart.current !== null &&
                (event.changedTouches[0]?.clientY ?? 0) - touchStart.current >
                  70
              )
                close();
              touchStart.current = null;
            }}
          >
            <div id="modal-content">
              <h2
                ref={heading}
                id="modal-title"
                tabIndex={-1}
                className={content?.titleHidden ? "sr-only" : undefined}
              >
                {content?.title}
              </h2>
              {content?.body}
            </div>
            {content?.dismissible !== false && (
              <button
                id="close-modal"
                className={`ui-button ${content?.closeVariant || "quiet"} wide`}
                aria-label={content?.closeLabel || "Закрыть"}
                onClick={close}
              >
                {content?.closeLabel || "Закрыть"}
              </button>
            )}
          </dialog>
          <div className="notification-stack">
            <div
              id="toast"
              role="status"
              hidden={!message}
              data-tone={message?.error ? "error" : "neutral"}
            >
              {message?.text}
            </div>
          </div>
        </>,
        document.body,
      )}
    </Context>
  );
};
export const useOverlays = () => {
  const context = useContext(Context);
  if (!context) throw Error("OverlayProvider missing");
  return context;
};
