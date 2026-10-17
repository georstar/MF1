import type { D1Database } from './db';
import { songKey } from './normalize';
import { fold } from '../text';

export type SearchResult = {
	title: string;
	artist: string;
	artworkUrl: string;
	itunesId: number;
	key: string;
	taken: boolean;
};

// Greek store first so local songs show up, US for broad international coverage.
const STORES = ['GR', 'US'];
const PER_STORE = 15;
const MAX_RESULTS = 20;
const TIMEOUT_MS = 4000;

type Track = { trackId: number; trackName: string; artistName: string; artworkUrl100?: string };

// null means the store didn't answer (error, refusal, timeout), as opposed to answering with no songs.
async function searchStore(term: string, country: string, fetchFn: typeof fetch): Promise<Track[] | null> {
	const url = `https://itunes.apple.com/search?${new URLSearchParams({ term, country, media: 'music', entity: 'song', limit: String(PER_STORE) })}`;
	const controller = new AbortController();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => {
			controller.abort();
			reject(new Error('timeout'));
		}, TIMEOUT_MS);
	});
	try {
		const res = await Promise.race([fetchFn(url, { signal: controller.signal }), timeout]);
		if (!res.ok) return null;
		// iTunes answers with content-type text/javascript, but the body is JSON.
		const body = (await res.json()) as { results?: Track[] };
		return body.results ?? [];
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}

export type Found = Omit<SearchResult, 'taken'>;

// complete: every store answered. unavailable: no store answered.
export async function searchSongs(term: string, fetchFn: typeof fetch): Promise<{ results: Found[]; complete: boolean; unavailable: boolean }> {
	const q = term.trim();
	if (q.length < 2) return { results: [], complete: true, unavailable: false };
	const perStore = await Promise.all(STORES.map((c) => searchStore(q, c, fetchFn)));
	const answered = perStore.filter((r): r is Track[] => r !== null);
	const seen = new Set<string>();
	const out: Found[] = [];
	for (const t of answered.flat()) {
		if (!t.trackName || !t.artistName) continue;
		const key = songKey(t.trackName, t.artistName);
		if (seen.has(key)) continue;
		seen.add(key);
		out.push({
			title: t.trackName,
			artist: t.artistName,
			artworkUrl: (t.artworkUrl100 ?? '').replace('100x100', '200x200'),
			itunesId: t.trackId,
			key
		});
		if (out.length === MAX_RESULTS) break;
	}
	return { results: out, complete: answered.length === STORES.length, unavailable: answered.length === 0 };
}

const CACHE_HOURS = 24;

// Answers repeated searches from the database for a day. When Apple refuses,
// an older remembered answer is better than nothing.
export async function searchCached(db: D1Database, term: string, fetchFn: typeof fetch, now: Date): Promise<{ results: Found[]; unavailable: boolean }> {
	const key = fold(term);
	if (key.length < 2) return { results: [], unavailable: false };
	const cached = await db.prepare('SELECT results, fetched_at FROM search_cache WHERE term = ?').bind(key).first<{ results: string; fetched_at: string }>();
	const fresh = cached && now.getTime() - Date.parse(cached.fetched_at) < CACHE_HOURS * 3600_000;
	if (cached && fresh) return { results: JSON.parse(cached.results) as Found[], unavailable: false };

	const live = await searchSongs(term, fetchFn);
	if (live.complete) {
		await db
			.prepare('INSERT INTO search_cache (term, results, fetched_at) VALUES (?1, ?2, ?3) ON CONFLICT (term) DO UPDATE SET results = ?2, fetched_at = ?3')
			.bind(key, JSON.stringify(live.results), now.toISOString())
			.run();
		return { results: live.results, unavailable: false };
	}
	if (cached) return { results: JSON.parse(cached.results) as Found[], unavailable: false };
	return { results: live.results, unavailable: live.unavailable };
}
