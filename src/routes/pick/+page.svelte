<script lang="ts">
	import { enhance } from '$app/forms';
	import DancingCouple from '#lib/components/DancingCouple.svelte';
	import type { SearchResult } from '#lib/server/itunes.ts';
	import type { PickInput } from '#lib/server/songs.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type Pick = PickInput & { key: string };

	let picks: Pick[] = $state([]);
	let query = $state('');
	let results: SearchResult[] = $state([]);
	let searching = $state(false);
	let searchFailed = $state(false);
	let searchBusy = $state(false);
	let typing = $state(false);
	let typedTitle = $state('');
	let typedArtist = $state('');
	let busy = $state(false);
	// Songs the server told us were taken while this page was open.
	let takenNow: string[] = $state([]);

	const full = $derived(picks.length >= data.slots);
	const takenMessage = $derived(form?.error === 'taken' ? form.taken : []);

	let timer: ReturnType<typeof setTimeout>;
	let latest = 0;
	function onSearch() {
		clearTimeout(timer);
		const q = query.trim();
		if (q.length < 2) {
			results = [];
			return;
		}
		timer = setTimeout(async () => {
			const id = ++latest;
			searching = true;
			searchFailed = false;
			searchBusy = false;
			try {
				const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
				if (!res.ok) throw new Error(String(res.status));
				const body = (await res.json()) as { results: SearchResult[]; unavailable: boolean };
				if (id === latest) {
					results = body.results;
					searchBusy = body.unavailable;
				}
			} catch {
				if (id === latest) searchFailed = true;
			} finally {
				if (id === latest) searching = false;
			}
		}, 300);
	}

	const isPicked = (key: string) => picks.some((p) => p.key === key);
	const isTaken = (r: SearchResult) => r.taken || takenNow.includes(r.title);

	function add(r: SearchResult) {
		if (full || isTaken(r) || isPicked(r.key)) return;
		picks.push({ title: r.title, artist: r.artist, artworkUrl: r.artworkUrl, itunesId: r.itunesId, source: 'catalog', key: r.key });
	}

	function addTyped(event: SubmitEvent) {
		event.preventDefault();
		const title = typedTitle.trim();
		const artist = typedArtist.trim();
		if (!title || !artist || full) return;
		picks.push({ title, artist, source: 'typed', key: `typed:${title}|${artist}`.toLowerCase() });
		typedTitle = '';
		typedArtist = '';
		typing = false;
	}

	const payload = $derived(JSON.stringify(picks.map(({ key: _key, ...p }) => p)));
</script>

<main class="page">
	<DancingCouple size="small" />
	<p class="hand hi">Hi {data.firstName},</p>
	<h1 class="title">choose {data.slots === 1 ? '1 song' : `${data.slots} songs`}</h1>
	{#if data.kept.length}
		<p class="kept">Already on the list from you: {data.kept.map((k) => `${k.title} (${k.artist})`).join(', ')}</p>
	{/if}

	<ol class="slots">
		{#each { length: data.slots } as _, i (i)}
			{@const p = picks[i]}
			<li class="slot" class:filled={p}>
				{#if p}
					<span class="slot-text"><strong>{p.title}</strong><small>{p.artist}</small></span>
					<button class="remove" aria-label="Remove {p.title}" onclick={() => picks.splice(i, 1)}>×</button>
				{:else}
					<span class="slot-empty">{i + 1}</span>
				{/if}
			</li>
		{/each}
	</ol>

	{#each takenMessage as title (title)}
		<p class="warn" role="alert">Sorry, "{title}" was just picked by someone else. Please choose another.</p>
	{/each}
	{#if form?.error === 'duplicate'}
		<p class="warn" role="alert">You picked the same song twice. Please choose another.</p>
	{:else if form?.error === 'count'}
		<p class="warn" role="alert">Please choose exactly {data.slots === 1 ? '1 song' : `${data.slots} songs`}.</p>
	{:else if form?.error === 'busy'}
		<p class="warn" role="alert">We couldn't save just now. Please press Save again.</p>
	{:else if form?.error === 'closed'}
		<p class="warn" role="alert">The song list is closed. See you on the dance floor!</p>
	{/if}

	{#if !full}
		<label class="label search-label" for="q">Search a song or artist</label>
		<input id="q" class="field" type="search" placeholder="e.g. Dancing Queen" autocomplete="off" bind:value={query} oninput={onSearch} />

		{#if searching}
			<p class="status">Searching…</p>
		{:else if searchBusy}
			<p class="warn" role="status">Search is busy right now. Type your song in below, or try again in a minute.</p>
		{:else if searchFailed}
			<p class="warn">Search isn't working right now. You can type your song in below.</p>
		{:else if query.trim().length >= 2 && results.length === 0}
			<p class="status">No songs found.</p>
		{/if}

		<ul class="results">
			{#each results as r (r.key)}
				{@const taken = isTaken(r)}
				<li>
					<button class="result" disabled={taken || isPicked(r.key)} onclick={() => add(r)}>
						{#if r.artworkUrl}<img src={r.artworkUrl} alt="" loading="lazy" />{:else}<span class="art"></span>{/if}
						<span class="result-text">
							<strong>{r.title}</strong>
							<small>{r.artist}</small>
							{#if taken}<em class="badge">already on the list</em>{/if}
						</span>
					</button>
				</li>
			{/each}
		</ul>

		{#if typing}
			<form class="typed" onsubmit={addTyped}>
				<input class="field" placeholder="Song title" bind:value={typedTitle} maxlength="200" required />
				<input class="field" placeholder="Artist" bind:value={typedArtist} maxlength="200" required />
				<button class="btn">Add this song</button>
			</form>
		{:else}
			<button class="link" onclick={() => (typing = true)}>Can't find your song? Type it in</button>
		{/if}
	{/if}

	<form
		method="POST"
		action="?/save"
		class="save"
		use:enhance={() => {
			busy = true;
			return async ({ result, update }) => {
				if (result.type === 'failure' && result.data?.error === 'taken') {
					const taken = result.data.taken as string[];
					takenNow = [...takenNow, ...taken];
					picks = picks.filter((p) => !taken.includes(p.title));
				}
				await update({ reset: false });
				busy = false;
			};
		}}
	>
		<input type="hidden" name="picks" value={payload} />
		<button class="btn btn-solid" disabled={!full || busy}>Save my songs</button>
	</form>
</main>

<style>
	.hi {
		margin: 8px 0 0;
	}
	.title {
		font-weight: 400;
		font-size: 1.3rem;
		margin: 0 0 12px;
	}
	.kept {
		font-size: 0.9rem;
		color: var(--muted);
		text-align: center;
		margin: 0 0 8px;
	}
	.slots {
		list-style: none;
		padding: 0;
		margin: 0 0 12px;
		width: 100%;
		display: flex;
		gap: 10px;
	}
	.slot {
		flex: 1 1 0;
		min-width: 0;
		min-height: 58px;
		border: 1.5px dashed var(--ink);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 6px 8px;
		position: relative;
		font-size: 0.9rem;
	}
	.slot.filled {
		padding-right: 26px;
		border-style: solid;
		background: rgba(255, 255, 255, 0.45);
		justify-content: flex-start;
	}
	.slot-text,
	.result-text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.slot-text strong,
	.result-text strong {
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	small {
		color: var(--muted);
		font-size: 0.8rem;
	}
	.slot-empty {
		color: var(--muted);
	}
	.remove {
		position: absolute;
		top: 0;
		right: 2px;
		border: none;
		background: none;
		font-size: 1.2rem;
		cursor: pointer;
		color: var(--ink);
		padding: 2px 6px;
	}
	.search-label {
		align-self: flex-start;
		margin-top: 8px;
	}
	.status {
		color: var(--muted);
		font-style: italic;
		margin: 8px 0;
	}
	.results {
		list-style: none;
		margin: 6px 0 0;
		padding: 0;
		width: 100%;
	}
	.result {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 8px 2px;
		border: none;
		border-bottom: 1px solid var(--line);
		background: none;
		text-align: left;
		font: inherit;
		color: inherit;
		cursor: pointer;
	}
	.result:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.result img,
	.art {
		width: 44px;
		height: 44px;
		flex-shrink: 0;
		filter: grayscale(0.85) contrast(1.05);
		background: #c9c1bf;
	}
	.badge {
		color: var(--accent);
		font-size: 0.8rem;
	}
	.link {
		margin: 14px 0 4px;
		border: none;
		background: none;
		font: inherit;
		color: var(--ink);
		text-decoration: underline;
		cursor: pointer;
	}
	.typed {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-top: 12px;
	}
	.save {
		width: 100%;
		margin-top: auto;
		padding-top: 20px;
	}
</style>
