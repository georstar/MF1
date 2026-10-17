import { fail, redirect } from '@sveltejs/kit';
import { env, type Env } from '#lib/server/env.ts';
import { setGuestCookie } from '#lib/server/auth.ts';
import { findGuests } from '#lib/server/guests.ts';
import { getCloseDate, isClosed } from '#lib/server/settings.ts';
import { slotsLeft } from '#lib/server/songs.ts';
import type { Guest } from '#lib/server/db.ts';
import type { Actions, PageServerLoad } from './$types';

const display = (g: Guest) => (g.label ? `${g.firstName} ${g.lastName} (${g.label})` : `${g.firstName} ${g.lastName}`);

async function nextPage(db: Env['DB'], guestId: number) {
	return (await slotsLeft(db, guestId)) > 0 ? '/pick' : '/thanks';
}

export const load: PageServerLoad = async ({ locals }) => {
	const db = env.DB;
	const closed = isClosed(await getCloseDate(db), new Date());
	const next = locals.guestId ? await nextPage(db, locals.guestId) : null;
	return { closed, next };
};

async function signIn(guestId: number, { cookies, url }: Parameters<Actions[string]>[0]) {
		await setGuestCookie(cookies, guestId, env.SESSION_SECRET, url.protocol === 'https:');
	redirect(303, await nextPage(env.DB, guestId));
}

export const actions: Actions = {
	name: async (event) => {
		const db = env.DB;
		if (isClosed(await getCloseDate(db), new Date())) return fail(403, { closed: true });
		const name = String((await event.request.formData()).get('name') ?? '').slice(0, 200);
		const guests = await findGuests(db, name);
		if (guests.length === 0) return fail(400, { name, notFound: true });
		if (guests.length === 1) return signIn(guests[0].id, event);
		return { name, choices: guests.map((g) => ({ id: g.id, label: display(g) })) };
	},
	choose: async (event) => {
		const db = env.DB;
		if (isClosed(await getCloseDate(db), new Date())) return fail(403, { closed: true });
		const data = await event.request.formData();
		const name = String(data.get('name') ?? '').slice(0, 200);
		const id = Number(data.get('guestId'));
		// Only someone who typed this name may pick one of its matches.
		const guest = (await findGuests(db, name)).find((g) => g.id === id);
		if (!guest) return fail(400, { name, notFound: true });
		return signIn(guest.id, event);
	}
};
