import type { D1Database, Guest, SongRow } from './db';
import { listGuests } from './guests';
import { nameKey, songKey } from './normalize';

export const PICKS_PER_GUEST = 2;

export type PickInput = {
	title: string;
	artist: string;
	artworkUrl?: string;
	itunesId?: number;
	source: 'catalog' | 'typed';
};

export type SaveResult =
	| { ok: true }
	| { ok: false; reason: 'wrong-count' | 'duplicate-in-request' }
	| { ok: false; reason: 'taken'; taken: PickInput[] };

const SELECT = `SELECT s.id, s.title, s.artist, s.artwork_url AS artworkUrl, s.source, s.guest_id AS guestId,
	g.first_name || ' ' || g.last_name AS guestName, g.label AS guestLabel, s.created_at AS createdAt
	FROM songs s JOIN guests g ON g.id = s.guest_id`;

export async function picksOf(db: D1Database, guestId: number): Promise<SongRow[]> {
	const { results } = await db.prepare(`${SELECT} WHERE s.guest_id = ? ORDER BY s.id`).bind(guestId).all<SongRow>();
	return results;
}

export async function slotsLeft(db: D1Database, guestId: number): Promise<number> {
	const row = await db.prepare('SELECT count(*) AS n FROM songs WHERE guest_id = ?').bind(guestId).first<{ n: number }>();
	return Math.max(0, PICKS_PER_GUEST - (row?.n ?? 0));
}

export async function takenKeys(db: D1Database, keys: string[]): Promise<Set<string>> {
	if (!keys.length) return new Set();
	const marks = keys.map(() => '?').join(',');
	const { results } = await db.prepare(`SELECT song_key FROM songs WHERE song_key IN (${marks})`).bind(...keys).all<{ song_key: string }>();
	return new Set(results.map((r) => r.song_key));
}

// Saves all picks or none. The UNIQUE song_key and the pick-limit trigger make
// the database the final judge when two saves race.
export async function savePicks(db: D1Database, guestId: number, picks: PickInput[], now: Date): Promise<SaveResult> {
	const clean = picks.map((p) => ({ ...p, title: p.title.trim(), artist: p.artist.trim() }));
	if (!clean.length || clean.some((p) => !p.title || !p.artist)) return { ok: false, reason: 'wrong-count' };
	if (clean.length !== (await slotsLeft(db, guestId))) return { ok: false, reason: 'wrong-count' };

	const keys = clean.map((p) => songKey(p.title, p.artist));
	if (new Set(keys).size !== keys.length) return { ok: false, reason: 'duplicate-in-request' };

	const at = now.toISOString();
	try {
		await db.batch(
			clean.map((p, i) =>
				db
					.prepare('INSERT INTO songs (guest_id, title, artist, artwork_url, itunes_id, source, song_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
					.bind(guestId, p.title, p.artist, p.artworkUrl ?? null, p.itunesId ?? null, p.source, keys[i], at)
			)
		);
		return { ok: true };
	} catch (err) {
		const message = String((err as Error)?.message ?? err);
		if (message.includes('pick limit')) return { ok: false, reason: 'wrong-count' };
		if (!message.includes('UNIQUE')) throw err;
		const taken = await takenKeys(db, keys);
		return { ok: false, reason: 'taken', taken: picks.filter((_, i) => taken.has(keys[i])) };
	}
}

export async function listSongs(db: D1Database, query?: string): Promise<SongRow[]> {
	const { results } = await db.prepare(`${SELECT} ORDER BY s.created_at DESC, s.id DESC`).all<SongRow>();
	const q = query ? nameKey(query) : '';
	if (!q) return results;
	return results.filter((s) => nameKey(`${s.title} ${s.artist} ${s.guestName} ${s.guestLabel}`).includes(q));
}

export async function removeSong(db: D1Database, songId: number): Promise<void> {
	await db.prepare('DELETE FROM songs WHERE id = ?').bind(songId).run();
}

export async function resetGuest(db: D1Database, guestId: number): Promise<void> {
	await db.prepare('DELETE FROM songs WHERE guest_id = ?').bind(guestId).run();
}

export async function progress(db: D1Database): Promise<{ total: number; done: number; notYet: Guest[] }> {
	const guests = await listGuests(db);
	const notYet = guests.filter((g) => g.picks < PICKS_PER_GUEST);
	return { total: guests.length, done: guests.length - notYet.length, notYet };
}

const MAX_TEXT = 200;
const APPLE_ART = /^https:\/\/[a-z0-9-]+\.mzstatic\.com\//;

// Validates the picks a guest's browser sends. Returns null for anything malformed.
export function parsePicks(json: string): PickInput[] | null {
	let data: unknown;
	try {
		data = JSON.parse(json);
	} catch {
		return null;
	}
	if (!Array.isArray(data) || data.length > PICKS_PER_GUEST) return null;
	const picks: PickInput[] = [];
	for (const item of data) {
		if (typeof item !== 'object' || item === null) return null;
		const { title, artist, source, itunesId, artworkUrl } = item as Record<string, unknown>;
		if (typeof title !== 'string' || typeof artist !== 'string') return null;
		if (title.length > MAX_TEXT || artist.length > MAX_TEXT) return null;
		if (source !== 'catalog' && source !== 'typed') return null;
		const pick: PickInput = { title, artist, source };
		if (source === 'catalog' && Number.isSafeInteger(itunesId)) pick.itunesId = itunesId as number;
		if (source === 'catalog' && typeof artworkUrl === 'string' && APPLE_ART.test(artworkUrl)) pick.artworkUrl = artworkUrl;
		picks.push(pick);
	}
	return picks;
}
