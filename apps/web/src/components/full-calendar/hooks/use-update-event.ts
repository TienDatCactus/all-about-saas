import { format } from "date-fns";
import { useRescheduleSessionMutation } from "@/services/teacher-room/queries";
import type { IEvent } from "../interfaces";

/** Called by drag-and-drop drop targets with the event's NEW start/end
 *  already computed — persists it as a reschedule (date/time change only,
 *  never a student swap). */
export function useUpdateEvent() {
  const reschedule = useRescheduleSessionMutation();

  const updateEvent = (event: IEvent) => {
    const newStart = new Date(event.startDate);
    const newEnd = new Date(event.endDate);

    reschedule.mutate({
      id: event.session.id,
      data: {
        newDate: format(newStart, "yyyy-MM-dd"),
        newStartTime: format(newStart, "HH:mm"),
        newEndTime: format(newEnd, "HH:mm"),
      },
    });
  };

  return { updateEvent };
}
