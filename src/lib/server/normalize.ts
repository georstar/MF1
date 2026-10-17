// Comparison keys: two names or songs that a person would call "the same"
// must produce the same key.
import { fold as base } from '../text';

export function nameKey(full: string): string {
	return base(full);
}

export function nameKeys(first: string, last: string): string[] {
	return [nameKey(`${first} ${last}`), nameKey(`${last} ${first}`)];
}

const KEEP = /\b(live|remix)\b/;

export function songKey(title: string, artist: string): string {
	const mainArtist = artist.split(/\s+(?:feat\.?|ft\.?|featuring)\s+/i)[0];

	// Split off "(...)", "[...]" and " - ..." segments. Keep only the fact that
	// a segment marks a live version or a remix; drop the rest (remasters, edits, features).
	const segments: string[] = [];
	const core = title
		.replace(/[([]([^)\]]*)[)\]]/g, (_, inner: string) => {
			segments.push(inner);
			return ' ';
		})
		.replace(/\s+-\s+(.*)$/, (_, rest: string) => {
			segments.push(rest);
			return ' ';
		});
	const tags = segments
		.map((s) => base(s).match(KEEP)?.[1])
		.filter((t): t is string => Boolean(t));

	return [base(core), ...tags].join(' ') + '|' + base(mainArtist);
}
