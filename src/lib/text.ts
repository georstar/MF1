// Lowercase, accent-free, punctuation-free text for comparing what people type.
// Shared by the server (keys, search) and the browser (live filtering).
export function fold(text: string): string {
	return text
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/&/g, ' and ')
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim();
}
