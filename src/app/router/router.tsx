import {
createHashHistory,
createRootRouteWithContext,
createRoute,
createRouter,
lazyRouteComponent,
redirect,
} from "@tanstack/react-router";
import type { VaultStore } from "../../services/persistence/vault-store.js";
import { Page } from "../../shared/ui/Page.js";
import { App } from "../App.js";
const root = createRootRouteWithContext<{ vault: VaultStore }>()({
  component: App,
  beforeLoad: ({ context, location }) => {
    if (
      context.vault.getSnapshot().game.started &&
      location.pathname !== "/play"
    )
      throw redirect({ to: "/play", replace: true });
  },
  notFoundComponent: () => (
    <Page id="not-found" title="Страница не найдена" back="/play">
      <p>Вернитесь к игре.</p>
    </Page>
  ),
  errorComponent: ({ error, reset }) => (
    <Page id="error" title="Не удалось открыть экран">
      <p role="alert">
        {error instanceof Error ? error.message : String(error)}
      </p>
      <button onClick={reset}>Повторить</button>
    </Page>
  ),
});
const index = createRoute({
  getParentRoute: () => root,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/play", replace: true });
  },
});
const play = createRoute({
  getParentRoute: () => root,
  path: "/play",
  component: lazyRouteComponent(() => import("../../pages/game/GamePage.js")),
});
const collection = createRoute({
  getParentRoute: () => root,
  path: "/collection",
  component: lazyRouteComponent(
    () => import("../../pages/collection/CollectionPage.js"),
  ),
});
const chests = createRoute({
  getParentRoute: () => root,
  path: "/chests",
  component: lazyRouteComponent(
    () => import("../../pages/chests/ChestsPage.js"),
  ),
});
const history = createRoute({
  getParentRoute: () => root,
  path: "/history",
  component: lazyRouteComponent(
    () => import("../../pages/history/HistoryPage.js"),
  ),
});
const review = createRoute({
  getParentRoute: () => root,
  path: "/history/$id",
  validateSearch: (search: Record<string, unknown>) => ({
    analyze: search.analyze === true,
  }),
  component: lazyRouteComponent(
    () => import("../../pages/history/ReviewPage.js"),
  ),
});
const calendar = createRoute({
  getParentRoute: () => root,
  path: "/calendar",
  component: lazyRouteComponent(
    () => import("../../pages/activity/ActivityPage.js"),
  ),
});
const Streak = lazyRouteComponent(
  () => import("../../pages/activity/ActivityPage.js"),
);
const streak = createRoute({
  getParentRoute: () => root,
  path: "/streak",
  component: () => <Streak streakOnly />,
});
const profile = createRoute({
  getParentRoute: () => root,
  path: "/profile",
  component: lazyRouteComponent(
    () => import("../../pages/profile/ProfilePage.js"),
  ),
});
const statistics = createRoute({
  getParentRoute: () => root,
  path: "/statistics",
  component: lazyRouteComponent(
    () => import("../../pages/statistics/StatisticsPage.js"),
  ),
});
const faq = createRoute({
  getParentRoute: () => root,
  path: "/faq",
  component: lazyRouteComponent(() => import("../../pages/faq/FaqPage.js")),
});
const hunt = createRoute({
  getParentRoute: () => root,
  path: "/hunt",
  validateSearch: (
    search: Record<string, unknown>,
  ): { mode: "timed" | "endless" } => ({
    mode: search.mode === "timed" ? "timed" : "endless",
  }),
  component: lazyRouteComponent(() => import("../../pages/hunt/HuntPage.js")),
});
const autochess = createRoute({
  getParentRoute: () => root,
  path: "/autochess",
  component: lazyRouteComponent(
    () => import("../../pages/autochess/AutochessPage.js"),
  ),
});
const pve = createRoute({
  getParentRoute: () => root,
  path: "/pve",
  component: lazyRouteComponent(() => import("../../pages/pve/PvePage.js")),
});
const Import = lazyRouteComponent(
  () => import("../../features/game-review/PgnImport.js"),
  "PgnImport",
);
const pgn = createRoute({
  getParentRoute: () => root,
  path: "/import",
  component: () => (
    <Page id="pgn-import" title="Открыть PGN" back="/profile">
      <Import />
    </Page>
  ),
});
const routes = root.addChildren([
  index,
  play,
  collection,
  chests,
  history,
  review,
  calendar,
  streak,
  profile,
  statistics,
  faq,
  hunt,
  autochess,
  pve,
  pgn,
]);
export const makeRouter = (vault: VaultStore) =>
  createRouter({
    routeTree: routes,
    history: createHashHistory(),
    context: { vault },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPendingComponent: () => <p role="status">Загрузка…</p>,
  });
declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof makeRouter>;
  }
}
