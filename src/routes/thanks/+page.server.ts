import { redirect } from '@sveltejs/kit';
import { env } from '#lib/server/env.ts';
import { getCloseDate, isClosed } from '#lib/server/settings.ts';
import { picksOf, slotsLeft } from '#lib/server/songs.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const db = env.DB;
	if (!locals.guestId) redirect(303, '/');
	if ((await slotsLeft(db, locals.guestId)) > 0 && !isClosed(await getCloseDate(db), new Date())) redirect(303, '/pick');
	const picks = (await picksOf(db, locals.guestId)).map((p) => ({ id: p.id, title: p.title, artist: p.artist, artworkUrl: p.artworkUrl }));
	return { picks };
};
