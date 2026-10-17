// Lowercase, accent-free, punctuation-free text for comparing what people type.
// Shared by the server (keys, search) and the browser (live filtering).

// Latin letters that are not "base letter + accent", so NFD can't strip them.
const LETTERS: Record<string, string> = { ø: 'o', ß: 'ss', æ: 'ae', œ: 'oe', ł: 'l', đ: 'd', ð: 'd', þ: 'th', ı: 'i' };

export function fold(text: string): string {
	return text
		.toLowerCase()
		.replace(/[øßæœłđðþı]/g, (c) => LETTERS[c])
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.replace(/['’ʼ`]/g, '')
		.replace(/&/g, ' and ')
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim();
}
