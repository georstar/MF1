import { describe, expect, it } from 'vitest';
import { freshDb } from './helpers/d1';
import { addGuests, listGuests } from '../src/lib/server/guests';
import { savePicks, type PickInput } from '../src/lib/server/songs';

const GUESTS = 500;
const POPULAR = 40;
// The local test database drops connections beyond ~100-200 simultaneous requests,
// so in-flight requests are capped; guests still compete for the same songs.
const IN_FLIGHT = 100;

function limiter(max: number) {
	let active = 0;
	const queue: (() => void)[] = [];
	return async <T>(fn: () => Promise<T>): Promise<T> => {
		if (active >= max) await new Promise<void>((r) => queue.push(r));
		active++;
		try {
			return await fn();
		} finally {
			active--;
			queue.shift()?.();
		}
	};
}

// Like a real crowd: some popular songs everyone wants, mostly varied picks.
// After being told a song is taken, a guest sees "already on the list" in search
// and avoids it, so retries go to songs not yet on the list.
function crowdPick(retry: boolean): PickInput[] {
	const one = () =>
		!retry && Math.random() < 0.3 ? `Popular ${Math.floor(Math.random() * POPULAR)}` : `Song ${Math.floor(Math.random() * 50_000)}`;
	let a = one();
	let b = one();
	while (b === a) b = one();
	return [a, b].map((title) => ({ title, artist: 'Band', source: 'catalog' }));
}

describe('a crowd of 500 guests saving at the same moment', () => {
	it('keeps every rule and saves everyone who retries after a taken song', { timeout: 60_000 }, async () => {
		const db = await freshDb();
		await addGuests(db, Array.from({ length: GUESTS }, (_, i) => ({ firstName: `Guest${i}`, lastName: 'Crowd' })));
		const guests = await listGuests(db);
		const now = new Date('2027-06-01T12:00:00Z');
		const limit = limiter(IN_FLIGHT);

		const outcomes = await Promise.all(
			guests.map(async (g) => {
				for (let attempt = 0; attempt < 10; attempt++) {
					const r = await limit(() => savePicks(db, g.id, crowdPick(attempt > 0), now));
					if (r.ok) return 'saved';
					if (r.reason !== 'taken') return r.reason;
				}
				return 'gave up';
			})
		);

		expect(outcomes.filter((o) => o !== 'saved')).toEqual([]);
		const check = await db
			.prepare(
				`SELECT (SELECT count(*) FROM songs) AS songs, (SELECT count(DISTINCT song_key) FROM songs) AS distinct_songs,
				(SELECT max(c) FROM (SELECT count(*) c FROM songs GROUP BY guest_id)) AS max_per_guest,
				(SELECT min(c) FROM (SELECT count(*) c FROM songs GROUP BY guest_id)) AS min_per_guest`
			)
			.first<{ songs: number; distinct_songs: number; max_per_guest: number; min_per_guest: number }>();
		expect(check).toEqual({ songs: GUESTS * 2, distinct_songs: GUESTS * 2, max_per_guest: 2, min_per_guest: 2 });
	});
});
