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

/** This app has exactly one teacher, always in Vietnam (UTC+7) — the 'HH:mm'
 *  a teacher types is meant as Vietnam local time, so it's tagged with a
 *  fixed +07:00 offset here rather than treated as literal UTC. This makes
 *  the resulting instant correct for comparison against `new Date()` (a real
 *  wall-clock "now") regardless of what timezone the server process itself
 *  runs under — only the single-timezone assumption is the simplification,
 *  not the server's own clock. Revisit if this app ever supports a teacher
 *  outside Vietnam. */
const TEACHER_TZ_OFFSET = '+07:00';

export function combineDateTime(scheduledDate: string, hhmm: string): Date {
	return new Date(`${scheduledDate}T${hhmm}:00.000${TEACHER_TZ_OFFSET}`);
}
