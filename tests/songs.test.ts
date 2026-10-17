import { describe, expect, it } from 'vitest';
import { freshDb } from './helpers/d1';
import { addGuests, listGuests } from '../src/lib/server/guests';
import { listSongs, picksOf, progress, removeSong, resetGuest, savePicks, slotsLeft, type PickInput } from '../src/lib/server/songs';

const NOW = new Date('2027-06-01T12:00:00Z');
const song = (title: string, artist = 'ABBA', source: PickInput['source'] = 'catalog'): PickInput => ({ title, artist, source });

async function setup() {
	const db = await freshDb();
	await addGuests(db, [
		{ firstName: 'Amina', lastName: 'Diallo' },
		{ firstName: 'Hélène', lastName: 'Dupont' },
		{ firstName: 'Eleni', lastName: 'Georgiou' }
	]);
	const [amina, helene, eleni] = await listGuests(db);
	return { db, amina, helene, eleni };
}

describe('savePicks', () => {
	it('saves exactly two picks', async () => {
		const { db, amina } = await setup();
		expect(await savePicks(db, amina.id, [song('Dancing Queen'), song('Valerie', 'Amy Winehouse')], NOW)).toEqual({ ok: true });
		expect(await picksOf(db, amina.id)).toHaveLength(2);
		expect(await slotsLeft(db, amina.id)).toBe(0);
	});

	it('rejects wrong count', async () => {
		const { db, amina } = await setup();
		expect(await savePicks(db, amina.id, [song('Dancing Queen')], NOW)).toEqual({ ok: false, reason: 'wrong-count' });
		expect(await savePicks(db, amina.id, [song('A'), song('B'), song('C')], NOW)).toEqual({ ok: false, reason: 'wrong-count' });
	});

	it('rejects empty titles as wrong count', async () => {
		const { db, amina } = await setup();
		expect(await savePicks(db, amina.id, [song('  '), song('Valerie')], NOW)).toEqual({ ok: false, reason: 'wrong-count' });
	});

	it('rejects the same song twice in one request', async () => {
		const { db, amina } = await setup();
		expect(await savePicks(db, amina.id, [song('Dancing Queen'), song('Dancing Queen (Remastered)')], NOW)).toEqual({
			ok: false,
			reason: 'duplicate-in-request'
		});
	});

	it('rejects a song taken by another guest and names it', async () => {
		const { db, amina, helene } = await setup();
		await savePicks(db, amina.id, [song('Dancing Queen'), song('September', 'Earth, Wind & Fire')], NOW);
		const result = await savePicks(db, helene.id, [song('Dancing Queen - Remastered 2011'), song('Valerie', 'Amy Winehouse')], NOW);
		expect(result).toEqual({ ok: false, reason: 'taken', taken: [song('Dancing Queen - Remastered 2011')] });
		expect(await picksOf(db, helene.id)).toHaveLength(0);
	});

	it('concurrent saves of the same song: only one wins', async () => {
		const { db, amina, helene } = await setup();
		const results = await Promise.all([
			savePicks(db, amina.id, [song('Dancing Queen'), song('Valerie', 'Amy Winehouse')], NOW),
			savePicks(db, helene.id, [song('Dancing Queen'), song('Toxic', 'Britney Spears')], NOW)
		]);
		expect(results.filter((r) => r.ok)).toHaveLength(1);
	});

	it('the same guest saving twice at once never ends up with more than two songs', async () => {
		const { db, amina } = await setup();
		await Promise.all([
			savePicks(db, amina.id, [song('Dancing Queen'), song('Valerie', 'Amy Winehouse')], NOW),
			savePicks(db, amina.id, [song('Mamma Mia'), song('Toxic', 'Britney Spears')], NOW)
		]);
		expect(await picksOf(db, amina.id)).toHaveLength(2);
	});

	it('only allows replacing removed picks', async () => {
		const { db, amina } = await setup();
		await savePicks(db, amina.id, [song('Dancing Queen'), song('Valerie', 'Amy Winehouse')], NOW);
		const [first] = await picksOf(db, amina.id);
		await removeSong(db, first.id);
		expect(await slotsLeft(db, amina.id)).toBe(1);
		expect(await savePicks(db, amina.id, [song('A'), song('B')], NOW)).toEqual({ ok: false, reason: 'wrong-count' });
		expect(await savePicks(db, amina.id, [song('Mamma Mia')], NOW)).toEqual({ ok: true });
	});

	it('a second save after two picks is rejected', async () => {
		const { db, amina } = await setup();
		await savePicks(db, amina.id, [song('Dancing Queen'), song('Valerie', 'Amy Winehouse')], NOW);
		expect(await savePicks(db, amina.id, [song('Mamma Mia'), song('SOS')], NOW)).toEqual({ ok: false, reason: 'wrong-count' });
	});

	it('typed songs are saved with source typed and deduplicate against catalogue songs', async () => {
		const { db, amina, helene } = await setup();
		await savePicks(db, amina.id, [song('Misirlou', 'Dick Dale', 'typed'), song('Valerie', 'Amy Winehouse')], NOW);
		expect((await picksOf(db, amina.id)).find((p) => p.title === 'Misirlou')?.source).toBe('typed');
		const result = await savePicks(db, helene.id, [song('misirlou', 'DICK DALE'), song('Toxic', 'Britney Spears')], NOW);
		expect(result.ok).toBe(false);
	});

	it('reports busy instead of crashing when the database drops the save', async () => {
		const { db, amina } = await setup();
		const flaky = new Proxy(db, {
			get: (target, prop) =>
				prop === 'batch'
					? async () => {
							throw new Error('Network connection lost.');
						}
					: Reflect.get(target, prop).bind?.(target) ?? Reflect.get(target, prop)
		});
		expect(await savePicks(flaky, amina.id, [song('Dancing Queen'), song('Valerie', 'Amy Winehouse')], NOW)).toEqual({ ok: false, reason: 'busy' });
		expect(await slotsLeft(db, amina.id)).toBe(2);
	});

	it('resetGuest clears both picks', async () => {
		const { db, amina } = await setup();
		await savePicks(db, amina.id, [song('Dancing Queen'), song('Valerie', 'Amy Winehouse')], NOW);
		await resetGuest(db, amina.id);
		expect(await slotsLeft(db, amina.id)).toBe(2);
	});
});

describe('listing', () => {
	it('listSongs searches by guest name, title and artist ignoring accents', async () => {
		const { db, amina, helene } = await setup();
		await savePicks(db, amina.id, [song('Dancing Queen'), song('Valerie', 'Amy Winehouse')], NOW);
		await savePicks(db, helene.id, [song('Café del Mar', 'Energy 52'), song('Toxic', 'Britney Spears')], NOW);
		expect(await listSongs(db)).toHaveLength(4);
		expect((await listSongs(db, 'helene')).map((s) => s.title).sort()).toEqual(['Café del Mar', 'Toxic']);
		expect((await listSongs(db, 'cafe')).map((s) => s.guestName)).toEqual(['Hélène Dupont']);
		expect((await listSongs(db, 'winehouse')).map((s) => s.title)).toEqual(['Valerie']);
	});

	it('progress counts guests with 2 picks and lists the rest', async () => {
		const { db, amina, helene, eleni } = await setup();
		await savePicks(db, amina.id, [song('Dancing Queen'), song('Valerie', 'Amy Winehouse')], NOW);
		const p = await progress(db);
		expect(p.total).toBe(3);
		expect(p.done).toBe(1);
		expect(p.notYet.map((g) => g.id).sort()).toEqual([helene.id, eleni.id].sort());
	});
});
