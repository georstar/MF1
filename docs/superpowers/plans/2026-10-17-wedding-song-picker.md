# Maria & Frank Wedding Song Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A mobile-first wedding site where each invited guest picks exactly 2 unique songs, plus a private bride/DJ page to view, search, manage and export the list.

**Architecture:** One SvelteKit app deployed to Cloudflare Pages with a D1 (SQLite) database. All rules (name matching, 2-song limit, no duplicates, closing date, roles) live in small server modules under `src/lib/server/` that are unit-tested against a real local D1 (Miniflare). Routes are thin: they call those modules. Song search is proxied through the server to the iTunes Search API (GR + US stores).

**Tech Stack:** SvelteKit (Svelte 5, TypeScript), `@sveltejs/adapter-cloudflare`, Cloudflare D1, Wrangler, Vitest, Miniflare, `qrcode`.

**Spec:** `docs/superpowers/specs/2026-10-17-wedding-song-picker-design.md`

## Global Constraints

- Couple: Maria & Frank. Monogram text exactly `M. & F.`. Date shown as `18.07.27`.
- Colours: paper `#e9e2e0`, ink `#1d1d1d`, accent ink-red `#8b1e1e` (accent only for warnings).
- Fonts (Google Fonts): Pinyon Script (monogram), Homemade Apple (friendly lines), Cormorant Garamond (body, buttons).
- Exactly 2 songs per guest; one row per person in the guest list.
- No song appears twice (normalised title + artist; live/remix versions are distinct).
- All times Europe/Athens. Default close date `2027-07-04`; picks close at the end of that day.
- Guest names in Latin letters; matching ignores case, accents and extra spaces.
- Site text in English. No sound anywhere. Guests never see who picked a song.
- No artwork from the reference screenshots (`images/`) may ship in the site.
- Respect `prefers-reduced-motion`: show a still pose.
- Free hosting only; free `*.pages.dev` address.
- Secrets (never in code): `BRIDE_PASSWORD`, `DJ_PASSWORD`, `SESSION_SECRET`.

## Review Focus

1. **Same song saved by two guests at once, or taken between search and save:** only one save succeeds; the other guest is told which song was taken and keeps their other pick. (Task 4 test `rejects a song taken by another guest and names it`.)
2. **Guest returns after the bride removed one of their songs:** they pick exactly 1 replacement, not 2. (Task 4 test `only allows replacing removed picks`.)
3. **Name typed differently from the list** (case, accents, double spaces, hyphens, last-name-first) still matches; shared names return every match with its label. (Task 2 and Task 3 tests.)
4. **Guest list CSV saved by Excel in a French/Greek locale** (semicolons, UTF-8 BOM, blank lines, quoted fields) imports correctly. (Task 3 test `parses Excel-style semicolon CSV with BOM`.)
5. **One iTunes store errors or is slow:** results from the other store still show; an empty or 1-character query returns no results without calling iTunes. (Task 5 tests.)

---

## File Structure

```
migrations/0001_init.sql            D1 schema
wrangler.toml                        Pages + D1 binding "DB"
src/app.css                          theme tokens, fonts, buttons, inputs
src/app.d.ts                         Platform.env typing (DB + secrets), Locals
src/hooks.server.ts                  reads cookies → locals.role / locals.guestId
src/lib/components/DancingCouple.svelte   flip-book of poses
src/lib/components/Monogram.svelte        "M. & F." + date burst
static/couple/pose-1.svg … pose-N.svg     original drawing, 4–6 poses
src/lib/server/normalize.ts          nameKey, songKey
src/lib/server/db.ts                 types for rows
src/lib/server/guests.ts             guest list operations
src/lib/server/csv.ts                parse guest CSV, build songs CSV, template
src/lib/server/songs.ts              picks, taken keys, listing, remove/reset
src/lib/server/itunes.ts             searchSongs (GR + US merge)
src/lib/server/settings.ts           close date, isClosed
src/lib/server/auth.ts               HMAC-signed cookies, password check
src/routes/+page.svelte / +page.server.ts          intro + name step (+ "which one are you?", closed message)
src/routes/pick/+page.svelte / +page.server.ts     song picking
src/routes/thanks/+page.svelte / +page.server.ts   thank-you
src/routes/api/search/+server.ts                    search proxy
src/routes/admin/login/…                            password login
src/routes/admin/+page.svelte / +page.server.ts     song list, search, progress, QR, close date
src/routes/admin/guests/…                           guest list management (bride)
src/routes/admin/export.csv/+server.ts              songs CSV
src/routes/admin/template.csv/+server.ts            guest list template
src/routes/preview/couple/+page.svelte              standalone couple preview (dev only)
tests/helpers/d1.ts                  fresh Miniflare D1 with migrations applied
tests/*.test.ts                      unit tests per server module
```

---

### Task 1: Scaffold, theme, and the original dancing couple (USER APPROVAL GATE)

**Files:**
- Create: SvelteKit project at repo root (`package.json`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `src/app.html`), `wrangler.toml`, `src/app.css`, `src/lib/components/DancingCouple.svelte`, `src/lib/components/Monogram.svelte`, `static/couple/pose-*.svg`, `src/routes/preview/couple/+page.svelte`, `src/routes/+layout.svelte`
- Keep: `README.md`, `docs/`, `images/`, `.gitignore` (append `node_modules/`, `.svelte-kit/`, `.wrangler/`, `.dev.vars`)

**Interfaces:**
- Produces: `<DancingCouple size="full" | "small" />` (full ≈ 200px wide, small ≈ 110px); `<Monogram showDate={boolean} />`; CSS classes `.btn`, `.btn-solid`, `.field` (underlined input), `.hand` (handwritten), `.warn` (accent), `.label` (small caps label); CSS variables `--paper`, `--ink`, `--accent`.

- [ ] **Step 1: Scaffold** a minimal SvelteKit TypeScript project (Svelte 5) into the repo root (scaffold in a temp dir and move files if the CLI refuses a non-empty dir). Install `@sveltejs/adapter-cloudflare`, `wrangler`, `vitest`, `miniflare`, `qrcode`, `@types/qrcode`. Set the adapter in `svelte.config.js`. `wrangler.toml`: `name = "maria-and-frank"`, `pages_build_output_dir = ".svelte-kit/cloudflare"`, `compatibility_flags = ["nodejs_compat"]`, one `[[d1_databases]]` with `binding = "DB"`, `database_name = "mf-songs"`, `migrations_dir = "migrations"` (placeholder `database_id`, filled at deploy).

- [ ] **Step 2: Verify scaffold:** `npm run build` → exits 0.

- [ ] **Step 3: Theme** in `src/app.css` with the Global Constraints colours and fonts (loaded in `app.html` via Google Fonts link). Mobile-first, centred column max-width 420px on the guest pages.

- [ ] **Step 4: Draw the couple:** 4–6 original SVG poses in `static/couple/`, same viewBox and ground line so frames align. Bride: long white dress with ruffled hem, veil, flower in bob-cut hair, pearl necklace. Groom: dark suit drawn with pencil hatching, thin tie, swept hair. Both barefoot, facing each other, doing a twist-style dance (arms swinging, knees bending, feet swivelling) so the loop reads as one dance. Pencil look: uneven stroke width, `feTurbulence` + `feDisplacementMap` filter for wobble, hatching pattern for the suit, a soft smudged shadow under the feet. Each file under 40 KB. Must not trace or copy `images/`.

- [ ] **Step 5: `DancingCouple.svelte`:** stacks the poses and shows one at a time on a CSS `steps()` loop of about 1.2 s total. Preload all poses. Under `prefers-reduced-motion: reduce`, show `pose-1` only.

- [ ] **Step 6: Preview page** `/preview/couple` shows the full and small couple and the monogram on the paper background. Return 404 from it when `!dev`.

- [ ] **Step 7: Verify:** `npm run dev`, open `/preview/couple` on a phone-width viewport (390px). The dance loops smoothly, the poses don't jump position, and the reduced-motion emulation shows a still pose.

- [ ] **Step 8: Commit**
```bash
git add -A && git commit -m "feat: scaffold SvelteKit app, theme and original dancing couple"
```

- [ ] **Step 9: STOP for user approval.** Show the user `/preview/couple` (screenshot or the visual companion). Iterate on the poses until they approve. Do not start Task 2 until they do.

---

### Task 2: Normalisation (names and songs)

**Files:**
- Create: `src/lib/server/normalize.ts`
- Test: `tests/normalize.test.ts`

**Interfaces:**
- Produces: `nameKey(full: string): string`, `nameKeys(first: string, last: string): string[]` (returns `[first last, last first]` keys), `songKey(title: string, artist: string): string`

- [ ] **Step 1: Write failing tests**
```ts
expect(nameKey('  Hélène   DUPONT ')).toBe('helene dupont');
expect(nameKey('Jean-Luc Picard')).toBe('jean luc picard');
expect(nameKeys('Maria', 'Papadopoulou')).toEqual(['maria papadopoulou', 'papadopoulou maria']);
expect(songKey('Dancing Queen', 'ABBA')).toBe(songKey('Dancing Queen (Remastered 2011)', 'ABBA'));
expect(songKey('Get Lucky - Radio Edit', 'Daft Punk feat. Pharrell Williams'))
  .toBe(songKey('Get Lucky', 'Daft Punk'));
expect(songKey('Let It Be (feat. X)', 'The Beatles')).toBe(songKey('Let It Be', 'The Beatles'));
expect(songKey('September (Live)', 'Earth, Wind & Fire')).not.toBe(songKey('September', 'Earth, Wind & Fire'));
expect(songKey('Titanium (David Guetta Remix)', 'Sia')).not.toBe(songKey('Titanium', 'Sia'));
expect(songKey('Café', 'Zoé')).toBe(songKey('cafe', 'ZOE'));
```

- [ ] **Step 2: Run** `npx vitest run tests/normalize.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement.** Base normalisation: Unicode NFD, drop combining marks, lowercase, `&` → `and`, non-alphanumerics → space, collapse spaces, trim. `songKey` algorithm:
  - Artist: cut everything from ` feat.`, ` ft.`, ` featuring` onwards, then normalise.
  - Title: split off every `(...)`, `[...]` and ` - ...` segment. Drop a segment unless it contains `live` or `remix` (as a word). In that case keep the word `live` / `remix` only. Normalise the remaining base title.
  - Key = `${title}|${artist}` (with `live`/`remix` appended to the title part).

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Commit** `feat: name and song normalisation`.

---

### Task 3: Database schema, guest list, CSV

**Files:**
- Create: `migrations/0001_init.sql`, `src/lib/server/db.ts`, `src/lib/server/guests.ts`, `src/lib/server/csv.ts`, `tests/helpers/d1.ts`, `src/app.d.ts`
- Test: `tests/guests.test.ts`, `tests/csv.test.ts`

**Interfaces:**
- Consumes: `nameKeys`, `nameKey` (Task 2).
- Produces:
  - Schema: `guests(id INTEGER PK, first_name TEXT NOT NULL, last_name TEXT NOT NULL, label TEXT NOT NULL DEFAULT '', key_a TEXT NOT NULL, key_b TEXT NOT NULL, created_at TEXT NOT NULL)`; `songs(id INTEGER PK, guest_id INTEGER NOT NULL REFERENCES guests(id) ON DELETE CASCADE, title TEXT NOT NULL, artist TEXT NOT NULL, artwork_url TEXT, itunes_id INTEGER, source TEXT NOT NULL CHECK(source IN ('catalog','typed')), song_key TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL)`; `settings(key TEXT PK, value TEXT NOT NULL)`; index on `guests(key_a)`, `guests(key_b)`, `songs(guest_id)`.
  - `type Guest = { id: number; firstName: string; lastName: string; label: string; picks: number }`
  - `findGuests(db: D1Database, typed: string): Promise<Guest[]>`: matches `nameKey(typed)` against `key_a` or `key_b`.
  - `getGuest(db, id: number): Promise<Guest | null>`
  - `listGuests(db): Promise<Guest[]>` ordered by last, first.
  - `addGuests(db, rows: GuestInput[]): Promise<{ added: number; skipped: number }>`, where `GuestInput = { firstName: string; lastName: string; label?: string }`. Skips rows whose (key_a, label) already exists. Never deletes.
  - `updateGuest(db, id, input: GuestInput): Promise<void>`
  - `removeGuest(db, id): Promise<void>` (songs cascade; turn on `PRAGMA foreign_keys` behaviour or delete songs explicitly in the same batch).
  - `parseGuestCsv(text: string): { rows: GuestInput[]; errors: string[] }` (header `first_name,last_name,label`; label optional).
  - `GUEST_TEMPLATE_CSV: string`
  - `db.ts` exports `Guest`, `GuestInput`, and `SongRow` (shape given in Task 4), so `csv.ts` can use them now.
  - `songsToCsv(rows: SongRow[]): string` ( columns `Title,Artist,Added by,Added at (Greek time),Source` with Source `catalogue` / `typed by guest`; UTF-8 BOM so Excel opens accents correctly).
  - Test helper `freshDb(): Promise<D1Database>`: new Miniflare instance with an in-memory D1, executes every file in `migrations/`.

- [ ] **Step 1: Write failing tests** (`guests.test.ts`):
  - `adds guests and finds them ignoring case, accents and order`: add `Hélène Dupont`. `findGuests(db, 'helene  DUPONT')` and `findGuests(db, 'Dupont Helene')` each return 1 guest.
  - `returns every guest sharing a name with their labels`: add `Maria Papadopoulou (label "Athens")` and `Maria Papadopoulou (label "Bride's side")`. `findGuests(db,'maria papadopoulou')` has length 2 and labels `['Athens', "Bride's side"]`.
  - `re-adding the same list adds nothing and deletes nothing`: add 3, add the same 3 plus 1 new → `{added:1, skipped:3}`, and `listGuests` length 4.
  - `removing a guest removes their songs`: insert a song row for the guest, `removeGuest` → `SELECT count(*) FROM songs` is 0.
  - `unknown name returns empty`.

  (`csv.test.ts`):
  - `parses Excel-style semicolon CSV with BOM`: `'﻿first_name;last_name;label\r\nAmina;Diallo;\r\n\r\n"Jean-Luc";"Picard";"Paris, France"\r\n'` → 2 rows, label of the second is `Paris, France`.
  - `reports rows missing a last name` in `errors` with the line number, and skips them.
  - `songsToCsv marks typed songs` → contains `typed by guest`, starts with BOM, formats times in Europe/Athens.

- [ ] **Step 2: Run** `npx vitest run tests/guests.test.ts tests/csv.test.ts` → FAIL.

- [ ] **Step 3: Implement** the migration, `db.ts` types, `guests.ts`, `csv.ts`, `tests/helpers/d1.ts`, and `app.d.ts` (`Platform.env: { DB: D1Database; BRIDE_PASSWORD: string; DJ_PASSWORD: string; SESSION_SECRET: string }`; `Locals: { role: 'bride' | 'dj' | null; guestId: number | null }`). CSV delimiter: detect `;` vs `,` from the header line. Support quoted fields with doubled quotes.

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Commit** `feat: schema, guest list and CSV`.

---

### Task 4: Picks, duplicates, listing

**Files:**
- Create: `src/lib/server/songs.ts`
- Test: `tests/songs.test.ts`

**Interfaces:**
- Consumes: `songKey` (Task 2), `freshDb`, `addGuests` (Task 3).
- Produces:
  - `type PickInput = { title: string; artist: string; artworkUrl?: string; itunesId?: number; source: 'catalog' | 'typed' }`
  - `SongRow` (declared in `db.ts` in Task 3) = `{ id: number; title: string; artist: string; artworkUrl: string | null; source: 'catalog' | 'typed'; guestId: number; guestName: string; guestLabel: string; createdAt: string }`
  - `picksOf(db, guestId): Promise<SongRow[]>`
  - `slotsLeft(db, guestId): Promise<number>` (2 minus current picks)
  - `takenKeys(db, keys: string[]): Promise<Set<string>>`
  - `savePicks(db, guestId, picks: PickInput[], now: Date): Promise<{ ok: true } | { ok: false; reason: 'wrong-count' | 'duplicate-in-request'; } | { ok: false; reason: 'taken'; taken: PickInput[] }>`
  - `listSongs(db, query?: string): Promise<SongRow[]>`, newest first. `query` matches title, artist, or guest first/last name/label, case- and accent-insensitive (compare normalised strings in JS; the data set is small).
  - `removeSong(db, songId): Promise<void>`, `resetGuest(db, guestId): Promise<void>`
  - `progress(db): Promise<{ total: number; done: number; notYet: Guest[] }>` (done = guests with 2 picks)

- [ ] **Step 1: Write failing tests:**
  - `saves exactly two picks`: 2 picks → ok, `picksOf` length 2, `slotsLeft` 0.
  - `rejects wrong count`: 1 or 3 picks for a fresh guest → `wrong-count`.
  - `rejects the same song twice in one request` → `duplicate-in-request` (e.g. `Dancing Queen` + `Dancing Queen (Remastered)`).
  - `rejects a song taken by another guest and names it`: guest A saves `Dancing Queen`/`September`. Guest B saves `Dancing Queen - Remastered 2011` + `Valerie` → `{ok:false, reason:'taken', taken:[{title:'Dancing Queen - Remastered 2011',…}]}`, and B has 0 picks saved (all-or-nothing).
  - `concurrent saves of the same song: only one wins`: `Promise.all` of two guests saving the same song → exactly one `ok:true`.
  - `only allows replacing removed picks`: save 2, `removeSong` one → `slotsLeft` 1; saving 2 → `wrong-count`; saving 1 → ok.
  - `a second save after two picks is rejected` → `wrong-count`.
  - `typed songs are saved with source typed and deduplicate against catalogue songs`.
  - `listSongs searches by guest name, title and artist ignoring accents`.
  - `progress counts guests with 2 picks and lists the rest`.

- [ ] **Step 2: Run** `npx vitest run tests/songs.test.ts` → FAIL.

- [ ] **Step 3: Implement.** `savePicks`: validate the count against `slotsLeft` and in-request duplicates. Then one `db.batch()` of `INSERT … SELECT … WHERE (SELECT count(*) FROM songs WHERE guest_id = ?) < 2`. The UNIQUE `song_key` makes the batch fail atomically. On failure, re-query `takenKeys` to report which picks were taken. Trim title/artist and reject empty ones as `wrong-count`.

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Commit** `feat: song picks with strict limit and no duplicates`.

---

### Task 5: Song search (iTunes GR + US)

**Files:**
- Create: `src/lib/server/itunes.ts`, `src/routes/api/search/+server.ts`
- Test: `tests/itunes.test.ts`

**Interfaces:**
- Consumes: `songKey`, `takenKeys`.
- Produces:
  - `type SearchResult = { title: string; artist: string; artworkUrl: string; itunesId: number; key: string; taken: boolean }`
  - `searchSongs(term: string, fetchFn: typeof fetch): Promise<Omit<SearchResult,'taken'>[]>`
  - `GET /api/search?q=` → `{ results: SearchResult[] }`. Requires a guest cookie (`locals.guestId`), else 401.

- [ ] **Step 1: Write failing tests** with a stub `fetchFn`:
  - `queries GR then US and merges without duplicates`: both stores return `Dancing Queen` by ABBA (different trackIds) → it appears once, and GR results come first.
  - `still returns US results when GR fails` (GR stub throws / returns 500).
  - `returns [] without fetching for terms under 2 characters`.
  - `caps results at 20 and uses artworkUrl100 upscaled to 200x200`.
  - `times out a store after 4 seconds` (stub never resolves; use fake timers) → returns the other store's results.

- [ ] **Step 2: Run** `npx vitest run tests/itunes.test.ts` → FAIL.

- [ ] **Step 3: Implement.** URL: `https://itunes.apple.com/search?term=<enc>&country=<GR|US>&media=music&entity=song&limit=15`. Both requests run in parallel with an `AbortController` 4 s timeout each. Parse with `await res.json()` (the content type is `text/javascript`). Map `trackName`, `artistName`, `trackId`, and `artworkUrl100` with `100x100` replaced by `200x200`. The route marks `taken` via `takenKeys`.

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Commit** `feat: iTunes song search across GR and US stores`.

---

### Task 6: Closing date and auth

**Files:**
- Create: `src/lib/server/settings.ts`, `src/lib/server/auth.ts`, `src/hooks.server.ts`
- Test: `tests/settings.test.ts`, `tests/auth.test.ts`

**Interfaces:**
- Produces:
  - `DEFAULT_CLOSE_DATE = '2027-07-04'`
  - `getCloseDate(db): Promise<string>` (`YYYY-MM-DD`), `setCloseDate(db, date: string): Promise<void>` (validates the format)
  - `isClosed(closeDate: string, now: Date): boolean`: true once the Europe/Athens calendar date of `now` is after `closeDate`.
  - `sign(value: string, secret: string): Promise<string>` → `value.sig`; `verify(token: string, secret: string): Promise<string | null>` (constant-time compare)
  - `checkPassword(input: string, env): 'bride' | 'dj' | null`
  - Cookies: `mf_guest` = signed guest id (HttpOnly, SameSite=Lax, Secure in prod, 400 days); `mf_admin` = signed `role:expiryEpoch` (30 days).
  - `hooks.server.ts` sets `locals.guestId` (only if the guest still exists) and `locals.role`.

- [ ] **Step 1: Write failing tests:**
  - `isClosed('2027-07-04', new Date('2027-07-04T20:59:00Z'))` → false (23:59 Athens, UTC+3).
  - `isClosed('2027-07-04', new Date('2027-07-04T21:00:00Z'))` → true (00:00 on 5 July, Athens).
  - `getCloseDate` on an empty DB → `'2027-07-04'`; after `setCloseDate(db,'2027-07-10')` → `'2027-07-10'`; `setCloseDate(db,'10/07/2027')` throws.
  - `verify(await sign('42', s), s)` → `'42'`; a tampered value or wrong secret → null.
  - `checkPassword` maps the bride and DJ passwords to their roles and anything else (including empty) to null.

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** Use Web Crypto HMAC-SHA256 (available in Workers and Node). **Step 4: Run** → PASS.

- [ ] **Step 5: Commit** `feat: closing date and signed-cookie auth`.

---

### Task 7: Guest pages

**Files:**
- Create: `src/routes/+page.svelte`, `src/routes/+page.server.ts`, `src/routes/pick/+page.svelte`, `src/routes/pick/+page.server.ts`, `src/routes/thanks/+page.svelte`, `src/routes/thanks/+page.server.ts`

**Interfaces:**
- Consumes: `DancingCouple`, `Monogram`, `findGuests`, `getGuest`, `slotsLeft`, `picksOf`, `savePicks`, `getCloseDate`, `isClosed`, `sign`, `GET /api/search`.

Copy (exact):
- Intro: `Pick the songs` / `for our dance floor`, button `Let's dance`.
- Name: label `Your name`, placeholder `as on your invitation, in Latin letters`, button `Continue`. No match: `We can't find that name. Try it as written on your invitation.` Several matches: heading `Which one are you?`, one button per guest showing `First Last (label)`.
- Pick: `Hi <first name>,` / `choose 2 songs` (or `choose 1 song` when 1 slot is left), taken badge `already on the list`, link `Can't find your song? Type it in`, button `Save my songs`. Taken on save: `Sorry, "<title>" was just picked by someone else. Please choose another.`
- Thanks: `See you on the` / `dance floor!`, then their songs, footer `Maria & Frank · 18.07.27`.
- Closed: `The song list is closed.` / `See you on the dance floor!`

- [ ] **Step 1: `/`**: the full-screen intro (Monogram with date, full DancingCouple). After 3 s, the text and the `Let's dance` button fade in (immediately under reduced motion). The tap reveals the name step with the small couple as header (no navigation). If closed → closed message instead of the button. If the `mf_guest` cookie is valid → button goes to `/pick` or `/thanks` depending on `slotsLeft`. Form action `?/name`: 0 matches → error. 1 → set cookie, redirect. Several → return the choices; action `?/choose` with `guestId` must be one of the matches for the typed name (re-check server-side).

- [ ] **Step 2: `/pick`**: load redirects to `/` without a guest, to `/thanks` when `slotsLeft` is 0, and to `/` when closed. Slots show the chosen songs. Search box debounced 300 ms → `/api/search`. Taken results are disabled. The manual-entry form takes title + artist (both required). Action `?/save` posts picks as JSON and maps `savePicks` errors to the copy above, keeping untaken picks selected.

- [ ] **Step 3: `/thanks`**: shows the picks. Redirects to `/` without a guest.

- [ ] **Step 4: Verify** with `npm run build && npx wrangler pages dev` (apply migrations locally first: `npx wrangler d1 migrations apply mf-songs --local`, and add a few guests via SQL). At 390px wide, walk through: the intro appears; an unknown name shows the error; a known name leads to picking; a song taken in another browser shows greyed out; save leads to thanks; reopening the link goes straight to thanks; typing a song by hand works.

- [ ] **Step 5: Commit** `feat: guest flow`.

---

### Task 8: Bride & DJ page

**Files:**
- Create: `src/routes/admin/login/+page.svelte`, `src/routes/admin/login/+page.server.ts`, `src/routes/admin/+layout.server.ts`, `src/routes/admin/+page.svelte`, `src/routes/admin/+page.server.ts`, `src/routes/admin/guests/+page.svelte`, `src/routes/admin/guests/+page.server.ts`, `src/routes/admin/export.csv/+server.ts`, `src/routes/admin/template.csv/+server.ts`

**Interfaces:**
- Consumes: `checkPassword`, `sign`, `listSongs`, `progress`, `removeSong`, `resetGuest`, `getCloseDate`, `setCloseDate`, `listGuests`, `addGuests`, `updateGuest`, `removeGuest`, `parseGuestCsv`, `GUEST_TEMPLATE_CSV`, `songsToCsv`, `qrcode`.

- [ ] **Step 1: Write failing test** `tests/admin-guard.test.ts` for a helper `requireRole(locals, 'bride' | 'any')` in `src/lib/server/auth.ts`: it throws a SvelteKit `redirect(303,'/admin/login')` when `role` is null, and `error(403)` when the DJ calls a bride-only action. Run it → FAIL. Implement → PASS.

- [ ] **Step 2: Login** (one password field, `Log in`, a wrong password shows `That password doesn't match.`) and **logout**. `admin/+layout.server.ts` calls `requireRole(locals,'any')` (except on `/admin/login`).

- [ ] **Step 3: `/admin`**: the progress line `<done> of <total> guests have picked`, with an expandable list of guests who haven't picked yet. A search box filters via `?q=` (server-side `listSongs`). The table/cards show Title, Artist, Added by (+label), Added at (Greek time), and a `typed by guest` badge. Links: `Download list (CSV)`. Bride only: per-song `Remove` and per-guest `Reset` (confirm dialogs naming the song/guest), the closing date field with `Save`, and the guest link QR code (SVG via `qrcode`, plus a `Download QR code` PNG link) showing `url.origin + '/'`. Every bride-only action calls `requireRole(locals,'bride')`.

- [ ] **Step 4: `/admin/guests`** (bride only): `Download template`, CSV upload (shows `Added N, skipped M` plus parse errors), a list of all guests with picks count, add/edit form (first, last, label with hint `Visible to guests who share this name, e.g. a town or "bride's side"`), and remove (the confirm text names their songs if they have picks).

- [ ] **Step 5: CSV endpoints** require a role (`any` for export, `bride` for template is fine as `any`). They return `text/csv; charset=utf-8` with `Content-Disposition: attachment; filename="maria-frank-songs.csv"` / `guest-list-template.csv`.

- [ ] **Step 6: Verify** in `wrangler pages dev` with `.dev.vars` holding test secrets: the DJ login can view, search and download but gets 403 on remove; the bride can do everything; search `eleni` finds Eleni's songs; the CSV opens in a spreadsheet with accents intact. Check at 390px and 1280px widths.

- [ ] **Step 7: Commit** `feat: bride and DJ page`.

---

### Task 9: Deployment and handover notes

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Write `README.md`**: what the site is; local dev (`npm install`, `.dev.vars`, migrations, `npm run dev`); first deploy for the user's own Cloudflare account (`npx wrangler login`, `npx wrangler d1 create mf-songs` → paste the id into `wrangler.toml`, `npx wrangler d1 migrations apply mf-songs --remote`, `npx wrangler pages project create maria-and-frank`, set the 3 secrets with `npx wrangler pages secret put`, `npm run build && npx wrangler pages deploy`); adding a custom domain later (Pages → Custom domains); how to swap in a professionally drawn couple (replace `static/couple/pose-*.svg`, same count or update the constant in `DancingCouple.svelte`).

- [ ] **Step 2: Verify:** `npx vitest run` → all pass; `npm run build` → exits 0; `npx svelte-check` → 0 errors.

- [ ] **Step 3: Commit** `docs: setup and deployment guide`.

The actual first deploy runs on the user's Cloudflare account and needs their login. Hand them the README steps and offer to run them together (`! npx wrangler login`).
