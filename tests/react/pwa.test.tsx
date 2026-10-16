import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useEffect, useState } from "react";
import {
  OverlayProvider,
  useOverlays,
} from "../../src/app/providers/OverlayProvider";
import { PwaProvider, usePwaUpdate } from "../../src/app/providers/PwaProvider";
const Harness = () => {
  const pwa = usePwaUpdate(),
    { show } = useOverlays(),
    [busy, setBusy] = useState(true);
  useEffect(() => pwa.setBusy(busy), [busy, pwa.setBusy]);
  return (
    <>
      <button onClick={() => setBusy(false)}>Завершить</button>
      <button onClick={() => setBusy(true)}>Начать</button>
      <button onClick={pwa.update}>Обновить</button>
      <button
        onClick={() =>
          show({
            title: "Награда",
            body: <button onClick={() => show(null)}>Готово</button>,
          })
        }
      >
        Результат
      </button>
      <output>{pwa.available ? "Доступно" : "Нет обновления"}</output>
    </>
  );
};
const setup = async (controlled = true, waiting = true) => {
  vi.stubEnv("PROD", true);
  const service = new EventTarget() as EventTarget & {
    controller: object | null;
    register: ReturnType<typeof vi.fn>;
  };
  service.controller = controlled ? {} : null;
  const postMessage = vi.fn(),
    reg = Object.assign(new EventTarget(), {
      waiting: waiting ? { postMessage } : null,
      installing: null,
      update: vi.fn(async () => {}),
    });
  service.register = vi.fn(async () => reg);
  vi.stubGlobal(
    "navigator",
    Object.assign(Object.create(navigator), { serviceWorker: service }),
  );
  vi.stubGlobal("crossOriginIsolated", false);
  const reload = vi.fn(),
    view = render(
      <OverlayProvider>
        <PwaProvider reload={reload}>
          <Harness />
        </PwaProvider>
      </OverlayProvider>,
    );
  await act(async () => {});
  return { ...view, service, postMessage, reload, reg };
};
describe("PWA safe update lifecycle", () => {
  it("never activates a waiting update automatically, waits for a safe UI, and reloads once", async () => {
    const view = await setup();
    expect(view.postMessage).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Обновить"));
    expect(view.postMessage).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Завершить"));
    fireEvent.click(screen.getByText("Результат"));
    fireEvent.click(screen.getByText("Обновить"));
    expect(view.postMessage).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Готово"));
    fireEvent.click(screen.getByText("Обновить"));
    expect(view.postMessage).toHaveBeenCalledExactlyOnceWith({
      type: "SKIP_WAITING",
    });
    fireEvent.click(screen.getByText("Начать"));
    act(() => view.service.dispatchEvent(new Event("controllerchange")));
    expect(view.reload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Завершить"));
    expect(view.reload).toHaveBeenCalledTimes(1);
    act(() => view.service.dispatchEvent(new Event("controllerchange")));
    expect(view.reload).toHaveBeenCalledTimes(1);
  });
  it("applies first-install isolation only after game and post-game close", async () => {
    const view = await setup(false, false);
    act(() => view.service.dispatchEvent(new Event("controllerchange")));
    expect(view.reload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Результат"));
    fireEvent.click(screen.getByText("Завершить"));
    expect(view.reload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Готово"));
    await waitFor(() => expect(view.reload).toHaveBeenCalledTimes(1));
  });
  it("cleans up subscriptions and ignores late registration on unmount", async () => {
    const view = await setup(false, false),
      remove = vi.spyOn(view.service, "removeEventListener");
    view.unmount();
    act(() => view.service.dispatchEvent(new Event("controllerchange")));
    expect(view.reload).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith(
      "controllerchange",
      expect.any(Function),
    );
  });
});
