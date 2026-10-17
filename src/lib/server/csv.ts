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

// Excel's plain "CSV" format is Windows-1252, not UTF-8. Bytes 0x80-0x9F differ from Latin-1.
const CP1252 = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ';

export function decodeCsv(bytes: Uint8Array): string {
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		let out = '';
		for (const b of bytes) out += b >= 0x80 && b <= 0x9f ? CP1252[b - 0x80] : String.fromCharCode(b);
		return out;
	}
}

const SEPARATORS = [';', ',', '\t'];
const HEADER = /first|last|name|vorname|prénom|prenom/i;

// Picks the separator that splits the most lines into at least two filled cells.
// The header can't decide alone: Greek/French Excel keeps a comma header in one cell.
function detectSeparator(lines: string[]): string {
	let best = ',';
	let bestScore = -1;
	for (const sep of SEPARATORS) {
		const score = lines.slice(0, 20).filter((l) => splitLine(l, sep).filter(Boolean).length >= 2).length;
		if (score > bestScore) {
			best = sep;
			bestScore = score;
		}
	}
	return best;
}

export function parseGuestCsv(text: string): { rows: GuestInput[]; errors: string[] } {
	const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
	const sep = detectSeparator(lines.slice(1).filter((l) => l.trim()));
	const rows: GuestInput[] = [];
	const errors: string[] = [];
	const start = HEADER.test(lines[0] ?? '') ? 1 : 0;
	lines.slice(start).forEach((line, i) => {
		const cells = splitLine(line, sep);
		if (cells.every((c) => !c)) return;
		const lineNo = i + start + 1;
		const [firstName = '', lastName = '', label = ''] = cells;
		if (!firstName || !lastName) {
			errors.push(`Line ${lineNo}: needs both a first and a last name.`);
			return;
		}
		if (/[?\uFFFD]/.test(firstName + lastName + label)) {
			errors.push(`Line ${lineNo}: some letters were lost when the file was saved. In Excel, choose "Save as" → "CSV UTF-8" and upload again.`);
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
