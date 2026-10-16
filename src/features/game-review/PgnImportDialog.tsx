import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useOverlays } from "../../app/providers/OverlayProvider.js";
import { useVault } from "../../app/providers/VaultProvider.js";
import { importPgn, MAX_PGN_BYTES } from "../../shared/lib/pgn-import.js";
import { useImportedGame } from "./ImportedGameProvider.js";
const ImportForm = ({ open }: { open: (text: string) => void }) => {
  const [text, setText] = useState(""),
    [error, setError] = useState(""),
    [paste, setPaste] = useState(false),
    generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const submit = (text: string) => {
    try {
      open(text);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  return (
    <>
      <p>Откройте одну партию. Импорт не меняет историю, рейтинг и награды.</p>
      <div className="pgn-import-options">
        <label className="button">
          Выбрать файл
          <input
            aria-label="Файл PGN"
            type="file"
            accept=".pgn,text/plain,application/x-chess-pgn"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (file.size > MAX_PGN_BYTES) {
                setError("Файл слишком большой. Максимум — 512 КБ.");
                return;
              }
              const token = ++generation.current;
              try {
                const value = await file.text();
                if (generation.current === token) submit(value);
              } catch {
                if (generation.current === token)
                  setError("Не удалось прочитать файл.");
              }
            }}
          />
        </label>
        <button onClick={() => setPaste(true)}>Вставить текст</button>
      </div>
      {paste && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit(text);
          }}
        >
          <label>
            Текст PGN
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              style={{ fontSize: 16, width: "100%", minHeight: 200 }}
            />
          </label>
          <button className="primary wide" type="submit">
            Открыть партию
          </button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </>
  );
};
export const usePgnImportDialog = () => {
  const equipped = useVault((state) => state.equipped),
    { setEntry } = useImportedGame(),
    { show } = useOverlays(),
    navigate = useNavigate();
  return () =>
    show({
      title: "Открыть PGN",
      body: (
        <ImportForm
          open={(text) => {
            const { game } = importPgn(text);
            setEntry({
              id: "imported",
              pgn: game.pgn(),
              finishedAt: "",
              mode: "local",
              playerColor: "w",
              equipped,
              result: game.getHeaders().Result || "*",
              points: 0,
              playerRating: 0,
              opponentRating: null,
              ratingDelta: null,
              engineProfile: null,
              imported: true,
              counted: false,
            });
            show(null);
            void navigate({ to: "/import" });
          }}
        />
      ),
    });
};
