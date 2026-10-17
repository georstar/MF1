import { fail, redirect } from '@sveltejs/kit';
import { checkPassword, setAdminCookie } from '#lib/server/auth.ts';
import { env } from '#lib/server/env.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.role) redirect(303, '/admin');
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const password = String((await request.formData()).get('password') ?? '');
		const role = checkPassword(password, env);
		if (!role) return fail(400, { wrong: true });
		await setAdminCookie(cookies, role, env.SESSION_SECRET, url.protocol === 'https:');
		redirect(303, '/admin');
	}
};
