import { requireRole } from '#lib/server/auth.ts';
import { songsToCsv } from '#lib/server/csv.ts';
import { env } from '#lib/server/env.ts';
import { listSongs } from '#lib/server/songs.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	requireRole(locals, 'any');
	return new Response(songsToCsv(await listSongs(env.DB)), {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': 'attachment; filename="maria-frank-songs.csv"',
			'cache-control': 'no-store'
		}
	});
};
