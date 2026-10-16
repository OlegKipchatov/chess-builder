import { dayLabel } from "../../domain/activity/activity-model.js";
export const ActivityCelebration = ({
  event,
}: {
  event: { date: string; streak: number };
}) => (
  <div className="activity-celebration">
    <div className="calendar-day closed today day-closed-mark">
      {event.streak}
    </div>
    <strong>
      {dayLabel(event.streak)}
      {event.streak > 1 ? " подряд" : ""}
    </strong>
  </div>
);
