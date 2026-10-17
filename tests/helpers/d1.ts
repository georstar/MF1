import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { afterAll } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';

const instances: Miniflare[] = [];
afterAll(async () => {
	await Promise.all(instances.splice(0).map((mf) => mf.dispose()));
});

// A fresh in-memory D1 with every migration applied.
export async function freshDb(): Promise<D1Database> {
	const mf = new Miniflare(
		convertV4MiniflareOptions({
			modules: true,
			script: 'export default { fetch() { return new Response(null) } }',
			d1Databases: ['DB']
		})
	);
	instances.push(mf);
	const db = (await mf.getD1Database('DB')) as unknown as D1Database;
	const dir = 'migrations';
	for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
		const statements = readFileSync(join(dir, file), 'utf8')
			.split(';')
			.map((s) => s.trim())
			.filter(Boolean);
		await db.batch(statements.map((s) => db.prepare(s)));
	}
	return db;
}
