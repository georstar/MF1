import { describe, expect, it } from 'vitest';
import { checkPassword, sign, verify } from '../src/lib/server/auth';

const SECRET = 'test-secret-0123456789';
const env = { BRIDE_PASSWORD: 'bride-pass', DJ_PASSWORD: 'dj-pass' };

describe('signed values', () => {
	it('round-trips', async () => {
		expect(await verify(await sign('42', SECRET), SECRET)).toBe('42');
	});
	it('rejects a tampered value', async () => {
		const token = await sign('42', SECRET);
		expect(await verify(token.replace(/^42/, '43'), SECRET)).toBeNull();
	});
	it('rejects the wrong secret', async () => {
		expect(await verify(await sign('42', SECRET), 'other-secret')).toBeNull();
	});
	it('rejects garbage', async () => {
		expect(await verify('', SECRET)).toBeNull();
		expect(await verify('no-dot', SECRET)).toBeNull();
	});
});

describe('checkPassword', () => {
	it('maps passwords to roles', () => {
		expect(checkPassword('bride-pass', env)).toBe('bride');
		expect(checkPassword('dj-pass', env)).toBe('dj');
	});
	it('rejects anything else', () => {
		expect(checkPassword('', env)).toBeNull();
		expect(checkPassword('Bride-pass', env)).toBeNull();
		expect(checkPassword('', { BRIDE_PASSWORD: '', DJ_PASSWORD: '' })).toBeNull();
	});
});
