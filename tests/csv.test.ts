import { describe, expect, it } from 'vitest';
import { parseGuestCsv, songsToCsv } from '../src/lib/server/csv';
import type { SongRow } from '../src/lib/server/db';

describe('parseGuestCsv', () => {
	it('parses Excel-style semicolon CSV with BOM', () => {
		const text = '﻿first_name;last_name;label\r\nAmina;Diallo;\r\n\r\n"Jean-Luc";"Picard";"Paris, France"\r\n';
		const { rows, errors } = parseGuestCsv(text);
		expect(errors).toEqual([]);
		expect(rows).toHaveLength(2);
		expect(rows[0]).toEqual({ firstName: 'Amina', lastName: 'Diallo', label: '' });
		expect(rows[1].label).toBe('Paris, France');
	});

	it('reports rows missing a last name', () => {
		const { rows, errors } = parseGuestCsv('first_name,last_name\nAmina,Diallo\nCher,\n');
		expect(rows).toHaveLength(1);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain('3');
	});
});

describe('songsToCsv', () => {
	const row = (over: Partial<SongRow>): SongRow => ({
		id: 1,
		title: 'Valerie',
		artist: 'Amy Winehouse',
		artworkUrl: null,
		source: 'catalog',
		guestId: 1,
		guestName: 'Amina Diallo',
		guestLabel: '',
		createdAt: '2027-07-01T21:30:00.000Z',
		...over
	});

	it('marks typed songs, starts with a BOM and uses Greek time', () => {
		const csv = songsToCsv([row({}), row({ id: 2, title: 'Misirlou', source: 'typed' })]);
		expect(csv.startsWith('﻿')).toBe(true);
		expect(csv).toContain('typed by guest');
		expect(csv).toContain('catalogue');
		expect(csv).toContain('2027-07-02 00:30');
	});
});
