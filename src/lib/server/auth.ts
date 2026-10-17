import { error, redirect, type Cookies } from '@sveltejs/kit';

export type Role = 'bride' | 'dj';

const encoder = new TextEncoder();

async function hmac(value: string, secret: string): Promise<string> {
	const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
	return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function safeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

export async function sign(value: string, secret: string): Promise<string> {
	return `${value}.${await hmac(value, secret)}`;
}

export async function verify(token: string, secret: string): Promise<string | null> {
	const dot = token.lastIndexOf('.');
	if (dot <= 0) return null;
	const value = token.slice(0, dot);
	return safeEqual(token.slice(dot + 1), await hmac(value, secret)) ? value : null;
}

export function checkPassword(input: string, env: { BRIDE_PASSWORD: string; DJ_PASSWORD: string }): Role | null {
	if (!input) return null;
	if (env.BRIDE_PASSWORD && safeEqual(input, env.BRIDE_PASSWORD)) return 'bride';
	if (env.DJ_PASSWORD && safeEqual(input, env.DJ_PASSWORD)) return 'dj';
	return null;
}

const GUEST_COOKIE = 'mf_guest';
const ADMIN_COOKIE = 'mf_admin';
const DAY = 24 * 60 * 60;
const ADMIN_DAYS = 30;

const options = (secure: boolean, maxAge: number) => ({ path: '/', httpOnly: true, sameSite: 'lax' as const, secure, maxAge });

export async function setGuestCookie(cookies: Cookies, guestId: number, secret: string, secure: boolean): Promise<void> {
	cookies.set(GUEST_COOKIE, await sign(String(guestId), secret), options(secure, 400 * DAY));
}

export async function readGuestCookie(cookies: Cookies, secret: string): Promise<number | null> {
	const value = await verify(cookies.get(GUEST_COOKIE) ?? '', secret);
	return value && /^\d+$/.test(value) ? Number(value) : null;
}

export async function setAdminCookie(cookies: Cookies, role: Role, secret: string, secure: boolean, now = Date.now()): Promise<void> {
	const expires = Math.floor(now / 1000) + ADMIN_DAYS * DAY;
	cookies.set(ADMIN_COOKIE, await sign(`${role}:${expires}`, secret), options(secure, ADMIN_DAYS * DAY));
}

export async function readAdminCookie(cookies: Cookies, secret: string, now = Date.now()): Promise<Role | null> {
	const value = await verify(cookies.get(ADMIN_COOKIE) ?? '', secret);
	const match = value?.match(/^(bride|dj):(\d+)$/);
	if (!match || Number(match[2]) * 1000 < now) return null;
	return match[1] as Role;
}

export function clearAdminCookie(cookies: Cookies): void {
	cookies.delete(ADMIN_COOKIE, { path: '/' });
}

// Guards for the bride & DJ pages: 'any' = bride or DJ, 'bride' = bride only.
export function requireRole(locals: App.Locals, needed: 'any' | 'bride'): Role {
	if (!locals.role) redirect(303, '/admin/login');
	if (needed === 'bride' && locals.role !== 'bride') error(403, 'Only the bride can do that.');
	return locals.role;
}
