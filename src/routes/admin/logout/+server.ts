import { redirect } from '@sveltejs/kit';
import { clearAdminCookie } from '#lib/server/auth.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
	clearAdminCookie(cookies);
	redirect(303, '/admin/login');
};
