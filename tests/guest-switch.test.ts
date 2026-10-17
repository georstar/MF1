import { describe, expect, it, vi } from 'vitest';
import { isRedirect } from '@sveltejs/kit';

vi.mock('cloudflare:workers', () => ({ env: {} }));
const { actions } = await import('../src/routes/+page.server');

describe('picking for someone else on the same phone', () => {
	it('forgets the current guest and goes back to the name step', async () => {
		const deleted: string[] = [];
		const cookies = { delete: (name: string) => deleted.push(name) };
		let thrown: unknown;
		try {
			await actions.forget({ cookies } as never);
		} catch (e) {
			thrown = e;
		}
		expect(deleted).toEqual(['mf_guest']);
		expect(isRedirect(thrown) && thrown.location).toBe('/?step=name');
	});
});
