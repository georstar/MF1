import type { D1Database, Guest, GuestInput } from './db';
import { nameKey, nameKeys } from './normalize';

const SELECT = `SELECT g.id, g.first_name AS firstName, g.last_name AS lastName, g.label,
	(SELECT count(*) FROM songs s WHERE s.guest_id = g.id) AS picks
	FROM guests g`;

const clean = (input: GuestInput) => ({
	firstName: input.firstName.trim().replace(/\s+/g, ' '),
	lastName: input.lastName.trim().replace(/\s+/g, ' '),
	label: (input.label ?? '').trim()
});

export async function findGuests(db: D1Database, typed: string): Promise<Guest[]> {
	const key = nameKey(typed);
	if (!key) return [];
	const { results } = await db.prepare(`${SELECT} WHERE g.key_a = ?1 OR g.key_b = ?1 ORDER BY g.label`).bind(key).all<Guest>();
	return results;
}

export async function getGuest(db: D1Database, id: number): Promise<Guest | null> {
	return db.prepare(`${SELECT} WHERE g.id = ?`).bind(id).first<Guest>();
}

export async function listGuests(db: D1Database): Promise<Guest[]> {
	const { results } = await db.prepare(`${SELECT} ORDER BY g.last_name COLLATE NOCASE, g.first_name COLLATE NOCASE`).all<Guest>();
	return results;
}

// Adds new guests only; a row matching an existing name + label is skipped.
export async function addGuests(db: D1Database, rows: GuestInput[]): Promise<{ added: number; skipped: number }> {
	const { results } = await db.prepare('SELECT key_a, label FROM guests').all<{ key_a: string; label: string }>();
	const seen = new Set(results.map((r) => `${r.key_a}\n${r.label}`));
	const now = new Date().toISOString();
	const inserts = [];
	for (const row of rows.map(clean)) {
		const [a, b] = nameKeys(row.firstName, row.lastName);
		const id = `${a}\n${row.label}`;
		if (seen.has(id)) continue;
		seen.add(id);
		inserts.push(
			db
				.prepare('INSERT INTO guests (first_name, last_name, label, key_a, key_b, created_at) VALUES (?, ?, ?, ?, ?, ?)')
				.bind(row.firstName, row.lastName, row.label, a, b, now)
		);
	}
	if (inserts.length) await db.batch(inserts);
	return { added: inserts.length, skipped: rows.length - inserts.length };
}

export async function updateGuest(db: D1Database, id: number, input: GuestInput): Promise<void> {
	const row = clean(input);
	const [a, b] = nameKeys(row.firstName, row.lastName);
	await db
		.prepare('UPDATE guests SET first_name = ?, last_name = ?, label = ?, key_a = ?, key_b = ? WHERE id = ?')
		.bind(row.firstName, row.lastName, row.label, a, b, id)
		.run();
}

export async function removeGuest(db: D1Database, id: number): Promise<void> {
	await db.batch([db.prepare('DELETE FROM songs WHERE guest_id = ?').bind(id), db.prepare('DELETE FROM guests WHERE id = ?').bind(id)]);
}
