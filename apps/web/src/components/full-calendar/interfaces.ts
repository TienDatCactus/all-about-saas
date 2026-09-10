import type { TEventColor } from "./types";
import type { TeachingSession } from "@/services/teacher-room/types";

export interface IEvent {
  id: string;
  startDate: string;
  endDate: string;
  title: string;
  color: TEventColor;
  description: string;
  /** Who the session is with — a tutoring session's "user" is its student. */
  user: { id: string; name: string; picturePath: string | null };
  /** The real domain object this event was adapted from — dialogs read the
   *  fields the generic IEvent shape doesn't carry (status, type, priority). */
  session: TeachingSession;
}

export interface ICalendarCell {
  day: number;
  currentMonth: boolean;
  date: Date;
}
