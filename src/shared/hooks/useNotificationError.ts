import { useCallback, useState } from "react";
import { useOverlays } from "../../app/providers/OverlayProvider.js";

// Notify at the failure event, not when the error string changes: identical
// failures from separate user actions must produce separate notifications.
export const useNotificationError = () => {
  const [error, setError] = useState("");
  const { toast } = useOverlays();
  const report = useCallback(
    (message: string) => {
      setError(message);
      if (message) toast(message, { type: "error" });
    },
    [toast],
  );
  return [error, report] as const;
};
