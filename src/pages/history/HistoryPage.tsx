import { useNavigate } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef } from "react";
import { useVault } from "../../app/providers/VaultProvider.js";
import { historyMetrics } from "../../domain/chess/archive.js";
import type { ArchiveEntry } from "../../domain/chess/types.js";
import { useHistoryReturn } from "../../features/game-review/HistoryReturnProvider.js";
import { Page, plural } from "../../shared/ui/Page.js";
const icons = {
  win: [
    "M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2",
    "M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2",
    "M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3",
    "M4 22h16",
    "M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z",
    "M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3",
  ],
  loss: [
    "m13 19 6-6",
    "M14.5 17.5 3.586 6.586A2 2 0 013 5.172V3h2.172a2 2 0 011.414.586L17.5 14.5",
    "m14.828 6.172 2.586-2.586A2 2 0 0118.828 3H21v2.172a2 2 0 01-.586 1.414l-2.586 2.586",
    "m16 16 4 4",
    "m19 21 2-2",
    "m5 14 4 4",
    "m5 21-2-2",
    "M7.5 16.5 4 20",
  ],
  draw: [
    "m11 17 2 2a1 1 0 1 0 3-3",
    "m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4",
    "m21 3 1 11h-2",
    "M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3",
    "M3 4h8",
  ],
} as const;
export const ArchiveRow = ({
  entry,
  index,
  total,
}: {
  entry: ArchiveEntry;
  index: number;
  total: number;
}) => {
  const navigate = useNavigate(),
    origin = useHistoryReturn(),
    metrics = historyMetrics(entry),
    date = new Date(entry.finishedAt),
    validDate = Number.isFinite(date.getTime()),
    status =
      entry.counted === false || entry.result.startsWith("Прервана")
        ? "interrupted"
        : entry.result === "Ничья"
          ? "draw"
          : entry.result === "Победа" ||
              entry.result ===
                (entry.playerColor === "b" ? "Победа чёрных" : "Победа белых")
            ? "win"
            : "loss",
    side = entry.playerColor === "b" ? "Чёрные" : "Белые",
    dateText = validDate
      ? `${date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", ...(date.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) })} · ${date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`
      : "Дата неизвестна",
    movesText =
      metrics.moves === null
        ? "Ходы —"
        : `${metrics.moves} ${plural(metrics.moves, ["ход", "хода", "ходов"])}`,
    balance =
      metrics.balance === null
        ? "—"
        : metrics.balance > 0
          ? `+${metrics.balance}`
          : String(metrics.balance);
  return (
    <button
      className="archive-entry"
      data-archive={entry.id}
      data-result={status}
      aria-label={`Партия ${index + 1} из ${total}: ${entry.result}, ${side}, ${dateText}, ${movesText}, материал ${balance}`}
      onClick={() => {
        origin.id = entry.id;
        origin.fromList = true;
        origin.returnTo = "/history";
        void navigate({
          to: "/history/$id",
          params: { id: entry.id },
          search: { analyze: false },
        });
      }}
    >
      <span className="archive-status-icon" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {status === "interrupted" ? (
            <>
              <circle cx="12" cy="12" r="9" />
              <path d="M9 8v8m6-8v8" />
            </>
          ) : (
            icons[status].map((d) => <path d={d} key={d} />)
          )}
        </svg>
      </span>
      <strong className="archive-result">{entry.result}</strong>
      <span className="archive-moves">{movesText}</span>
      <small className="archive-date">
        {side} ·{" "}
        <time dateTime={validDate ? date.toISOString() : undefined}>
          {dateText}
        </time>
      </small>
      <span className="archive-material">
        Материал{" "}
        <b
          data-balance={
            metrics.balance !== null && metrics.balance > 0
              ? "positive"
              : metrics.balance !== null && metrics.balance < 0
                ? "negative"
                : "zero"
          }
        >
          {balance}
        </b>
      </span>
    </button>
  );
};
const VirtualArchive = ({ entries }: { entries: ArchiveEntry[] }) => {
  const origin = useHistoryReturn();
  const element = useRef<HTMLDivElement>(null),
    virtual = useVirtualizer({
      initialOffset: origin.scrollTop,
      initialRect: { width: 600, height: 520 },
      count: entries.length,
      getScrollElement: () => element.current,
      estimateSize: () => 104,
      overscan: 6,
      getItemKey: (index) => entries[index].id,
    });
  return (
    <div
      ref={element}
      className="archive-scroll"
      style={{ height: "min(70vh,900px)", overflow: "auto" }}
      data-scroll-restoration-id="archive"
      onScroll={(event) => {
        origin.scrollTop = event.currentTarget.scrollTop;
      }}
    >
      <div style={{ height: virtual.getTotalSize(), position: "relative" }}>
        {virtual.getVirtualItems().map((row) => (
          <div
            key={row.key}
            style={{
              position: "absolute",
              width: "100%",
              height: 104,
              transform: `translateY(${row.start}px)`,
            }}
          >
            <ArchiveRow
              entry={entries[row.index]}
              index={row.index}
              total={entries.length}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
export const HistoryPage = () => {
  const entries = useVault((s) => s.archive),
    origin = useHistoryReturn();
  useEffect(() => {
    if (!origin.id) return;
    const frame = requestAnimationFrame(() => {
      const row = Array.from(
        document.querySelectorAll<HTMLButtonElement>("[data-archive]"),
      ).find((node) => node.dataset.archive === origin.id);
      row?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [origin]);
  return (
    <Page id="archive" title="История партий" back="/profile">
      {entries.length > 50 ? (
        <VirtualArchive entries={entries} />
      ) : (
        <div className="archive-list">
          {entries.map((entry, index) => (
            <ArchiveRow
              key={entry.id}
              entry={entry}
              index={index}
              total={entries.length}
            />
          ))}
        </div>
      )}
      {!entries.length && (
        <p className="empty-state">Здесь появятся завершённые партии.</p>
      )}
    </Page>
  );
};
export default HistoryPage;
