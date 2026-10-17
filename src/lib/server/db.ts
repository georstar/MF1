export type { D1Database } from '@cloudflare/workers-types';

export type Guest = {
	id: number;
	firstName: string;
	lastName: string;
	label: string;
	picks: number;
};

export type GuestInput = { firstName: string; lastName: string; label?: string };

export type SongRow = {
	id: number;
	title: string;
	artist: string;
	artworkUrl: string | null;
	source: 'catalog' | 'typed';
	guestId: number;
	guestName: string;
	guestLabel: string;
	createdAt: string;
};
