import { describe, expect, it } from 'vitest';
import { parsePicks } from '../src/lib/server/songs';

describe('parsePicks', () => {
	it('accepts catalogue and typed picks', () => {
		const json = JSON.stringify([
			{ title: 'Dancing Queen', artist: 'ABBA', source: 'catalog', itunesId: 123, artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/a/200x200bb.jpg' },
			{ title: 'Misirlou', artist: 'Dick Dale', source: 'typed' }
		]);
		expect(parsePicks(json)).toEqual([
			{ title: 'Dancing Queen', artist: 'ABBA', source: 'catalog', itunesId: 123, artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/a/200x200bb.jpg' },
			{ title: 'Misirlou', artist: 'Dick Dale', source: 'typed' }
		]);
	});
	it('drops artwork that is not from Apple', () => {
		const [pick] = parsePicks(JSON.stringify([{ title: 'A', artist: 'B', source: 'catalog', artworkUrl: 'https://evil.example/x.jpg' }]))!;
		expect(pick.artworkUrl).toBeUndefined();
	});
	it('rejects malformed input', () => {
		expect(parsePicks('not json')).toBeNull();
		expect(parsePicks('{}')).toBeNull();
		expect(parsePicks(JSON.stringify([{ title: 'A', artist: 'B', source: 'other' }]))).toBeNull();
		expect(parsePicks(JSON.stringify([{ title: 5, artist: 'B', source: 'typed' }]))).toBeNull();
		expect(parsePicks(JSON.stringify([{ title: 'x'.repeat(201), artist: 'B', source: 'typed' }]))).toBeNull();
		expect(parsePicks(JSON.stringify([1, 2, 3, 4, 5]))).toBeNull();
	});
});
