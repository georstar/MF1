import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchSongs } from '../src/lib/server/itunes';

type Track = { trackId: number; trackName: string; artistName: string; artworkUrl100: string };
const track = (trackId: number, trackName: string, artistName: string): Track => ({
	trackId,
	trackName,
	artistName,
	artworkUrl100: `https://is1.mzstatic.com/image/${trackId}/100x100bb.jpg`
});
const ok = (results: Track[]) => new Response(JSON.stringify({ resultCount: results.length, results }), { headers: { 'content-type': 'text/javascript' } });
const country = (url: string) => new URL(url).searchParams.get('country');

function stub(by: Record<string, () => Promise<Response>>) {
	const calls: string[] = [];
	const fn = (async (input: RequestInfo | URL) => {
		const url = String(input);
		calls.push(url);
		return by[country(url) ?? '']();
	}) as typeof fetch;
	return { fn, calls };
}

afterEach(() => vi.useRealTimers());

describe('searchSongs', () => {
	it('queries GR then US and merges without duplicates', async () => {
		const { fn, calls } = stub({
			GR: async () => ok([track(1, 'Zorba the Greek', 'Mikis Theodorakis'), track(2, 'Dancing Queen', 'ABBA')]),
			US: async () => ok([track(3, 'Dancing Queen', 'ABBA'), track(4, 'Mamma Mia', 'ABBA')])
		});
		const results = await searchSongs('abba', fn);
		expect(calls.map(country).sort()).toEqual(['GR', 'US']);
		expect(results.map((r) => r.title)).toEqual(['Zorba the Greek', 'Dancing Queen', 'Mamma Mia']);
		expect(results[1].itunesId).toBe(2);
	});

	it('still returns US results when GR fails', async () => {
		const { fn } = stub({
			GR: async () => new Response('oops', { status: 500 }),
			US: async () => ok([track(4, 'Mamma Mia', 'ABBA')])
		});
		expect((await searchSongs('mamma', fn)).map((r) => r.title)).toEqual(['Mamma Mia']);
	});

	it('still returns GR results when US throws', async () => {
		const { fn } = stub({
			GR: async () => ok([track(1, 'Zorba the Greek', 'Mikis Theodorakis')]),
			US: async () => {
				throw new Error('network');
			}
		});
		expect(await searchSongs('zorba', fn)).toHaveLength(1);
	});

	it('returns [] without fetching for terms under 2 characters', async () => {
		const { fn, calls } = stub({});
		expect(await searchSongs(' a ', fn)).toEqual([]);
		expect(calls).toEqual([]);
	});

	it('caps results at 20 and upscales artwork to 200x200', async () => {
		const many = Array.from({ length: 15 }, (_, i) => track(i, `Song ${i}`, 'Artist'));
		const more = Array.from({ length: 15 }, (_, i) => track(100 + i, `Other ${i}`, 'Artist'));
		const { fn } = stub({ GR: async () => ok(many), US: async () => ok(more) });
		const results = await searchSongs('song', fn);
		expect(results).toHaveLength(20);
		expect(results[0].artworkUrl).toContain('200x200');
		expect(results[0].key).toBe('song 0|artist');
	});

	it('times out a store after 4 seconds', async () => {
		vi.useFakeTimers();
		const { fn } = stub({
			GR: (() => new Promise<Response>(() => {})) as () => Promise<Response>,
			US: async () => ok([track(4, 'Mamma Mia', 'ABBA')])
		});
		const pending = searchSongs('mamma', fn);
		await vi.advanceTimersByTimeAsync(4001);
		expect((await pending).map((r) => r.title)).toEqual(['Mamma Mia']);
	});
});
