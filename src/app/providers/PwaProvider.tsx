import { useNotificationError } from "../../shared/hooks/useNotificationError.js";
import { useOverlays } from "./OverlayProvider.js";
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
  setBusy: (busy: boolean) => void;
  available: boolean;
  ready: boolean;
  error: string;
  canInstall: boolean;
  installed: boolean;
  updating: boolean;
  update: () => void;
  install: () => Promise<boolean>;
}
const Context = createContext<PwaContext>({
  setBusy: () => {},
  available: false,
  ready: false,
  error: "",
  canInstall: false,
  installed: false,
  updating: false,
  update: () => {},
  install: async () => false,
});
const reloadPage = () => location.reload();
const appDisplayMode =
  "(display-mode: standalone), (display-mode: minimal-ui), (display-mode: fullscreen)";
const isAppWindow = () =>
  window.matchMedia(appDisplayMode).matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
export const PwaProvider = ({
  children,
  reload = reloadPage,
}: {
  children: ReactNode;
  reload?: () => void;
}) => {
  const { isOpen } = useOverlays(),
    [busy, setBusy] = useState(true),
    [pending, setPending] = useState(false),
    reloaded = useRef(false);
  useEffect(() => {
    if (!pending || busy || isOpen || reloaded.current) return;
    const apply = () => {
      if (!document.hidden && !reloaded.current) {
        reloaded.current = true;
        reload();
      }
    };
    apply();
    document.addEventListener("visibilitychange", apply);
    return () => document.removeEventListener("visibilitychange", apply);
  }, [pending, busy, isOpen, reload]);
  const [available, setAvailable] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useNotificationError(),
    [canInstall, setCanInstall] = useState(false),
    [installed, setInstalled] = useState(isAppWindow),
    [updating, setUpdating] = useState(false),
    registration = useRef<ServiceWorkerRegistration | null>(null),
    installEvent = useRef<InstallEvent | null>(null),
    requested = useRef(false);
  useEffect(() => {
    const mode = window.matchMedia(appDisplayMode);
    let installationConfirmed = false;
    const syncMode = () => setInstalled(installationConfirmed || isAppWindow());
    const before = (event: Event) => {
        event.preventDefault();
        if (installationConfirmed || isAppWindow()) return;
        installEvent.current = event as InstallEvent;
        setCanInstall(true);
      },
      installed = () => {
        installationConfirmed = true;
        setInstalled(true);
        installEvent.current = null;
        setCanInstall(false);
      };
    window.addEventListener("beforeinstallprompt", before);
    window.addEventListener("appinstalled", installed);
    mode.addEventListener("change", syncMode);
    return () => {
      window.removeEventListener("beforeinstallprompt", before);
      window.removeEventListener("appinstalled", installed);
      mode.removeEventListener("change", syncMode);
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
        setPending(true);
        return;
      }
      setReady(true);
      if (!hadController && !crossOriginIsolated) setPending(true);
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
              setError("");
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
      .catch(() => {
        if (live)
          setError(
            "Офлайн-режим недоступен. Игра работает при подключении к сети.",
          );
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
  }, [setError]);
  const update = () => {
    if (busy || isOpen) return;
    requested.current = true;
    setUpdating(true);
    if (registration.current?.waiting)
      registration.current.waiting.postMessage({ type: "SKIP_WAITING" });
    else setPending(true);
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
      value={{
        setBusy,
        available,
        ready,
        error,
        canInstall,
        installed,
        updating,
        update,
        install,
      }}
    >
      {children}
    </Context>
  );
};
export const usePwaUpdate = () => useContext(Context);
