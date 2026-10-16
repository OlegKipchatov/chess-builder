import { useNavigate } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import { useVault } from "../../app/providers/VaultProvider.js";
import { historyMetrics } from "../../domain/chess/archive.js";
import type { ArchiveEntry } from "../../domain/chess/types.js";
import { Page } from "../../shared/ui/Page.js";
const ArchiveRow = ({ entry }: { entry: ArchiveEntry }) => {
  const navigate = useNavigate(),
    metrics = historyMetrics(entry),
    date = new Date(entry.finishedAt);
  return (
    <button
      className="archive-entry"
      data-result={
        entry.counted === false
          ? "interrupted"
          : entry.result === "Победа"
            ? "win"
            : entry.result === "Поражение"
              ? "loss"
              : "draw"
      }
      onClick={() =>
        void navigate({
          to: "/history/$id",
          params: { id: entry.id },
          search: { analyze: false },
        })
      }
    >
      <span className="archive-status-icon" aria-hidden="true">
        {entry.result === "Победа"
          ? "✓"
          : entry.result === "Поражение"
            ? "×"
            : entry.counted === false
              ? "!"
              : "="}
      </span>
      <span className="archive-entry-copy">
        <strong>{entry.result}</strong>
        <span>
          {metrics.moves ?? "—"} ходов ·{" "}
          {entry.playerColor === "w" ? "Белые" : "Чёрные"}
        </span>
      </span>
      <span className="archive-entry-meta">
        <time dateTime={entry.finishedAt}>
          {date.toLocaleDateString("ru-RU")}{" "}
          {date.toLocaleTimeString("ru-RU", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
        <span>
          {metrics.balance === null
            ? "—"
            : metrics.balance > 0
              ? `+${metrics.balance}`
              : metrics.balance}
        </span>
      </span>
    </button>
  );
};
const VirtualArchive = ({ entries }: { entries: ArchiveEntry[] }) => {
  const element = useRef<HTMLDivElement>(null),
    virtual = useVirtualizer({
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
            <ArchiveRow entry={entries[row.index]} />
          </div>
        ))}
      </div>
    </div>
  );
};
export const HistoryPage = () => {
  const entries = useVault((s) => s.archive);
  return (
    <Page id="archive" title="История партий" back="/profile">
      {entries.length > 50 ? (
        <VirtualArchive entries={entries} />
      ) : (
        <div className="archive-list">
          {entries.map((entry) => (
            <ArchiveRow key={entry.id} entry={entry} />
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
