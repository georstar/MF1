import { songKey } from './normalize';

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

async function searchStore(term: string, country: string, fetchFn: typeof fetch): Promise<Track[]> {
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
		if (!res.ok) return [];
		// iTunes answers with content-type text/javascript, but the body is JSON.
		const body = (await res.json()) as { results?: Track[] };
		return body.results ?? [];
	} catch {
		return [];
	} finally {
		clearTimeout(timer);
	}
}

export async function searchSongs(term: string, fetchFn: typeof fetch): Promise<Omit<SearchResult, 'taken'>[]> {
	const q = term.trim();
	if (q.length < 2) return [];
	const perStore = await Promise.all(STORES.map((c) => searchStore(q, c, fetchFn)));
	const seen = new Set<string>();
	const out: Omit<SearchResult, 'taken'>[] = [];
	for (const t of perStore.flat()) {
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
	return out;
}
