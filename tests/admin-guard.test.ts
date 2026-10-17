import { describe, expect, it } from 'vitest';
import { isHttpError, isRedirect } from '@sveltejs/kit';
import { requireRole } from '../src/lib/server/auth';

const catchIt = (fn: () => unknown) => {
	try {
		fn();
	} catch (e) {
		return e;
	}
	return null;
};

describe('requireRole', () => {
	it('sends a logged-out visitor to the login page', () => {
		const e = catchIt(() => requireRole({ role: null, guestId: null }, 'any'));
		expect(isRedirect(e) && e.location).toBe('/admin/login');
	});
	it('forbids the DJ from bride-only actions', () => {
		const e = catchIt(() => requireRole({ role: 'dj', guestId: null }, 'bride'));
		expect(isHttpError(e) && e.status).toBe(403);
	});
	it('lets the DJ view', () => {
		expect(requireRole({ role: 'dj', guestId: null }, 'any')).toBe('dj');
	});
	it('lets the bride do anything', () => {
		expect(requireRole({ role: 'bride', guestId: null }, 'bride')).toBe('bride');
	});
});
