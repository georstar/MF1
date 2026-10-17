import { fail, redirect } from '@sveltejs/kit';
import { env } from '#lib/server/env.ts';
import { getGuest } from '#lib/server/guests.ts';
import { getCloseDate, isClosed } from '#lib/server/settings.ts';
import { parsePicks, picksOf, savePicks, slotsLeft } from '#lib/server/songs.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const db = env.DB;
	if (!locals.guestId) redirect(303, '/');
	if (isClosed(await getCloseDate(db), new Date())) redirect(303, '/');
	const slots = await slotsLeft(db, locals.guestId);
	if (slots === 0) redirect(303, '/thanks');
	const guest = await getGuest(db, locals.guestId);
	const kept = (await picksOf(db, locals.guestId)).map((p) => ({ title: p.title, artist: p.artist }));
	return { firstName: guest!.firstName, slots, kept };
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const db = env.DB;
		if (!locals.guestId) redirect(303, '/');
		if (isClosed(await getCloseDate(db), new Date())) return fail(403, { error: 'closed' as const });
		const picks = parsePicks(String((await request.formData()).get('picks') ?? ''));
		if (!picks) return fail(400, { error: 'count' as const });
		const result = await savePicks(db, locals.guestId, picks, new Date());
		if (result.ok) redirect(303, '/thanks');
		if (result.reason === 'taken') return fail(409, { error: 'taken' as const, taken: result.taken.map((t) => t.title) });
		return fail(400, { error: result.reason === 'duplicate-in-request' ? ('duplicate' as const) : ('count' as const) });
	}
};
