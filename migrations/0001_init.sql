CREATE TABLE guests (
	id INTEGER PRIMARY KEY,
	first_name TEXT NOT NULL,
	last_name TEXT NOT NULL,
	label TEXT NOT NULL DEFAULT '',
	key_a TEXT NOT NULL,
	key_b TEXT NOT NULL,
	created_at TEXT NOT NULL
);
CREATE INDEX guests_key_a ON guests (key_a);
CREATE INDEX guests_key_b ON guests (key_b);

CREATE TABLE songs (
	id INTEGER PRIMARY KEY,
	guest_id INTEGER NOT NULL REFERENCES guests (id) ON DELETE CASCADE,
	title TEXT NOT NULL,
	artist TEXT NOT NULL,
	artwork_url TEXT,
	itunes_id INTEGER,
	source TEXT NOT NULL CHECK (source IN ('catalog', 'typed')),
	song_key TEXT NOT NULL UNIQUE,
	created_at TEXT NOT NULL
);
CREATE INDEX songs_guest ON songs (guest_id);

CREATE TABLE settings (
	key TEXT PRIMARY KEY,
	value TEXT NOT NULL
);

-- Hard limit: a guest can never hold more than 2 songs, even with concurrent saves.
CREATE TRIGGER songs_pick_limit BEFORE INSERT ON songs WHEN (SELECT count(*) FROM songs WHERE guest_id = NEW.guest_id) >= 2 BEGIN SELECT RAISE(ABORT, 'pick limit'); END;
