import { fail } from '@sveltejs/kit';
import QRCode from 'qrcode';
import { requireRole } from '#lib/server/auth.ts';
import { env } from '#lib/server/env.ts';
import { getCloseDate, setCloseDate } from '#lib/server/settings.ts';
import { listSongs, progress, removeSong, resetGuest } from '#lib/server/songs.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const role = requireRole(locals, 'any');
	const q = url.searchParams.get('q') ?? '';
	const [songs, prog, closeDate] = await Promise.all([listSongs(env.DB, q), progress(env.DB), getCloseDate(env.DB)]);
	const guestLink = `${url.origin}/`;
	const qrSvg = role === 'bride' ? await QRCode.toString(guestLink, { type: 'svg', margin: 2, color: { dark: '#1d1d1d', light: '#ffffff' } }) : null;
	return {
		q,
		songs,
		progress: { total: prog.total, done: prog.done, notYet: prog.notYet.map((g) => ({ id: g.id, name: `${g.firstName} ${g.lastName}`, label: g.label, picks: g.picks })) },
		closeDate,
		guestLink,
		qrSvg
	};
};

const id = (data: FormData, key: string) => {
	const n = Number(data.get(key));
	return Number.isSafeInteger(n) && n > 0 ? n : null;
};

export const actions: Actions = {
	removeSong: async ({ request, locals }) => {
		requireRole(locals, 'bride');
		const songId = id(await request.formData(), 'songId');
		if (!songId) return fail(400, { message: 'Unknown song.' });
		await removeSong(env.DB, songId);
		return { message: 'Song removed. That guest can now pick a replacement.' };
	},
	resetGuest: async ({ request, locals }) => {
		requireRole(locals, 'bride');
		const guestId = id(await request.formData(), 'guestId');
		if (!guestId) return fail(400, { message: 'Unknown guest.' });
		await resetGuest(env.DB, guestId);
		return { message: 'Guest reset. They can pick 2 songs again.' };
	},
	closeDate: async ({ request, locals }) => {
		requireRole(locals, 'bride');
		const date = String((await request.formData()).get('closeDate') ?? '');
		try {
			await setCloseDate(env.DB, date);
		} catch {
			return fail(400, { message: 'Please choose a valid date.' });
		}
		return { message: 'Closing date saved.' };
	}
};
