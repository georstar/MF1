import { requireRole } from '#lib/server/auth.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (url.pathname === '/admin/login') return { role: locals.role };
	return { role: requireRole(locals, 'any') };
};
