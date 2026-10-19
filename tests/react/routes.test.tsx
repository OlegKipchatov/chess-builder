import { NODES } from "../../src/domain/pve/pve-model";
import {
  createAutoRun,
  AUTO_KEY,
} from "../../src/domain/autochess/autochess.js";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { makeRouter } from "../../src/app/router/router";
import { VaultProvider } from "../../src/app/providers/VaultProvider";
import { OverlayProvider } from "../../src/app/providers/OverlayProvider";
import { initialState, KEY } from "../../src/services/persistence/state";
import { createVaultStore } from "../../src/services/persistence/vault-store";
import { createStartedGame } from "../../src/domain/chess/session";
import type { ArchiveEntry } from "../../src/domain/chess/types";
const entry = (index: number): ArchiveEntry =>
  ({
    id: String(index),
    pgn: "1. e4 d5 2. exd5",
    mode: "local",
    difficulty: "adaptive",
    playerColor: "w",
    result: "Победа белых",
    finishedAt: "2026-10-15T10:30:00Z",
    equipped: initialState().equipped,
    points: 99,
  }) as ArchiveEntry;
const setup = async (path = "/play", state = initialState()) => {
  localStorage.setItem(KEY, JSON.stringify(state));
  const store = createVaultStore(localStorage),
    router = makeRouter(store, createMemoryHistory({ initialEntries: [path] })),
    view = render(
      <VaultProvider store={store}>
        <OverlayProvider>
          <RouterProvider router={router} />
        </OverlayProvider>
      </VaultProvider>,
    );
  await act(() => router.load());
  return { store, router, ...view };
};
describe("React routing, collection and history", () => {
  it("shows read failure even without a changed snapshot and offers recovery", async () => {
    const view = await setup("/profile");
    act(() => {
      localStorage.setItem(KEY, "broken JSON");
      view.store.refresh();
    });
    expect(
      screen.getByRole("button", { name: "Повторить чтение" }),
    ).toBeVisible();
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...initialState(), coins: 541 }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Повторить чтение" }));
    expect(
      screen.queryByRole("button", { name: "Повторить чтение" }),
    ).not.toBeInTheDocument();
    expect(view.store.getSnapshot().coins).toBe(541);
  });
  it("keeps the presented screen and shell together while the next route loads", async () => {
    const view = await setup();
    const route = view.router.routesById["/pve"];
    const previousLoader = route.options.loader;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    route.update({ loader: () => gate });
    try {
      act(() => {
        void view.router.navigate({ to: "/pve" });
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1200));
      });
      expect(
        screen.getByRole("heading", { name: "Игры", exact: true }),
      ).toBeVisible();
      expect(view.container.querySelector("#app-nav")).toBeVisible();
      expect(document.body).not.toHaveClass("pve-active");
      expect(screen.queryByText("Загрузка…")).not.toBeInTheDocument();
      await act(async () => {
        release();
      });
      expect(
        await screen.findByRole("heading", { name: "Поход", exact: true }),
      ).toBeVisible();
      expect(document.body).toHaveClass("pve-active");
      expect(view.container.querySelector("#app-nav")).not.toBeVisible();
    } finally {
      release();
      route.update({ loader: previousLoader });
      view.unmount();
    }
  });
  it("renders every lazy screen once with unique ids, without the legacy app bootstrap", async () => {
    const view = await setup();
    for (const [path, title] of [
      ["/play", "Игры"],
      ["/collection", "Коллекция"],
      ["/chests", "Сундуки"],
      ["/profile", "Профиль"],
      ["/statistics", "Статистика"],
      ["/faq", "Вопросы и ответы"],
      ["/calendar", "Календарь активности"],
      ["/streak", "Календарь активности"],
      ["/history", "История партий"],
      ["/autochess", "Автошахматы"],
      ["/pve", "Поход"],
      ["/hunt?mode=timed", "Охота на время"],
    ]) {
      await act(() => view.router.navigate({ href: path }));
      await waitFor(() =>
        expect(
          screen.getByRole("heading", { level: 1, name: title }),
        ).toBeVisible(),
      );
      const ids = [...document.querySelectorAll("[id]")].map((node) => node.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
    view.unmount();
  });
  it("redirects a saved active game deep link to its restored session and blocks navigation", async () => {
    const state = initialState();
    state.game = {
      ...createStartedGame(state, () => 0),
      mode: "local",
      pgn: "1. e4 e5",
    };
    const view = await setup("/collection", state);
    await waitFor(() =>
      expect(screen.getByLabelText("Шахматная доска")).toBeVisible(),
    );
    expect(view.router.state.location.pathname).toBe("/play");
    act(() => {
      void view.router.navigate({ to: "/chests" });
    });
    await act(async () => {});
    expect(view.router.state.location.pathname).toBe("/play");
    expect(view.store.getSnapshot().game.pgn).toBe("1. e4 e5");
    view.unmount();
  });
  it("returns to the actual history entry, restores focus and classifies local results correctly", async () => {
    const state = initialState();
    state.archive = [
      entry(0),
      { ...entry(1), result: "Победа чёрных" },
      entry(2),
    ];
    const view = await setup("/history", state);
    await screen.findByRole("heading", { name: "История партий" });
    const row = await waitFor(() => {
      const row =
        view.container.querySelector<HTMLButtonElement>('[data-archive="0"]');
      expect(row).toBeTruthy();
      return row!;
    });
    expect(row).toHaveAttribute("data-result", "win");
    expect(row).toHaveTextContent("2 хода");
    expect(row).toHaveTextContent("Материал +1");
    expect(row.textContent).not.toContain("99");
    expect(view.container.querySelector('[data-archive="1"]')).toHaveAttribute(
      "data-result",
      "loss",
    );
    fireEvent.click(row);
    await screen.findByRole("heading", { name: "История партии" });
    fireEvent.click(screen.getByLabelText("Назад"));
    await screen.findByRole("heading", { name: "История партий" });
    await waitFor(() =>
      expect(view.container.querySelector('[data-archive="0"]')).toHaveFocus(),
    );
    expect(view.router.history.length).toBe(2);
    view.unmount();
  });
  it("current equipment has selected outlines and owned filtering survives switching categories", async () => {
    const view = await setup("/collection");
    await screen.findByRole("heading", { name: "Коллекция" });
    expect(
      view.container.querySelector(".collection-row.equipped"),
    ).toBeTruthy();
    expect(screen.getByText("Выбрано", { selector: "button" })).toBeDisabled();
    fireEvent.click(screen.getByText("Фигуры и доски"));
    fireEvent.click(screen.getByRole("button", { name: "Только полученные" }));
    expect(
      screen.getByRole("button", { name: "Только полученные" }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Настроить: Доска" }));
    expect(
      screen.getByRole("button", { name: "Только полученные" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      view.container.querySelectorAll(".collection-items-list .compact-item"),
    ).toHaveLength(1);
    view.unmount();
  });
  it("PvE inventory keeps evolution progress and routes restore the army view", async () => {
    const state = initialState();
    state.pve.stones = 2;
    state.pve.cores = 1;
    state.pve.cleared = NODES.map((node) => node.id);
    state.pve.levelCap = 5;
    const pawn = state.pve.units.find(
      (unit) => unit.type === "p" && unit.active,
    )!;
    const view = await setup("/pve?view=army", state);
    await screen.findByLabelText("Стартовая расстановка армии");
    expect(
      view.container.querySelectorAll("#pve-army-board [data-square]"),
    ).toHaveLength(32);
    fireEvent.click(
      view.container.querySelector(`[data-pve-unit="${pawn.id}"]`)!,
    );
    fireEvent.click(view.container.querySelector("[data-pve-stone]")!);
    await waitFor(() => expect(view.store.getSnapshot().pve.stones).toBe(1));
    const trained = view.store
      .getSnapshot()
      .pve.units.find((unit) => unit.id === pawn.id)!;
    fireEvent.click(view.container.querySelector("[data-pve-evolve]")!);
    fireEvent.click(await screen.findByRole("button", { name: /^Конь · HP/ }));
    await waitFor(() => expect(view.store.getSnapshot().pve.cores).toBe(0));
    expect(
      view.store.getSnapshot().pve.units.find((unit) => unit.id === pawn.id),
    ).toMatchObject({ type: "n", level: trained.level, xp: trained.xp });
    fireEvent.click(
      screen.getByRole("button", { name: "Рюкзак", exact: true }),
    );
    await screen.findByRole("heading", { name: "Камни опыта · 1" });
    await act(() => view.router.history.back());
    await screen.findByLabelText("Стартовая расстановка армии");
    view.unmount();
  });
  it("saved names are escaped by React and each set retains its composition", async () => {
    const state = initialState();
    state.sets = [
      {
        ...state.equipped,
        id: "hostile",
        name: "<img src=x onerror=alert(1)>",
      },
    ];
    const view = await setup("/collection", state);
    await screen.findByRole("heading", { name: "Коллекция" });
    fireEvent.click(screen.getByText("Мои наборы", { selector: "button" }));
    expect(screen.getByText(state.sets[0].name)).toBeVisible();
    expect(view.container.querySelectorAll(".collection-row img")).toHaveLength(
      0,
    );
    expect(
      view.container.querySelectorAll(".collection-row .preset-part"),
    ).toHaveLength(7);
    expect(screen.getByText("Выбрано", { selector: "button" })).toBeDisabled();
    view.unmount();
  });
  it("persisted engine failure offers recovery outside a modal and interrupted games never affect win rate", async () => {
    const state = initialState();
    state.game = {
      ...createStartedGame(state, () => 0),
      pgn: "1. e4",
      engineFailure: {
        fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        message: "Stockfish timeout",
      },
    };
    state.archive = [
      { ...entry(0), mode: "bot", result: "Победа" },
      { ...entry(1), mode: "bot", result: "Прервана", counted: false },
    ];
    const view = await setup("/play", state);
    const abort = await screen.findByText("Закрыть без награды");
    expect(abort.closest("dialog")).toBeNull();
    expect(screen.getByText("Stockfish timeout")).toBeVisible();
    fireEvent.click(screen.getByText("Экспортировать PGN"));
    expect(screen.getByText("Копировать")).toBeVisible();
    expect(screen.getByText("Скачать")).toBeVisible();
    fireEvent.click(screen.getByLabelText("Закрыть"));
    fireEvent.click(abort);
    await screen.findByText("Партия с ИИ");
    await act(() => view.router.navigate({ to: "/statistics" }));
    await screen.findByRole("heading", { name: "Статистика" });
    expect(screen.getByText("Процент побед").parentElement).toHaveTextContent(
      "100%",
    );
    view.unmount();
  });

  it("back during replay cancels its pending animation and cannot replace the history screen", async () => {
    const state = initialState();
    state.archive = [entry(0)];
    const view = await setup("/history", state);
    await screen.findByRole("heading", { name: "История партий" });
    fireEvent.click(view.container.querySelector('[data-archive="0"]')!);
    await screen.findByRole("heading", { name: "История партии" });
    fireEvent.click(screen.getByLabelText("Начать воспроизведение"));
    await waitFor(() => expect(screen.getByRole("slider")).toHaveValue("1"));
    fireEvent.click(screen.getByLabelText("Назад"));
    await screen.findByRole("heading", { name: "История партий" });
    await act(async () => new Promise((resolve) => setTimeout(resolve, 600)));
    expect(view.router.state.location.pathname).toBe("/history");
    expect(screen.queryByLabelText("Шахматная доска")).toBeNull();
    expect(view.container.querySelector('[data-archive="0"]')).toHaveFocus();
  });
  it("virtualizes a long history and restores its saved scroll offset", async () => {
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(520);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(600);
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: function (options: { top?: number }) {
        this.scrollTop = options.top || 0;
      },
    });
    const state = initialState();
    state.archive = Array.from({ length: 120 }, (_, index) => entry(index));
    const view = await setup("/history", state);
    await screen.findByRole("heading", { name: "История партий" });
    const list =
      view.container.querySelector<HTMLDivElement>(".archive-scroll")!;
    expect(
      view.container.querySelectorAll("[data-archive]").length,
    ).toBeLessThan(25);
    fireEvent.scroll(list, { target: { scrollTop: 520 } });
    fireEvent.click(view.container.querySelector('[data-archive="5"]')!);
    await screen.findByRole("heading", { name: "История партии" });
    fireEvent.click(screen.getByLabelText("Назад"));
    await screen.findByRole("heading", { name: "История партий" });
    await waitFor(() =>
      expect(view.container.querySelector(".archive-scroll")?.scrollTop).toBe(
        520,
      ),
    );
    await waitFor(() =>
      expect(view.container.querySelector('[data-archive="5"]')).toHaveFocus(),
    );
  });

  it("PGN text import is modal, read-only, preserves headers on export and never focuses its textarea", async () => {
    const view = await setup("/profile");
    await screen.findByRole("heading", { name: "Профиль" });
    const before = localStorage.getItem(KEY),
      pgn =
        '[Event "External"]\n[White "Alice"]\n[Black "Bob"]\n[Date "2024.03.04"]\n\n1. e4 e5 2. Nf3 Nc6 *';
    fireEvent.click(screen.getByText("Открыть PGN"));
    expect(document.querySelector("dialog")?.open).toBe(true);
    fireEvent.click(screen.getByText("Вставить текст"));
    fireEvent.change(screen.getByLabelText("Текст PGN"), {
      target: { value: "invalid" },
    });
    fireEvent.click(screen.getByText("Открыть партию"));
    expect(screen.getByRole("alert")).toHaveTextContent("Не удалось прочитать");
    fireEvent.change(screen.getByLabelText("Текст PGN"), {
      target: { value: pgn },
    });
    fireEvent.click(screen.getByText("Открыть партию"));
    await screen.findByLabelText("Шахматная доска");
    expect(screen.getByText("Alice")).toBeVisible();
    expect(screen.getByText("Bob")).toBeVisible();
    expect(screen.queryByText("Разобрать партию")).toBeNull();
    fireEvent.click(screen.getByText("Экспортировать PGN"));
    const text = screen.getByRole("textbox", { name: "PGN партии" });
    expect(text).not.toHaveFocus();
    expect((text as HTMLTextAreaElement).value).toContain(
      '[Date "2024.03.04"]',
    );
    expect((text as HTMLTextAreaElement).value).toContain('[Event "External"]');
    expect(localStorage.getItem(KEY)).toBe(before);
  });
  it("keeps the Autochess purchase transactional under a double click", async () => {
    const run = createAutoRun("react-purchase");
    localStorage.setItem(AUTO_KEY, JSON.stringify(run));
    const view = await setup("/autochess");
    const buy = await screen.findByRole("button", { name: /^Фигура/ });
    await waitFor(() => expect(buy).toBeEnabled());
    vi.spyOn(performance, "now").mockReturnValue(1000);
    fireEvent.click(buy);
    fireEvent.click(buy);
    const saved = JSON.parse(localStorage.getItem(AUTO_KEY)!);
    expect(saved.purchases).toBe(run.purchases + 1);
    expect(saved.reserve).toBe(run.reserve - 1);
    expect(saved.army.length).toBe(run.army.length + 1);
    view.unmount();
  });
});
