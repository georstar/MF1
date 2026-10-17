// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface Locals {
			role: 'bride' | 'dj' | null;
			guestId: number | null;
		}
	}
}

export {};
