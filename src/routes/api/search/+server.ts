import { error, json } from '@sveltejs/kit';
import { env } from '#lib/server/env.ts';
import { searchCached, type SearchResult } from '#lib/server/itunes.ts';
import { takenKeys } from '#lib/server/songs.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals, fetch }) => {
	if (!locals.guestId) error(401, 'Tell us who you are first.');
	const db = env.DB;
	const { results: found, unavailable } = await searchCached(db, url.searchParams.get('q') ?? '', fetch, new Date());
	// "Taken" is always checked live; only Apple's answer is remembered.
	const taken = await takenKeys(db, found.map((r) => r.key));
	const results: SearchResult[] = found.map((r) => ({ ...r, taken: taken.has(r.key) }));
	return json({ results, unavailable }, { headers: { 'cache-control': 'no-store' } });
};
