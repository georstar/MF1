# Maria & Frank — Wedding Song Picker

A small website for Maria & Frank's wedding (18 July 2027). Every guest opens one
shared link, says who they are, and picks **exactly 2 songs** for the DJ. No song
appears twice. The bride and the DJ get a private page listing every song and who
picked it.

- **Guests:** `/` (intro with the dancing couple, then name, then song picks, then thank-you)
- **Bride & DJ:** `/admin` (password login)

Built with SvelteKit 3 on Cloudflare Pages, with a Cloudflare D1 database and
Apple iTunes search (Greek + US stores). Hosting is free.

Design: `docs/superpowers/specs/2026-10-17-wedding-song-picker-design.md`

## Run it locally

```bash
npm install
cp .dev.vars.example .dev.vars        # then edit the three values
npx wrangler d1 migrations apply mf-songs --local
npm run dev                           # http://localhost:5173
```

- `/preview/couple` shows the dancing couple on its own (only in `npm run dev`).
- Add test guests on `/admin/guests` after logging in with `BRIDE_PASSWORD`.

Checks:

```bash
npm test          # unit tests (uses a real in-memory D1)
npm run check     # type check
npm run build     # production build
npx wrangler pages dev   # serve the production build locally on :8788
```

## Load test

`scripts/load-test.mjs` signs in N guests and has them all save 2 songs at once,
colliding on popular songs like a real crowd. Always point it at a throwaway
database, never the real one:

```bash
npx wrangler d1 migrations apply mf-songs --local --persist-to .loadtest
npm run build && npx wrangler pages dev --port 8788 --persist-to .loadtest
# in another terminal:
BASE=http://localhost:8788 BRIDE_PASSWORD=<from .dev.vars> GUESTS=500 IN_FLIGHT=100 node scripts/load-test.mjs
```

The local simulator drops connections beyond roughly 100-200 simultaneous
requests, so use `IN_FLIGHT=100` locally. `tests/crowd.test.ts` runs the same
500-guest race directly against the database as part of `npm test`.

## Secrets

| Name | What it is |
|---|---|
| `BRIDE_PASSWORD` | Bride's login: can view, remove songs, reset guests, manage the guest list, set the closing date |
| `DJ_PASSWORD` | DJ's login: view, search and download only |
| `SESSION_SECRET` | Long random string used to sign login cookies (e.g. `openssl rand -base64 32`) |

Never commit them. Locally they live in `.dev.vars` (git-ignored).

## First deploy (your Cloudflare account)

```bash
npx wrangler login
npx wrangler d1 create mf-songs
#   → copy the printed database_id into wrangler.toml
npx wrangler d1 migrations apply mf-songs --remote
npx wrangler pages project create maria-and-frank --production-branch main
npx wrangler pages secret put BRIDE_PASSWORD --project-name maria-and-frank
npx wrangler pages secret put DJ_PASSWORD --project-name maria-and-frank
npx wrangler pages secret put SESSION_SECRET --project-name maria-and-frank
npm run build && npx wrangler pages deploy
```

The site is then live at `https://maria-and-frank.pages.dev`. Then:

1. Log in at `/admin` with the bride's password.
2. On **Guests**, download the template, fill in one row per person (partners and
   children too), and upload it. Excel files saved with `;`, or in the older non-UTF-8 "CSV" format, work too.
3. On **Songs**, download the QR code and share it, or the link, with guests.

Later deploys: `npm run build && npx wrangler pages deploy`.

## Custom domain later

Cloudflare dashboard → Workers & Pages → `maria-and-frank` → Custom domains →
add the domain. Nothing in the code needs to change; the QR code on the bride's
page always uses the address you're visiting it from.

## Swapping in a professionally drawn couple

The couple is drawn by `scripts/draw-couple.mjs` into `static/couple/pose-1.svg`
… `pose-16.svg`: 16 frames sampled from one continuous dance cycle, played at
about 12 frames per second. To change the dance, edit `dancer()` in the script
and run `node scripts/draw-couple.mjs`. To use other artwork, replace those files (SVG or change the
extension in `src/lib/components/DancingCouple.svelte`), keeping the same aspect
ratio (360 × 320). If the number of frames changes, update `FRAME_COUNT` in `DancingCouple.svelte`.

The reference screenshots in `images/` are someone else's artwork. They're
git-ignored and must never be published.
