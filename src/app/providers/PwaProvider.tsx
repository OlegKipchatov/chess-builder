import {
createContext,
useContext,
useEffect,
useRef,
useState,
type ReactNode,
} from "react";
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
interface PwaContext {
  available: boolean;
  ready: boolean;
  error: string;
  canInstall: boolean;
  updating: boolean;
  update: () => void;
  install: () => Promise<boolean>;
}
const Context = createContext<PwaContext>({
  available: false,
  ready: false,
  error: "",
  canInstall: false,
  updating: false,
  update: () => {},
  install: async () => false,
});
export const PwaProvider = ({ children }: { children: ReactNode }) => {
  const [available, setAvailable] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [canInstall, setCanInstall] = useState(false),
    [updating, setUpdating] = useState(false),
    registration = useRef<ServiceWorkerRegistration | null>(null),
    installEvent = useRef<InstallEvent | null>(null),
    requested = useRef(false);
  useEffect(() => {
    const before = (event: Event) => {
        event.preventDefault();
        installEvent.current = event as InstallEvent;
        setCanInstall(true);
      },
      installed = () => {
        installEvent.current = null;
        setCanInstall(false);
      };
    window.addEventListener("beforeinstallprompt", before);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", before);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    let live = true;
    const cleanups: (() => void)[] = [];
    const hadController = !!navigator.serviceWorker.controller;
    const changed = () => {
      if (!live) return;
      if (requested.current) {
        location.reload();
        return;
      }
      setReady(true);
      if (!hadController && !crossOriginIsolated) setAvailable(true);
    };
    navigator.serviceWorker.addEventListener("controllerchange", changed);
    void navigator.serviceWorker
      .register(new URL("sw.js", document.baseURI), {
        scope: "./",
        updateViaCache: "none",
      })
      .then((reg) => {
        if (!live) return;
        registration.current = reg;
        setAvailable(!!reg.waiting);
        setReady(!!navigator.serviceWorker.controller);
        const watch = () => {
          const worker = reg.installing;
          if (!worker) return;
          const state = () => {
            if (!live) return;
            if (worker.state === "installed") {
              if (reg.waiting && navigator.serviceWorker.controller)
                setAvailable(true);
              else setReady(true);
            }
            if (worker.state === "redundant")
              setError(
                "Не удалось сохранить обновление для офлайн-работы. Повторите позже.",
              );
          };
          worker.addEventListener("statechange", state);
          cleanups.push(() => worker.removeEventListener("statechange", state));
        };
        reg.addEventListener("updatefound", watch);
        cleanups.push(() => reg.removeEventListener("updatefound", watch));
        watch();
      })
      .catch((cause) => {
        if (live)
          setError(cause instanceof Error ? cause.message : String(cause));
      });
    const check = () => {
      if (document.visibilityState === "visible")
        void registration.current?.update().catch(() => {});
    };
    document.addEventListener("visibilitychange", check);
    return () => {
      live = false;
      cleanups.forEach((cleanup) => cleanup());
      navigator.serviceWorker.removeEventListener("controllerchange", changed);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  const update = () => {
    requested.current = true;
    setUpdating(true);
    if (registration.current?.waiting)
      registration.current.waiting.postMessage({ type: "SKIP_WAITING" });
    else location.reload();
  };
  const install = async () => {
    const event = installEvent.current;
    if (!event) return false;
    await event.prompt();
    const choice = await event.userChoice;
    installEvent.current = null;
    setCanInstall(false);
    return choice.outcome === "accepted";
  };
  return (
    <Context
      value={{ available, ready, error, canInstall, updating, update, install }}
    >
      {children}
    </Context>
  );
};
export const usePwaUpdate = () => useContext(Context);
