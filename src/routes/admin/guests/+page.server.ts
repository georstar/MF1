import { fail } from '@sveltejs/kit';
import { requireRole } from '#lib/server/auth.ts';
import { parseGuestCsv } from '#lib/server/csv.ts';
import { env } from '#lib/server/env.ts';
import { addGuests, listGuests, removeGuest, updateGuest } from '#lib/server/guests.ts';
import { listSongs } from '#lib/server/songs.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireRole(locals, 'bride');
	const [guests, songs] = await Promise.all([listGuests(env.DB), listSongs(env.DB)]);
	const songsByGuest = new Map<number, string[]>();
	for (const s of songs) songsByGuest.set(s.guestId, [...(songsByGuest.get(s.guestId) ?? []), s.title]);
	return { guests: guests.map((g) => ({ ...g, songs: songsByGuest.get(g.id) ?? [] })) };
};

const MAX_UPLOAD_BYTES = 500_000;
const text = (data: FormData, key: string) => String(data.get(key) ?? '').trim().slice(0, 200);
const id = (data: FormData) => {
	const n = Number(data.get('guestId'));
	return Number.isSafeInteger(n) && n > 0 ? n : null;
};

export const actions: Actions = {
	upload: async ({ request, locals }) => {
		requireRole(locals, 'bride');
		const file = (await request.formData()).get('file');
		if (!(file instanceof File) || file.size === 0) return fail(400, { uploadError: 'Please choose a CSV file.' });
		if (file.size > MAX_UPLOAD_BYTES) return fail(400, { uploadError: 'That file is too big for a guest list.' });
		const { rows, errors } = parseGuestCsv(await file.text());
		const { added, skipped } = await addGuests(env.DB, rows);
		return { uploaded: { added, skipped, errors } };
	},
	add: async ({ request, locals }) => {
		requireRole(locals, 'bride');
		const data = await request.formData();
		const input = { firstName: text(data, 'firstName'), lastName: text(data, 'lastName'), label: text(data, 'label') };
		if (!input.firstName || !input.lastName) return fail(400, { addError: 'Please give both a first and a last name.' });
		const { added } = await addGuests(env.DB, [input]);
		return { message: added ? `Added ${input.firstName} ${input.lastName}.` : 'That guest is already on the list.' };
	},
	update: async ({ request, locals }) => {
		requireRole(locals, 'bride');
		const data = await request.formData();
		const guestId = id(data);
		const input = { firstName: text(data, 'firstName'), lastName: text(data, 'lastName'), label: text(data, 'label') };
		if (!guestId || !input.firstName || !input.lastName) return fail(400, { message: 'Please give both a first and a last name.' });
		await updateGuest(env.DB, guestId, input);
		return { message: 'Guest updated.' };
	},
	remove: async ({ request, locals }) => {
		requireRole(locals, 'bride');
		const guestId = id(await request.formData());
		if (!guestId) return fail(400, { message: 'Unknown guest.' });
		await removeGuest(env.DB, guestId);
		return { message: 'Guest removed.' };
	}
};
