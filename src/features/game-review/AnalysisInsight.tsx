import type { MoveAnalysis } from "../../domain/analysis/types.js";
import { isImportantInsight } from "../../domain/analysis/analysis-events.js";
import {
  insightLabel,
  explanationFor,
} from "../../domain/analysis/analysis-explanations.js";
import {
  insightLines,
  visibleVariation,
  humanMove,
} from "../../domain/analysis/presentation.js";
const noop = () => {};
export const AnalysisInsight = ({
  move,
  hint = false,
  expanded = false,
  onHint = noop,
  onExpand = noop,
  onPractice = noop,
}: {
  move?: MoveAnalysis | null;
  hint?: boolean;
  expanded?: boolean;
  onHint?: () => void;
  onExpand?: () => void;
  onPractice?: () => void;
}) => {
  if (!move || !isImportantInsight(move)) return null;
  const label = insightLabel(move),
    line = insightLines(move)[0],
    explanation = explanationFor(move);
  return (
    <article className="analysis-insight" id="analysis-insight">
      <div className="analysis-insight-heading">
        <h2 data-quality={move.highlight || move.quality}>{label}</h2>
        <div className="analysis-insight-actions">
          {move.exercise ? (
            <button
              data-analysis-practice
              className="primary analysis-variation"
              onClick={onPractice}
            >
              Найти мат
            </button>
          ) : (
            line && (
              <>
                {hint && visibleVariation(move, true).pv.length > 1 && (
                  <button
                    data-analysis-expand
                    className="quiet analysis-variation"
                    aria-pressed={expanded}
                    onClick={onExpand}
                  >
                    Вариант
                  </button>
                )}
                <button
                  className="quiet analysis-variation stable-label"
                  data-size-label="Подсказка"
                  data-analysis-line={line.move}
                  aria-pressed={hint}
                  onClick={onHint}
                >
                  <span className="control-label">
                    {hint ? "Скрыть" : "Подсказка"}
                  </span>
                </button>
              </>
            )
          )}
        </div>
      </div>
      <p>
        Вы сыграли:{" "}
        <strong>{humanMove(move.playedSan, move.playedMove)}</strong>
      </p>
      {explanation && <p>{explanation}</p>}
      {(move.relatedPlies?.length || 0) > 1 && (
        <p>
          В следующих ходах сохранялась та же возможность. Разберём её один раз.
        </p>
      )}
      {move.recommendationEvidence && !move.recommendationEvidence.primary && (
        <p>{move.recommendationEvidence.text}</p>
      )}
    </article>
  );
};
