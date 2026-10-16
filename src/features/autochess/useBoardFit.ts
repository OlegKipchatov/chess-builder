import { useLayoutEffect, useState, type RefObject } from "react";
// Preserve the compact mode's board budget while allowing enlarged text to scroll.
export const useBoardFit = (
  surface: RefObject<HTMLDivElement | null>,
  enabled: boolean,
) => {
  const [width, setWidth] = useState<number>();
  useLayoutEffect(() => {
    const node = surface.current;
    if (!enabled || !node) return;
    let frame = 0;
    const measure = () => {
      const board = node.querySelector<HTMLElement>(".board");
      if (!board) return;
      const owner = board.parentElement!,
        siblings = Array.from(node.children).filter((child) => child !== owner);
      const gaps =
        parseFloat(getComputedStyle(node).rowGap || "0") * siblings.length;
      const main = node.closest("main");
      const bottom = main
        ? parseFloat(getComputedStyle(main).paddingBottom)
        : 0;
      const available =
        (window.visualViewport?.height || innerHeight) -
        (node.getBoundingClientRect().top + window.scrollY) -
        siblings.reduce(
          (sum, child) => sum + child.getBoundingClientRect().height,
          0,
        ) -
        gaps -
        bottom -
        8;
      const maximum = Math.min(node.clientWidth, innerWidth >= 900 ? 440 : 600),
        minimum =
          parseFloat(getComputedStyle(document.documentElement).fontSize) > 20
            ? 280
            : 224;
      setWidth(
        Math.max(
          Math.min(maximum, Math.max(minimum, available)),
          Math.min(maximum, 224),
        ),
      );
    };
    const queue = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(queue);
    observer.observe(node);
    const header = document.querySelector("header");
    if (header) observer.observe(header);
    window.addEventListener("resize", queue);
    window.visualViewport?.addEventListener("resize", queue);
    // Measure after the shell has applied the destination route layout.
    queue();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", queue);
      window.visualViewport?.removeEventListener("resize", queue);
    };
  }, [surface, enabled]);
  return width;
};
