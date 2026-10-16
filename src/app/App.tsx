import { ImportedGameProvider } from "../features/game-review/ImportedGameProvider.js";
import { HistoryReturnProvider } from "../features/game-review/HistoryReturnProvider.js";
import { ShellPresentation } from "./providers/ShellPresentation.js";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { Suspense, useEffect, useState, useRef } from "react";
import { RewardProcessor } from "../features/game-session/RewardProcessor.js";
import { usePwaUpdate } from "./providers/PwaProvider.js";
import { useVault, useVaultStore } from "./providers/VaultProvider.js";
const Icon = ({
  name,
}: {
  name: "play" | "pve" | "collection" | "chests" | "profile" | "streak";
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {name === "play" ? (
      <path d="M8 4h8l-1 5 3 10H6L9 9zM9 9h6M5 21h14M12 2v4" />
    ) : name === "pve" ? (
      <path d="M6 21V3m0 1h12l-3 4 3 4H6M3 21h6" />
    ) : name === "collection" ? (
      <>
        {[
          [3, 3],
          [14, 3],
          [3, 14],
          [14, 14],
        ].map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="7" height="7" rx="2" />
        ))}
      </>
    ) : name === "chests" ? (
      <path d="M3 10h18v10H3zM3 10V7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v3M10 10v4h4v-4" />
    ) : name === "profile" ? (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
      </>
    ) : (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M7 2v6M17 2v6M3 11h18M7 15h3M14 15h3" />
      </>
    )}
  </svg>
);
const Wallet = () => {
  const coins = useVault((s) => s.coins),
    shards = useVault((s) => s.shards);
  return (
    <div className="balances">
      <div
        className="wallet"
        title="Монеты — для открытия сундуков"
        aria-label={`${coins} монет`}
      >
        ◈ <strong id="coins">{coins}</strong>
      </div>
      <div
        className="wallet shards"
        title="Осколки — для создания предметов"
        aria-label={`${shards} осколков`}
      >
        ✧ <strong id="shards">{shards}</strong>
      </div>
    </div>
  );
};
export const App = () => {
  const [held, setHeld] = useState(false);
  const active = useVault((s) => s.game.started),
    location = useLocation(),
    navigate = useNavigate(),
    header = useRef<HTMLElement>(null),
    nav = useRef<HTMLElement>(null),
    pwa = usePwaUpdate(),
    store = useVaultStore(),
    path = location.pathname,
    mode = ["/hunt", "/autochess"].includes(path),
    detail = path.startsWith("/history/") || path === "/import",
    hidden = active || held || mode || detail || path === "/pve";
  const setPwaBusy = pwa.setBusy;
  useEffect(() => {
    setPwaBusy(hidden);
  }, [hidden, setPwaBusy]);
  useEffect(() => {
    document.body.classList.toggle("match-active", active || held);
    document.body.classList.toggle("autochess-active", path === "/autochess");
    document.body.classList.toggle("hunt-active", path === "/hunt");
    document.body.classList.toggle("archive-viewing", detail);
    return () => {
      document.body.classList.remove(
        "match-active",
        "autochess-active",
        "hunt-active",
        "archive-viewing",
      );
    };
  }, [active, held, path, detail]);
  useEffect(() => {
    const resize = () => {
      document.documentElement.style.setProperty(
        "--header-height",
        `${header.current?.getBoundingClientRect().height || 68}px`,
      );
      document.documentElement.style.setProperty(
        "--nav-height",
        `${nav.current?.getBoundingClientRect().height || 0}px`,
      );
    };
    const observer = new ResizeObserver(resize);
    if (header.current) observer.observe(header.current);
    if (nav.current) observer.observe(nav.current);
    resize();
    return () => observer.disconnect();
  }, [hidden]);
  return (
    <ShellPresentation value={setHeld}>
      <header ref={header}>
        <a
          className="brand"
          href="#/play"
          onClick={(event) => {
            event.preventDefault();
            if (!active && !mode) void navigate({ to: "/play" });
          }}
        >
          <span>♞</span> GachaChess<small className="app-version">0.5</small>
        </a>
        <Wallet />
        <button
          id="streak-entry"
          className="profile-avatar"
          aria-label="Календарь серии"
          disabled={active || mode}
          onClick={() => void navigate({ to: "/streak" })}
        >
          <Icon name="streak" />
        </button>
        <button
          id="profile-avatar"
          className="profile-avatar"
          aria-label="Открыть профиль"
          disabled={active || mode}
          onClick={() => void navigate({ to: "/profile" })}
        >
          <Icon name="profile" />
        </button>
      </header>
      <main>
        {store.getError() && (
          <p role="alert">
            Не удалось прочитать сохранение. Запись приостановлена:{" "}
            {store.getError()?.message}
          </p>
        )}
        <HistoryReturnProvider>
          <ImportedGameProvider>
            <Suspense fallback={<p role="status">Загрузка…</p>}>
              <Outlet />
            </Suspense>
          </ImportedGameProvider>
        </HistoryReturnProvider>
        <nav id="app-nav" ref={nav} aria-label="Разделы" hidden={hidden}>
          {(
            [
              ["play", "Игры"],
              ["pve", "Поход"],
              ["collection", "Коллекция"],
              ["chests", "Сундуки"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              data-tab={key}
              className={path === `/${key}` ? "active" : ""}
              aria-current={path === `/${key}` ? "page" : undefined}
              onClick={() => void navigate({ to: `/${key}` })}
            >
              <Icon name={key} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </main>
      {pwa.available && !hidden && path !== "/profile" && (
        <div className="notification-stack">
          <button
            id="update-app"
            className="primary update-app"
            disabled={pwa.updating}
            onClick={pwa.update}
          >
            Обновить приложение
          </button>
        </div>
      )}
      <RewardProcessor />
    </ShellPresentation>
  );
};
