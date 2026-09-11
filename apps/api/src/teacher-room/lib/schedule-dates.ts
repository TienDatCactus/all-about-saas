/** UTC-date arithmetic only — 'YYYY-MM-DD' output has no timezone of its own,
 *  same simplification as scheduledDate's server-TZ 'today' elsewhere in this module. */
function toDateOnly(d: Date): string {
	return d.toISOString().slice(0, 10);
}

/**
 * Every date matching `dayOfWeek` (0=Sun..6=Sat) across the `weeks`-week
 * window starting at `from` (inclusive of `from`'s own date if it matches).
 */
export function occurrenceDates(
	dayOfWeek: number,
	from: Date,
	weeks: number,
): string[] {
	const start = new Date(
		Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
	);
	const totalDays = weeks * 7;
	const dates: string[] = [];
	for (let i = 0; i < totalDays; i++) {
		const d = new Date(start);
		d.setUTCDate(d.getUTCDate() + i);
		if (d.getUTCDay() === dayOfWeek) dates.push(toDateOnly(d));
	}
	return dates;
}

/** This app has exactly one teacher, always in Vietnam — the 'HH:mm' a teacher
 *  types is meant as Vietnam local time, and 'today' for cron jobs means the
 *  Vietnam calendar day, regardless of what timezone the server process (or
 *  its OS) happens to run under. `TEACHER_TZ` is also the single source of
 *  truth for every `@Cron(..., { timeZone: TEACHER_TZ })` in the scheduler,
 *  so a wall-clock time like "20:00" in a cron expression actually fires at
 *  20:00 Vietnam time instead of 20:00-in-whatever-TZ-the-container-has.
 *  Revisit if this app ever supports a teacher outside Vietnam. */
export const TEACHER_TZ = 'Asia/Ho_Chi_Minh';
const TEACHER_TZ_OFFSET = '+07:00';

export function combineDateTime(scheduledDate: string, hhmm: string): Date {
	return new Date(`${scheduledDate}T${hhmm}:00.000${TEACHER_TZ_OFFSET}`);
}

/** The Vietnam calendar date for a given instant, as 'YYYY-MM-DD'. Use this
 *  for every cron job's 'today', not `now.toISOString().slice(0, 10)` — that
 *  reads the UTC calendar day, which is a different date than Vietnam's for
 *  part of every day (Vietnam is UTC+7, so it has already rolled to the next
 *  day while UTC's date is still 'yesterday'). */
export function todayInTeacherTz(now: Date): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: TEACHER_TZ }).format(now);
}
