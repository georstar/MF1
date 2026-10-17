# Maria & Frank — Wedding Song Picker: Design

Date: 2026-10-17
Status: draft, awaiting approval

## Intent

Maria and Frank marry on **18 July 2027**. The bride wants every guest to
choose **exactly 2 songs** for the DJ to play on the day. Guests get one
shared link (sent by the bride as a link or QR code), say who they are, and
pick their 2 songs. The bride and the DJ get a private page listing every
song and who picked it.

It should feel like part of the wedding, not a generic form: a pencil-sketch
look with the couple dancing when the page opens.

## Goals

- Every invited guest can pick exactly 2 songs, once. The limit is enforced.
- No song appears twice on the list.
- The bride and DJ can see every song, who added it, and search the list.
- The bride always knows who has and hasn't picked yet, so she can remind them.
- The DJ can take the list offline (download) for the day.
- It looks and feels like the agreed pencil-sketch theme, with an original
  animated drawing of the couple.
- It costs nothing to run and stays online reliably until after the wedding.

## Non-goals

- RSVP, meal choices, or any other wedding admin.
- Guest accounts, emails, or sending messages to guests (the bride sends the link herself).
- Spotify integration or automatic playlist creation.
- Voting, ranking, or guests seeing the full list.
- Playing song previews or any sound.
- A custom domain for now (added later by the user; the free `*.pages.dev` address is used until then).

## Anti-goals (would be a failure even if it works)

- Shipping someone else's artwork. The reference screenshots (from the
  Instagram account "atttending") are style reference only and must not
  appear in the site.
- Guests being able to see who picked what.
- A guest getting more than 2 songs in, or the same song being picked twice
  (including two guests saving the same song at the same moment).
- A guest's picks being lost after they were told "saved".
- An intro that is slow or heavy on a phone with weak signal, or that can't be skipped past.
- Anything that needs the user to pay, or that could pause/expire before July 2027.

## Constraints

- The wedding is in **Greece**. Guests come from all over the world
  (Africa, France, Greece, the US and elsewhere).
- All times, including the picks closing date, are **Greek time
  (Europe/Athens)**; picks close at the end of the chosen day.
- Guest names are written in **Latin letters** only, in the guest list and when
  guests type them. Matching still ignores accents (é, ü and so on).

- Mobile first. Almost every guest opens it on a phone from a link or QR code.
- Scale: a few hundred guests at most, so up to roughly 2× that many songs.
- Free hosting and free song search, no API keys that expire or need approval.
- Must keep working until at least 19 July 2027.

## Tools (decided by the user, as proposed)

- **Hosting:** Cloudflare Pages, free `*.pages.dev` address.
- **Database:** Cloudflare D1.
- **App framework:** SvelteKit (one project for guest pages and the private page).
- **Song search:** Apple iTunes Search API (no key needed).
- **Couple drawing:** original SVG artwork with a pencil-texture effect.
- **Bride/DJ login:** password(s) stored as server secrets, not in the code.
- **Export:** CSV download.

## Look and feel (approved from mockups)

- Paper background: off-white with a slight pink tint (about `#e9e2e0`).
- Ink: near-black pencil lines and hatching (about `#1d1d1d`).
- Accent: dark ink-red (about `#8b1e1e`), used only for warnings like
  "already on the list" or "we can't find that name".
- Type: a formal script for the monogram **"M. & F."** (mockup used Pinyon
  Script); a handwritten face for friendly lines (mockup used Homemade Apple);
  a classic serif for body text and buttons (mockup used Cormorant Garamond).
  Buttons are outlined or solid black rectangles with spaced uppercase text.
- Date shown as **18.07.27**, in the same spirit as the reference's
  "Save The Date" line with little burst marks around it.

### The dancing couple

- An **original** bride and groom in a loose pencil style similar to the
  reference: bride in a long dress with veil and flower in her hair, groom
  in a dark hatched suit, both barefoot, doing a playful twist-style dance
  facing each other.
- **4–6 poses** played in a loop like a flip-book.
- Each pose is a separate file, so a professionally drawn set can be swapped
  in later without touching anything else.
- It will look hand-drawn but simpler than the reference artwork. The user
  understands this.
- **The couple is built and shown to the user for approval on their own,
  before the rest of the site is built.**

## Guest experience

1. **Intro.** The guest opens the shared link. Full screen: "M. & F."
   monogram, the couple dancing, the date. After about 3 seconds, the text
   "Pick the songs for our dance floor" and a **Let's dance** button fade in.
   The couple keep dancing until the guest taps.
2. **Who are you.** A small dancing couple stays at the top as a header.
   The guest types their name (first and last, as on the invitation). It is
   checked against the guest list. If no match: "We can't find that name.
   Try it as written on your invitation."
3. **Pick 2 songs.** "Hi <first name>, choose 2 songs." Two slots, a search
   box, and results showing title, artist, and cover art. Songs already on
   the list are greyed out with "already on the list" and can't be chosen.
   Once both slots are filled, **Save my songs** saves both together.
   **Can't find it?** Below the results, a "Can't find your song? Type it
   in" option lets the guest enter title and artist by hand. A typed song
   counts as a pick like any other. Its duplicate check uses the same
   normalised title + artist rule, so it's looser for typos, which is accepted.
   On the bride & DJ page and in the CSV, it's marked **typed by guest**.
4. **Thank you.** "See you on the dance floor!", the full-size couple dancing,
   and their 2 songs listed. Picks are locked.
5. **Coming back.** If a guest who already picked enters their name again,
   they go straight to the thank-you page with their songs. They cannot
   change them; the bride can reset them.
6. **After picks close.** Once the bride's closing date passes, the guest
   page shows the intro and a friendly "The song list is closed. See you on
   the dance floor!" message.

## Bride & DJ page

A private page on the same site, in the same visual style but laid out for
reading a list (works on phone and laptop).

- **Login** with a password.
- **Song list:** every song with title, artist, who added it, and when.
- **Search:** one box that matches song title, artist, or guest name.
- **Progress:** "84 of 120 guests have picked", plus the list of guests who
  haven't picked yet.
- **Download** the full list as a spreadsheet (CSV).
- **Bride only:**
  - remove a single song (that guest can then pick one replacement),
  - reset a guest (clears both picks; they can pick again),
  - upload the guest list from the template, and add, edit, or remove a single guest,
  - set the date picks close.
- **DJ:** view, search, and download only.

### Guest list

- There is no spreadsheet yet. The bride fills in a provided template:
  **one row per person** (partners and children included), with columns for
  first name and last name.
- **Every person gets their own 2 songs.**
- Guests with the same name are told apart by the bride adding something to
  one of them in the list, like "Maria Papadopoulou (Athens)". Name matching
  must then still let that guest find themselves.

## Calls I made (not discussed with the user)

- Two passwords: one for the bride (full control) and one for the DJ (view and
  download only), since the bride edits and the DJ only views.
- Name matching ignores upper/lower case, accents, and extra spaces. An
  identity check beyond the name isn't required: someone typing another
  guest's name is an accepted risk, and the bride can reset it.
- "Same song" means the same normalised title + artist, not the iTunes track
  ID, because iTunes lists the identical recording separately on every album,
  compilation and single. Normalising removes noise like "- Remastered 2011",
  "(Radio Edit)" and featured-artist tags. A version whose title marks it as
  live or a remix counts as a different song and can be picked separately.
  The database enforces this uniqueness, so two guests saving the same song
  at the same moment can't both succeed.
- Guests with the same name: if a typed name matches more than one guest,
  the site shows "Which one are you?" with the bride's labels (e.g. "Maria
  Papadopoulou (Athens)"). The bride is told that these labels are visible to
  guests, so she should keep them neutral (a town, "bride's side").
- Re-uploading the guest list only ever adds new names; it never deletes
  anyone. Removing a guest is done one at a time, and removing a guest who has
  already picked also removes their songs, after a confirmation that names
  the songs.
- If a song gets taken by someone else between searching and saving, the
  guest is told which one, keeps their other pick, and chooses again.
- Guests only see that a song is "already on the list", never who picked it.
- Re-uploading the guest list adds new names and never deletes guests who
  have already picked.
- The private page offers the guest link as a downloadable **QR code**, so
  the bride can put it on a card or message.
- Respect the phone's "reduce motion" setting: show a still pose instead of
  the animation.
- Song search queries the **Greek** iTunes store (so Greek songs show up)
  and the **US** store (broad international coverage), merging results and
  dropping duplicates. If one store fails, results from the other are still shown.
- The name screen says "as on your invitation, in Latin letters".
- No sound anywhere.
- Site text in English, since guests come from many countries.
- Default closing date for picks: 4 July 2027 (two weeks before), which the bride can change.

## Left to the builder

- Code structure, data model, and how sessions/cookies work.
- Whether song search goes through the server or straight from the browser.
- Exact animation timing, pose count within 4–6, and the drawing technique, as long as it looks pencil-drawn and stays light.
- How guest-name matching is implemented, within the rules above.
- Testing approach.
- Deployment setup (the user will connect their own Cloudflare account).
