import {
	occurrenceDates,
	combineDateTime,
	todayInTeacherTz,
} from './schedule-dates';

describe('occurrenceDates', () => {
	it('returns every matching weekday in the next N weeks, inclusive of today', () => {
		// 2026-09-08 is a Tuesday (dayOfWeek 2).
		const from = new Date('2026-09-08T00:00:00.000Z');
		const dates = occurrenceDates(2, from, 6);

		expect(dates[0]).toBe('2026-09-08');
		expect(dates).toHaveLength(6);
		expect(dates[1]).toBe('2026-09-15');
		expect(dates.at(-1)).toBe('2026-10-13');
	});

	it('excludes today when today does not match dayOfWeek', () => {
		const from = new Date('2026-09-08T00:00:00.000Z'); // Tuesday
		const dates = occurrenceDates(1, from, 6); // Monday

		expect(dates[0]).toBe('2026-09-14');
		expect(dates).toHaveLength(6);
	});
});

describe('combineDateTime', () => {
	it('treats HH:mm as Vietnam local time (+07:00), converting to the equivalent UTC instant', () => {
		const dt = combineDateTime('2026-09-08', '15:30');
		// 15:30 +07:00 = 08:30 UTC.
		expect(dt.toISOString()).toBe('2026-09-08T08:30:00.000Z');
	});
});

describe('todayInTeacherTz', () => {
	it('reads the Vietnam calendar date, not the UTC one', () => {
		// 23:30 UTC on the 8th = 06:30 Vietnam time on the 9th — a plain
		// `toISOString().slice(0, 10)` would wrongly read this as the 8th.
		const now = new Date('2026-09-08T23:30:00.000Z');
		expect(todayInTeacherTz(now)).toBe('2026-09-09');
	});

	it('still agrees with the UTC date mid-day, when both are unambiguous', () => {
		const now = new Date('2026-09-08T10:00:00.000Z');
		expect(todayInTeacherTz(now)).toBe('2026-09-08');
	});
});
