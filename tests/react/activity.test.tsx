import { act, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { makeRouter } from "../../src/app/router/router";
import { VaultProvider } from "../../src/app/providers/VaultProvider";
import { OverlayProvider } from "../../src/app/providers/OverlayProvider";
import { initialState, KEY } from "../../src/services/persistence/state";
import { createVaultStore } from "../../src/services/persistence/vault-store";
import { normalizeActivity } from "../../src/domain/activity/activity-model";
const setup = async (date: string, days: string[] = [], path = "/streak") => {
  vi.spyOn(Date, "now").mockReturnValue(Date.parse(date));
  const state = initialState();
  state.activity = normalizeActivity({
    version: 1,
    timeZone: "Europe/Helsinki",
    days,
  });
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
  await screen.findByRole("heading", { level: 1 });
  return { ...view, router, store };
};
describe("React activity views", () => {
  it("renders complete adjacent weeks, current date and non-interactive day semantics", async () => {
    const view = await setup("2026-09-12T12:00:00Z", [
      "2026-08-31",
      "2026-09-10",
    ]);
    expect(
      screen.getByRole("heading", { name: "сентябрь 2026 г." }),
    ).toBeVisible();
    expect(view.container.querySelectorAll(".calendar-day")).toHaveLength(35);
    expect(screen.getByLabelText("31 августа, сыграна партия")).toHaveClass(
      "closed",
      "adjacent",
    );
    expect(screen.getByLabelText("1 октября, будущий день")).toBeVisible();
    expect(
      view.container.querySelector('[aria-current="date"]'),
    ).toHaveTextContent("12");
    expect(view.container.querySelector("button.calendar-day")).toBeNull();
    expect(view.container.querySelector(".calendar-key.today")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
  it("handles empty progress and six-week months without invented completions", async () => {
    const view = await setup("2026-03-01T12:00:00Z");
    expect(view.container.querySelectorAll(".calendar-day")).toHaveLength(42);
    expect(screen.getByLabelText("23 февраля, без партии")).toBeVisible();
    expect(
      view.container.querySelectorAll(".calendar-day.closed"),
    ).toHaveLength(0);
  });
  it("keeps streak/freezing and daily quests on separate routes", async () => {
    const view = await setup("2026-10-16T12:00:00Z", ["2026-10-14"]);
    expect(view.container.querySelector(".calendar-grid")).toBeTruthy();
    expect(screen.getByText(/Заморозить ·/)).toBeVisible();
    expect(screen.queryByText("Задачи на сегодня")).toBeNull();
    await act(() => view.router.navigate({ to: "/calendar" }));
    await screen.findByRole("heading", { name: "Задачи на сегодня" });
    expect(view.container.querySelector(".calendar-grid")).toBeNull();
    expect(view.container.querySelector(".calendar-tracks")).toBeTruthy();
    expect(
      view.container.querySelectorAll(".calendar-rewards .calendar-reward"),
    ).toHaveLength(6);
    expect(screen.queryByText(/Заморозить ·/)).toBeNull();
  });
});
