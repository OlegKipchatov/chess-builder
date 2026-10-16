import {
createContext,
useCallback,
useContext,
useEffect,
useRef,
useState,
type ReactNode,
} from "react";
import { createPortal } from "react-dom";
export interface ModalContent {
  title: string;
  body: ReactNode;
  onClose?: () => void;
  dismissible?: boolean;
}
interface Overlays {
  show: (content: ModalContent | null) => void;
  toast: (message: string) => void;
}
const Context = createContext<Overlays | null>(null);
export const OverlayProvider = ({ children }: { children: ReactNode }) => {
  const [content, setContent] = useState<ModalContent | null>(null),
    [message, setMessage] = useState("");
  const dialog = useRef<HTMLDialogElement>(null),
    heading = useRef<HTMLHeadingElement>(null),
    returnTo = useRef<HTMLElement | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const contentRef = useRef(content);
  contentRef.current = content;
  const show = useCallback((next: ModalContent | null) => {
    setContent(next);
  }, []);
  const close = () => {
    const current = contentRef.current;
    if (current?.dismissible === false) return;
    setContent(null);
    current?.onClose?.();
  };
  useEffect(() => {
    if (content && !dialog.current?.open) {
      returnTo.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      dialog.current?.showModal();
      heading.current?.focus({ preventScroll: true });
    }
    if (!content && dialog.current?.open) {
      dialog.current.close();
      returnTo.current?.focus({ preventScroll: true });
    }
  }, [content]);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      dialog.current?.close();
    },
    [],
  );
  const toast = useCallback((value: string) => {
    clearTimeout(timer.current);
    setMessage(value);
    timer.current = setTimeout(() => setMessage(""), 4000);
  }, []);
  const touchStart = useRef<number | null>(null);
  return (
    <Context value={{ show, toast }}>
      {children}
      {createPortal(
        <>
          <dialog
            ref={dialog}
            id="modal"
            aria-labelledby="modal-title"
            onCancel={(event) => {
              event.preventDefault();
              close();
            }}
            onClick={(event) => {
              if (event.target === dialog.current) close();
            }}
            onTouchStart={(event) => {
              touchStart.current = event.touches[0]?.clientY ?? null;
            }}
            onTouchEnd={(event) => {
              if (
                touchStart.current !== null &&
                (event.changedTouches[0]?.clientY ?? 0) - touchStart.current >
                  70 &&
                event.target === dialog.current
              )
                close();
              touchStart.current = null;
            }}
          >
            <div id="modal-content">
              <h2 ref={heading} id="modal-title" tabIndex={-1}>
                {content?.title}
              </h2>
              {content?.body}
            </div>
            {content?.dismissible !== false && (
              <button
                id="close-modal"
                className="icon-button"
                aria-label="Закрыть"
                onClick={close}
              >
                ×
              </button>
            )}
          </dialog>
          <div id="toast" role="status" hidden={!message}>
            {message}
          </div>
        </>,
        document.body,
      )}
    </Context>
  );
};
export const useOverlays = () => {
  const context = useContext(Context);
  if (!context) throw new Error("OverlayProvider missing");
  return context;
};
