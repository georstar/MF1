import { fail, redirect } from '@sveltejs/kit';
import { env } from '#lib/server/env.ts';
import { getGuest } from '#lib/server/guests.ts';
import { songKey } from '#lib/server/normalize.ts';
import { getCloseDate, isClosed } from '#lib/server/settings.ts';
import { changePicks, parseChange, picksOf } from '#lib/server/songs.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const db = env.DB;
	if (!locals.guestId) redirect(303, '/');
	if (isClosed(await getCloseDate(db), new Date())) redirect(303, '/');
	const current = (await picksOf(db, locals.guestId)).map((p) => ({
		id: p.id,
		title: p.title,
		artist: p.artist,
		artworkUrl: p.artworkUrl ?? undefined,
		source: p.source,
		key: songKey(p.title, p.artist)
	}));
	// A guest with both songs only gets here on purpose, from "Change my songs".
	if (current.length === 2 && !url.searchParams.has('change')) redirect(303, '/thanks');
	const guest = await getGuest(db, locals.guestId);
	return { firstName: guest!.firstName, current };
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const db = env.DB;
		if (!locals.guestId) redirect(303, '/');
		if (isClosed(await getCloseDate(db), new Date())) return fail(403, { error: 'closed' as const });
		const change = parseChange(String((await request.formData()).get('change') ?? ''));
		if (!change) return fail(400, { error: 'count' as const });
		const result = await changePicks(db, locals.guestId, change.keep, change.picks, new Date());
		if (result.ok) redirect(303, '/thanks');
		if (result.reason === 'taken') return fail(409, { error: 'taken' as const, taken: result.taken.map((t) => t.title) });
		if (result.reason === 'busy') return fail(503, { error: 'busy' as const });
		return fail(400, { error: result.reason === 'duplicate-in-request' ? ('duplicate' as const) : ('count' as const) });
	}
};
