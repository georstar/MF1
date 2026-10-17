-- Remembered Apple search answers, so repeated searches don't hit Apple's rate limit.
CREATE TABLE search_cache (
	term TEXT PRIMARY KEY,
	results TEXT NOT NULL,
	fetched_at TEXT NOT NULL
);
