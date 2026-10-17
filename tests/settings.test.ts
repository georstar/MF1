import { describe, expect, it } from 'vitest';
import { freshDb } from './helpers/d1';
import { DEFAULT_CLOSE_DATE, getCloseDate, isClosed, setCloseDate } from '../src/lib/server/settings';

describe('closing date', () => {
	it('is still open at 23:59 Greek time on the closing day', () => {
		expect(isClosed('2027-07-04', new Date('2027-07-04T20:59:00Z'))).toBe(false);
	});
	it('closes at midnight Greek time after the closing day', () => {
		expect(isClosed('2027-07-04', new Date('2027-07-04T21:00:00Z'))).toBe(true);
	});
	it('defaults to 4 July 2027', async () => {
		const db = await freshDb();
		expect(DEFAULT_CLOSE_DATE).toBe('2027-07-04');
		expect(await getCloseDate(db)).toBe('2027-07-04');
	});
	it('can be changed', async () => {
		const db = await freshDb();
		await setCloseDate(db, '2027-07-10');
		expect(await getCloseDate(db)).toBe('2027-07-10');
	});
	it('rejects other date formats', async () => {
		const db = await freshDb();
		await expect(setCloseDate(db, '10/07/2027')).rejects.toThrow();
		await expect(setCloseDate(db, '2027-02-31')).rejects.toThrow();
	});
});
