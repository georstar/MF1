import { error, json } from '@sveltejs/kit';
import { searchSongs, type SearchResult } from '#lib/server/itunes.ts';
import { takenKeys } from '#lib/server/songs.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals, platform, fetch }) => {
	if (!locals.guestId) error(401, 'Tell us who you are first.');
	const db = platform!.env.DB;
	const found = await searchSongs(url.searchParams.get('q') ?? '', fetch);
	const taken = await takenKeys(db, found.map((r) => r.key));
	const results: SearchResult[] = found.map((r) => ({ ...r, taken: taken.has(r.key) }));
	return json({ results }, { headers: { 'cache-control': 'no-store' } });
};
