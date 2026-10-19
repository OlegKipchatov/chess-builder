import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useOverlays } from "../../app/providers/OverlayProvider.js";
import { useVault } from "../../app/providers/VaultProvider.js";
import { importPgn, MAX_PGN_BYTES } from "../../shared/lib/pgn-import.js";
import { useImportedGame } from "./ImportedGameProvider.js";
const ImportForm = ({
  open,
  requestPaste,
  initialText = "",
  editing = false,
}: {
  open: (text: string) => void;
  requestPaste: (text: string) => void;
  initialText?: string;
  editing?: boolean;
}) => {
  const [text, setText] = useState(initialText),
    [error, setError] = useState(""),
    [paste] = useState(editing),
    fileInput = useRef<HTMLInputElement>(null),
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
      <div className="pgn-import-actions">
        <button className="quiet" onClick={() => requestPaste(text)}>
          Вставить текст
        </button>
        <button className="quiet" onClick={() => fileInput.current?.click()}>
          Выбрать файл
        </button>
        <input
          ref={fileInput}
          hidden
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
      </div>
      {paste && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit(text);
          }}
        >
          <textarea
            aria-label="Запись партии"
            placeholder="Вставьте сюда запись партии"
            className="pgn-import-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
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
  const open = (text: string) => {
    const { game } = importPgn(text);
    setEntry({
      id: `imported-${crypto.randomUUID()}`,
      pgn: game.pgn(),
      finishedAt: "",
      mode: "local",
      playerColor: game
        .history({ verbose: true })
        .some((move) => move.color === "w")
        ? "w"
        : "b",
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
  };
  const showForm = (initialText = "", editing = false) =>
    show({
      title: "Загрузить партию",
      body: (
        <ImportForm
          open={open}
          initialText={initialText}
          editing={editing}
          requestPaste={(text) => {
            const restore = (value = text) => showForm(value, true);
            show({
              title: "Вставить текст из буфера обмена?",
              onClose: () => restore(),
              body: <ClipboardPrompt onDone={restore} />,
            });
          }}
        />
      ),
    });
  return () => showForm();
};

const ClipboardPrompt = ({ onDone }: { onDone: (text?: string) => void }) => {
  const { toast } = useOverlays();
  const active = useRef(true);
  const [reading, setReading] = useState(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const paste = async () => {
    setReading(true);
    try {
      const value = await navigator.clipboard.readText();
      if (!active.current) return;
      onDone(value || undefined);
      if (!value) toast("В буфере нет текста");
    } catch {
      if (!active.current) return;
      onDone();
      toast("Вставьте текст вручную", { error: true });
    }
  };
  return (
    <>
      <button
        className="primary wide"
        disabled={reading}
        onClick={() => void paste()}
      >
        Вставить
      </button>
      <button className="quiet wide" onClick={() => onDone()}>
        Вручную
      </button>
    </>
  );
};
