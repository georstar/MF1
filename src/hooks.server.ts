import type { Handle } from '@sveltejs/kit/hooks';
import { readAdminCookie, readGuestCookie } from '#lib/server/auth.ts';
import { getGuest } from '#lib/server/guests.ts';

export const handle: Handle = async ({ event, resolve }) => {
	const env = event.platform?.env;
	event.locals.role = null;
	event.locals.guestId = null;
	if (env?.SESSION_SECRET) {
		event.locals.role = await readAdminCookie(event.cookies, env.SESSION_SECRET);
		const guestId = await readGuestCookie(event.cookies, env.SESSION_SECRET);
		// The bride may have removed this guest since the cookie was set.
		if (guestId && (await getGuest(env.DB, guestId))) event.locals.guestId = guestId;
	}
	return resolve(event);
};
