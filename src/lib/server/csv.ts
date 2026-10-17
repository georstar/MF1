import type { GuestInput, SongRow } from './db';

const BOM = '﻿';

export const GUEST_TEMPLATE_CSV = `${BOM}first_name,last_name,label\r\nMaria,Papadopoulou,\r\nJean-Luc,Picard,Paris\r\n`;

// Splits one CSV line, honouring quotes and doubled quotes.
function splitLine(line: string, sep: string): string[] {
	const out: string[] = [];
	let cell = '';
	let quoted = false;
	for (let i = 0; i < line.length; i++) {
		const c = line[i];
		if (quoted) {
			if (c === '"' && line[i + 1] === '"') {
				cell += '"';
				i++;
			} else if (c === '"') quoted = false;
			else cell += c;
		} else if (c === '"') quoted = true;
		else if (c === sep) {
			out.push(cell);
			cell = '';
		} else cell += c;
	}
	out.push(cell);
	return out.map((s) => s.trim());
}

export function parseGuestCsv(text: string): { rows: GuestInput[]; errors: string[] } {
	const lines = text.replace(/^﻿/, '').split(/\r?\n/);
	const header = lines[0] ?? '';
	const sep = header.split(';').length > header.split(',').length ? ';' : ',';
	const rows: GuestInput[] = [];
	const errors: string[] = [];
	lines.slice(1).forEach((line, i) => {
		if (!line.trim()) return;
		const [firstName = '', lastName = '', label = ''] = splitLine(line, sep);
		if (!firstName || !lastName) {
			errors.push(`Line ${i + 2}: needs both a first and a last name.`);
			return;
		}
		rows.push({ firstName, lastName, label });
	});
	return { rows, errors };
}

const greekTime = new Intl.DateTimeFormat('sv-SE', {
	timeZone: 'Europe/Athens',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit'
});

function cell(value: string): string {
	return /[",\r\n;]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function songsToCsv(rows: SongRow[]): string {
	const lines = [['Title', 'Artist', 'Added by', 'Added at (Greek time)', 'Source']];
	for (const r of rows) {
		lines.push([
			r.title,
			r.artist,
			r.guestLabel ? `${r.guestName} (${r.guestLabel})` : r.guestName,
			greekTime.format(new Date(r.createdAt)),
			r.source === 'typed' ? 'typed by guest' : 'catalogue'
		]);
	}
	return BOM + lines.map((l) => l.map(cell).join(',')).join('\r\n') + '\r\n';
}
