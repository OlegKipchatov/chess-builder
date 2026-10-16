import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MoveNavigation } from "../../src/features/game-review/MoveNavigation.js";
const Controls = () => {
  const [cursor, seek] = useState(0);
  return <MoveNavigation cursor={cursor} total={30} onSeek={seek} />;
};
describe("continuous history control", () => {
  it("keeps fractional pointer position, commits whole plies and supports keyboard boundaries", () => {
    render(<Controls />);
    const input = screen.getByRole("slider");
    fireEvent.pointerDown(input);
    fireEvent.change(input, { target: { value: "3.4" } });
    expect(input).toHaveValue("3.4");
    expect(input).toHaveAttribute("aria-valuetext", "3 из 30");
    fireEvent.pointerUp(input);
    expect(input).toHaveValue("3");
    fireEvent.keyDown(input, { key: "ArrowRight" });
    expect(input).toHaveValue("4");
    fireEvent.keyDown(input, { key: "End" });
    expect(input).toHaveValue("30");
    fireEvent.keyDown(input, { key: "Home" });
    expect(input).toHaveValue("0");
  });
  it("interpolates playback without driving board state and cancels its frame on unmount", () => {
    let callback: FrameRequestCallback = () => {};
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((fn) => {
        callback = fn;
        return 7;
      }),
    );
    const cancel = vi.fn();
    vi.stubGlobal("cancelAnimationFrame", cancel);
    const seek = vi.fn();
    const view = render(
      <MoveNavigation cursor={5} total={30} onSeek={seek} playing />,
    );
    view.rerender(
      <MoveNavigation cursor={6} total={30} onSeek={seek} playing />,
    );
    act(() => callback(100));
    act(() => callback(310));
    expect(Number((screen.getByRole("slider") as HTMLInputElement).value)).toBe(
      5.5,
    );
    expect(seek).not.toHaveBeenCalled();
    view.unmount();
    expect(cancel).toHaveBeenCalledWith(7);
  });
});
