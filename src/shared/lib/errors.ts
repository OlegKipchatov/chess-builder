export const asError = (value: unknown): Error =>
  value instanceof Error ? value : new Error(String(value));
export const aborted = (): DOMException =>
  new DOMException("Операция отменена", "AbortError");
