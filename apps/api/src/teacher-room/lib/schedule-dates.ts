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

/** Same UTC-only simplification as above — combines a 'YYYY-MM-DD' date and 'HH:mm' time into one Date for reminder-timing comparisons. */
export function combineDateTime(scheduledDate: string, hhmm: string): Date {
	return new Date(`${scheduledDate}T${hhmm}:00.000Z`);
}
