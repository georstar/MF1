import { describe, expect, it } from 'vitest';
import { freshDb } from './helpers/d1';
import { addGuests, listGuests } from '../src/lib/server/guests';
import { changePicks, parseChange, picksOf, savePicks, type PickInput } from '../src/lib/server/songs';

const NOW = new Date('2027-06-01T12:00:00Z');
const song = (title: string, artist = 'ABBA'): PickInput => ({ title, artist, source: 'catalog' });

async function setup() {
	const db = await freshDb();
	await addGuests(db, [
		{ firstName: 'Amina', lastName: 'Diallo' },
		{ firstName: 'Eleni', lastName: 'Georgiou' }
	]);
	const [amina, eleni] = await listGuests(db);
	await savePicks(db, amina.id, [song('Dancing Queen'), song('Valerie', 'Amy Winehouse')], NOW);
	const [queen, valerie] = await picksOf(db, amina.id);
	return { db, amina, eleni, queen, valerie };
}
const titles = async (db: Awaited<ReturnType<typeof setup>>['db'], id: number) => (await picksOf(db, id)).map((p) => p.title).sort();

describe('changePicks', () => {
	it('changes one song and keeps the other', async () => {
		const { db, amina, queen } = await setup();
		expect(await changePicks(db, amina.id, [queen.id], [song('Mamma Mia')], NOW)).toEqual({ ok: true });
		expect(await titles(db, amina.id)).toEqual(['Dancing Queen', 'Mamma Mia']);
	});

	it('changes both songs', async () => {
		const { db, amina } = await setup();
		expect(await changePicks(db, amina.id, [], [song('Mamma Mia'), song('SOS')], NOW)).toEqual({ ok: true });
		expect(await titles(db, amina.id)).toEqual(['Mamma Mia', 'SOS']);
	});

	it('a taken new song changes nothing', async () => {
		const { db, amina, eleni, queen } = await setup();
		await savePicks(db, eleni.id, [song('Mamma Mia'), song('Zorba', 'Theodorakis')], NOW);
		const result = await changePicks(db, amina.id, [queen.id], [song('Mamma Mia')], NOW);
		expect(result).toEqual({ ok: false, reason: 'taken', taken: [song('Mamma Mia')] });
		expect(await titles(db, amina.id)).toEqual(['Dancing Queen', 'Valerie']);
	});

	it('a released song is free for other guests', async () => {
		const { db, amina, eleni, queen } = await setup();
		await changePicks(db, amina.id, [queen.id], [song('Mamma Mia')], NOW);
		expect(await savePicks(db, eleni.id, [song('Valerie', 'Amy Winehouse'), song('Zorba', 'Theodorakis')], NOW)).toEqual({ ok: true });
	});

	it('can take back a song they were giving up', async () => {
		const { db, amina } = await setup();
		expect(await changePicks(db, amina.id, [], [song('Dancing Queen'), song('SOS')], NOW)).toEqual({ ok: true });
		expect(await titles(db, amina.id)).toEqual(['Dancing Queen', 'SOS']);
	});

	it('must end with exactly two songs', async () => {
		const { db, amina, queen } = await setup();
		expect(await changePicks(db, amina.id, [queen.id], [], NOW)).toEqual({ ok: false, reason: 'wrong-count' });
		expect(await changePicks(db, amina.id, [queen.id], [song('A'), song('B')], NOW)).toEqual({ ok: false, reason: 'wrong-count' });
	});

	it("cannot keep another guest's song", async () => {
		const { db, eleni, queen } = await setup();
		expect(await changePicks(db, eleni.id, [queen.id], [song('Mamma Mia')], NOW)).toEqual({ ok: false, reason: 'wrong-count' });
	});

	it('rejects a new song that duplicates the kept one', async () => {
		const { db, amina, queen } = await setup();
		expect(await changePicks(db, amina.id, [queen.id], [song('Dancing Queen (Remastered)')], NOW)).toEqual({ ok: false, reason: 'duplicate-in-request' });
	});
});

describe('parseChange', () => {
	it('reads kept ids and new picks', () => {
		expect(parseChange(JSON.stringify({ keep: [3], picks: [{ title: 'A', artist: 'B', source: 'typed' }] }))).toEqual({
			keep: [3],
			picks: [{ title: 'A', artist: 'B', source: 'typed' }]
		});
	});
	it('rejects malformed input', () => {
		expect(parseChange('[]')).toBeNull();
		expect(parseChange(JSON.stringify({ keep: ['x'], picks: [] }))).toBeNull();
		expect(parseChange(JSON.stringify({ keep: [1, 2, 3], picks: [] }))).toBeNull();
		expect(parseChange(JSON.stringify({ keep: [], picks: [{ title: 'A', artist: 'B', source: 'nope' }] }))).toBeNull();
	});
});
