import { describe, expect, it } from 'vitest';
import { freshDb } from './helpers/d1';
import { addGuests, findGuests, listGuests, removeGuest } from '../src/lib/server/guests';

describe('guests', () => {
	it('adds guests and finds them ignoring case, accents and order', async () => {
		const db = await freshDb();
		await addGuests(db, [{ firstName: 'Hélène', lastName: 'Dupont' }]);
		expect(await findGuests(db, 'helene  DUPONT')).toHaveLength(1);
		expect(await findGuests(db, 'Dupont Helene')).toHaveLength(1);
	});

	it('returns every guest sharing a name with their labels', async () => {
		const db = await freshDb();
		await addGuests(db, [
			{ firstName: 'Maria', lastName: 'Papadopoulou', label: 'Athens' },
			{ firstName: 'Maria', lastName: 'Papadopoulou', label: "Bride's side" }
		]);
		const found = await findGuests(db, 'maria papadopoulou');
		expect(found).toHaveLength(2);
		expect(found.map((g) => g.label).sort()).toEqual(['Athens', "Bride's side"]);
	});

	it('re-adding the same list adds nothing and deletes nothing', async () => {
		const db = await freshDb();
		const list = [
			{ firstName: 'Amina', lastName: 'Diallo' },
			{ firstName: 'Jean-Luc', lastName: 'Picard' },
			{ firstName: 'Eleni', lastName: 'Georgiou' }
		];
		await addGuests(db, list);
		const result = await addGuests(db, [...list, { firstName: 'Frank', lastName: 'Miller' }]);
		expect(result).toEqual({ added: 1, skipped: 3 });
		expect(await listGuests(db)).toHaveLength(4);
	});

	it('removing a guest removes their songs', async () => {
		const db = await freshDb();
		await addGuests(db, [{ firstName: 'Amina', lastName: 'Diallo' }]);
		const [guest] = await listGuests(db);
		await db
			.prepare("INSERT INTO songs (guest_id, title, artist, source, song_key, created_at) VALUES (?, 'Valerie', 'Amy Winehouse', 'catalog', 'valerie|amy winehouse', '2026-10-17T00:00:00Z')")
			.bind(guest.id)
			.run();
		await removeGuest(db, guest.id);
		const row = await db.prepare('SELECT count(*) AS n FROM songs').first<{ n: number }>();
		expect(row?.n).toBe(0);
	});

	it('unknown name returns empty', async () => {
		const db = await freshDb();
		await addGuests(db, [{ firstName: 'Amina', lastName: 'Diallo' }]);
		expect(await findGuests(db, 'Nobody Here')).toEqual([]);
	});
});
