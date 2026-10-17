import { requireRole } from '#lib/server/auth.ts';
import { GUEST_TEMPLATE_CSV } from '#lib/server/csv.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	requireRole(locals, 'any');
	return new Response(GUEST_TEMPLATE_CSV, {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': 'attachment; filename="guest-list-template.csv"'
		}
	});
};
