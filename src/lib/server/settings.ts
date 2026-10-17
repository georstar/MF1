import type { D1Database } from './db';

export const DEFAULT_CLOSE_DATE = '2027-07-04';
const TIME_ZONE = 'Europe/Athens';

export async function getCloseDate(db: D1Database): Promise<string> {
	const row = await db.prepare("SELECT value FROM settings WHERE key = 'close_date'").first<{ value: string }>();
	return row?.value ?? DEFAULT_CLOSE_DATE;
}

function isValidDate(date: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
	const d = new Date(`${date}T00:00:00Z`);
	return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

export async function setCloseDate(db: D1Database, date: string): Promise<void> {
	if (!isValidDate(date)) throw new Error(`Invalid date: ${date}`);
	await db
		.prepare("INSERT INTO settings (key, value) VALUES ('close_date', ?1) ON CONFLICT (key) DO UPDATE SET value = ?1")
		.bind(date)
		.run();
}

// Picks close at the end of the closing day, Greek time.
export function isClosed(closeDate: string, now: Date): boolean {
	const today = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
	return today > closeDate;
}
