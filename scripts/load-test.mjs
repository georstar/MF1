// Load test: N guests sign in and save their 2 songs at the same moment.
// Run against a throwaway database (see README "Load test"), never the real one.
//
//   BASE=http://localhost:8788 BRIDE_PASSWORD=... GUESTS=500 node scripts/load-test.mjs
//
// Like a real crowd, 30% of first picks go to 40 popular songs, so guests collide.
// A guest told a song was taken picks again among songs not on the list (up to 5 tries),
// as a real guest would after seeing "already on the list".
// IN_FLIGHT caps simultaneous requests (default: everyone at once). The local
// simulator drops connections beyond ~100-200, so use IN_FLIGHT=100 locally.

const BASE = process.env.BASE ?? 'http://localhost:8788';
const BRIDE_PASSWORD = process.env.BRIDE_PASSWORD;
const GUESTS = Number(process.env.GUESTS ?? 500);
const IN_FLIGHT = Number(process.env.IN_FLIGHT ?? GUESTS * 3);
if (!BRIDE_PASSWORD) throw new Error('Set BRIDE_PASSWORD');

const headers = { origin: BASE, accept: 'application/json' };
const cookieOf = (res) => (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
const pickTwo = (retry) => {
	const one = () => (!retry && Math.random() < 0.3 ? `Popular ${Math.floor(Math.random() * 40)}` : `Song ${Math.floor(Math.random() * 50_000)}`);
	const a = one();
	let b = one();
	while (b === a) b = one();
	return [a, b].map((title) => ({ title, artist: 'Load Band', source: 'catalog' }));
};

let active = 0;
const waiting = [];
async function request(url, init) {
	if (active >= IN_FLIGHT) await new Promise((r) => waiting.push(r));
	active++;
	try {
		return await fetch(url, init);
	} finally {
		active--;
		waiting.shift()?.();
	}
}
const pct = (xs, p) => {
	const s = [...xs].sort((x, y) => x - y);
	return s.length ? Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]) : 0;
};
// SvelteKit sends action data in devalue format; the outcome type is enough here.
const outcome = async (res) => {
	const text = await res.text();
	try {
		return JSON.parse(text).type;
	} catch {
		return `http ${res.status}: ${text.slice(0, 60)}`;
	}
};

async function bride() {
	const res = await fetch(`${BASE}/admin/login`, { method: 'POST', headers, body: new URLSearchParams({ password: BRIDE_PASSWORD }), redirect: 'manual' });
	const cookie = cookieOf(res);
	if (!cookie.includes('mf_admin')) throw new Error('Bride login failed');
	return cookie;
}

async function uploadGuests(cookie) {
	const csv = 'first_name,last_name\n' + Array.from({ length: GUESTS }, (_, i) => `Guest${i + 1},Loadtest`).join('\n');
	const form = new FormData();
	form.set('file', new Blob([csv], { type: 'text/csv' }), 'guests.csv');
	const res = await fetch(`${BASE}/admin/guests?/upload`, { method: 'POST', headers: { ...headers, cookie }, body: form });
	if ((await outcome(res)) !== 'success') throw new Error('Guest upload failed');
}

async function guest(i) {
	const t0 = performance.now();
	const signIn = await request(`${BASE}/?/name`, { method: 'POST', headers, body: new URLSearchParams({ name: `Guest${i + 1} Loadtest` }), redirect: 'manual' });
	const cookie = cookieOf(signIn);
	const signInMs = performance.now() - t0;
	if ((await outcome(signIn)) !== 'redirect' || !cookie) return { ok: false, signInMs, saveMs: [], conflicts: 0, error: 'sign-in' };

	const saveMs = [];
	let conflicts = 0;
	for (let attempt = 0; attempt < 5; attempt++) {
		const t1 = performance.now();
		const res = await request(`${BASE}/pick?/save`, {
			method: 'POST',
			headers: { ...headers, cookie },
			body: new URLSearchParams({ picks: JSON.stringify(pickTwo(attempt > 0)) }),
			redirect: 'manual'
		});
		const type = await outcome(res);
		saveMs.push(performance.now() - t1);
		if (type === 'redirect') return { ok: true, signInMs, saveMs, conflicts };
		if (res.status === 409) {
			conflicts++;
			continue;
		}
		return { ok: false, signInMs, saveMs, conflicts, error: type };
	}
	return { ok: false, signInMs, saveMs, conflicts, error: 'gave up after 5 taken songs' };
}

const cookie = await bride();
await uploadGuests(cookie);
console.log(`${GUESTS} guests uploaded. Starting all guests at once (max ${Math.min(IN_FLIGHT, GUESTS * 3)} requests in flight)…`);

const start = performance.now();
const results = await Promise.all(Array.from({ length: GUESTS }, (_, i) => guest(i)));
const totalS = ((performance.now() - start) / 1000).toFixed(1);

const ok = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok);
const signIns = results.map((r) => r.signInMs);
const saves = results.flatMap((r) => r.saveMs);
console.log(`\nAll ${GUESTS} guests finished in ${totalS}s`);
console.log(`Saved: ${ok}/${GUESTS}`);
console.log(`"Song was just taken" moments: ${results.reduce((n, r) => n + r.conflicts, 0)} (guests then picked again)`);
console.log(`Sign-in time  p50 ${pct(signIns, 50)} ms  p95 ${pct(signIns, 95)} ms  max ${pct(signIns, 100)} ms`);
console.log(`Save time     p50 ${pct(saves, 50)} ms  p95 ${pct(saves, 95)} ms  max ${pct(saves, 100)} ms`);
if (failed.length) {
	const reasons = {};
	for (const f of failed) reasons[f.error] = (reasons[f.error] ?? 0) + 1;
	console.log('Not saved:', reasons);
}
