import { describe, expect, it } from 'vitest';
import { freshDb } from './helpers/d1';
import { searchCached } from '../src/lib/server/itunes';

const T0 = new Date('2027-05-01T10:00:00Z');
const later = (hours: number) => new Date(T0.getTime() + hours * 3600_000);

const body = (names: string[]) =>
	JSON.stringify({ results: names.map((n, i) => ({ trackId: i + 1, trackName: n, artistName: 'ABBA', artworkUrl100: 'https://is1.mzstatic.com/a/100x100bb.jpg' })) });

function apple(mode: { fail?: boolean; failGR?: boolean } = {}) {
	const state = { calls: 0, mode };
	const fn = (async (input: RequestInfo | URL) => {
		state.calls++;
		const country = new URL(String(input)).searchParams.get('country');
		if (state.mode.fail || (state.mode.failGR && country === 'GR')) return new Response('', { status: 403 });
		return new Response(body(['Dancing Queen', 'Mamma Mia']));
	}) as typeof fetch;
	return { fn, state };
}

describe('searchCached', () => {
	it('answers a repeated search without asking Apple again', async () => {
		const db = await freshDb();
		const { fn, state } = apple();
		const first = await searchCached(db, 'abba', fn, T0);
		const callsAfterFirst = state.calls;
		const second = await searchCached(db, 'abba', fn, later(1));
		expect(state.calls).toBe(callsAfterFirst);
		expect(second).toEqual(first);
		expect(second.results.map((r) => r.title)).toEqual(['Dancing Queen', 'Mamma Mia']);
	});

	it('treats case, accents and spaces as the same search', async () => {
		const db = await freshDb();
		const { fn, state } = apple();
		await searchCached(db, 'Abbá', fn, T0);
		const calls = state.calls;
		await searchCached(db, '  abba ', fn, later(1));
		expect(state.calls).toBe(calls);
	});

	it('asks Apple again after 24 hours', async () => {
		const db = await freshDb();
		const { fn, state } = apple();
		await searchCached(db, 'abba', fn, T0);
		const calls = state.calls;
		await searchCached(db, 'abba', fn, later(25));
		expect(state.calls).toBeGreaterThan(calls);
	});

	it('does not remember a half answer', async () => {
		const db = await freshDb();
		const { fn, state } = apple({ failGR: true });
		await searchCached(db, 'abba', fn, T0);
		state.mode = {};
		const calls = state.calls;
		await searchCached(db, 'abba', fn, later(1));
		expect(state.calls).toBeGreaterThan(calls);
	});

	it('falls back to an older answer when Apple refuses', async () => {
		const db = await freshDb();
		const { fn, state } = apple();
		await searchCached(db, 'abba', fn, T0);
		state.mode = { fail: true };
		const r = await searchCached(db, 'abba', fn, later(48));
		expect(r.unavailable).toBe(false);
		expect(r.results).toHaveLength(2);
	});

	it('says search is unavailable when Apple refuses and nothing is remembered', async () => {
		const db = await freshDb();
		const { fn } = apple({ fail: true });
		expect(await searchCached(db, 'abba', fn, T0)).toEqual({ results: [], unavailable: true });
	});
});
