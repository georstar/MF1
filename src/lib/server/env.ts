// Cloudflare bindings and secrets. adapter-cloudflare provides this module in
// production and emulates it (from wrangler.toml and .dev.vars) in `vite dev`.
import { env as bindings } from 'cloudflare:workers';
import type { D1Database } from './db';

export type Env = {
	DB: D1Database;
	BRIDE_PASSWORD: string;
	DJ_PASSWORD: string;
	SESSION_SECRET: string;
};

export const env = bindings as unknown as Env;
