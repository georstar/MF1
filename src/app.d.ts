// See https://svelte.dev/docs/kit/types#app.d.ts
import type { D1Database } from '@cloudflare/workers-types';

declare global {
	namespace App {
		interface Locals {
			role: 'bride' | 'dj' | null;
			guestId: number | null;
		}
		interface Platform {
			env: {
				DB: D1Database;
				BRIDE_PASSWORD: string;
				DJ_PASSWORD: string;
				SESSION_SECRET: string;
			};
		}
	}
}

export {};
