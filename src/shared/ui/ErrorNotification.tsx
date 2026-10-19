import { useEffect, useRef } from "react";
import { useOverlays } from "../../app/providers/OverlayProvider.js";
import type { NotificationType } from "./ToastNotification.js";

// For persisted/external failures only. Interactive failures notify at source.
export const ErrorNotification = ({
  message,
  type = "error",
}: {
  message: string | null | undefined;
  type?: NotificationType;
}) => {
  const { toast } = useOverlays();
  const previous = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (message && message !== previous.current) toast(message, { type });
    previous.current = message;
  }, [message, type, toast]);
  return null;
};
