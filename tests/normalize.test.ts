import { describe, expect, it } from 'vitest';
import { nameKey, nameKeys, songKey } from '../src/lib/server/normalize';

describe('nameKey', () => {
	it('ignores case, accents and extra spaces', () => {
		expect(nameKey('  Hélène   DUPONT ')).toBe('helene dupont');
	});
	it('treats hyphens as spaces', () => {
		expect(nameKey('Jean-Luc Picard')).toBe('jean luc picard');
	});
	it('gives both name orders', () => {
		expect(nameKeys('Maria', 'Papadopoulou')).toEqual(['maria papadopoulou', 'papadopoulou maria']);
	});
});

describe('songKey', () => {
	it('ignores remaster tags', () => {
		expect(songKey('Dancing Queen', 'ABBA')).toBe(songKey('Dancing Queen (Remastered 2011)', 'ABBA'));
	});
	it('ignores radio edits and featured artists', () => {
		expect(songKey('Get Lucky - Radio Edit', 'Daft Punk feat. Pharrell Williams')).toBe(songKey('Get Lucky', 'Daft Punk'));
	});
	it('ignores featured artists in the title', () => {
		expect(songKey('Let It Be (feat. X)', 'The Beatles')).toBe(songKey('Let It Be', 'The Beatles'));
	});
	it('keeps live versions distinct', () => {
		expect(songKey('September (Live)', 'Earth, Wind & Fire')).not.toBe(songKey('September', 'Earth, Wind & Fire'));
	});
	it('keeps remixes distinct', () => {
		expect(songKey('Titanium (David Guetta Remix)', 'Sia')).not.toBe(songKey('Titanium', 'Sia'));
	});
	it('ignores case and accents', () => {
		expect(songKey('Café', 'Zoé')).toBe(songKey('cafe', 'ZOE'));
	});
});
