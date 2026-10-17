<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let editing: number | null = $state(null);

	const removeMessage = (g: { firstName: string; lastName: string; songs: string[] }) =>
		g.songs.length
			? `Remove ${g.firstName} ${g.lastName}? Their songs will be removed too: ${g.songs.join(', ')}.`
			: `Remove ${g.firstName} ${g.lastName}?`;

	const confirmSubmit = (message: string) => (event: MouseEvent) => {
		if (!confirm(message)) event.preventDefault();
	};
</script>

<h1>Guests <small>({data.guests.length})</small></h1>

{#if form?.message}
	<p class="notice" role="status">{form.message}</p>
{/if}

<section class="tools">
	<form method="POST" action="?/upload" enctype="multipart/form-data" use:enhance class="card">
		<h2>Upload the guest list</h2>
		<p>One row per person: first name, last name and an optional label. Uploading again only adds new names; nobody is ever deleted.</p>
		<a href="/admin/template.csv" download>Download template</a>
		<input type="file" name="file" accept=".csv,text/csv" required />
		<button class="btn btn-solid">Upload</button>
		{#if form?.uploadError}<p class="warn" role="alert">{form.uploadError}</p>{/if}
		{#if form?.uploaded}
			<p class="notice" role="status">Added {form.uploaded.added}, skipped {form.uploaded.skipped} already on the list.</p>
			{#each form.uploaded.errors as e (e)}<p class="warn">{e}</p>{/each}
		{/if}
	</form>

	<form method="POST" action="?/add" use:enhance class="card">
		<h2>Add one guest</h2>
		<input class="field" name="firstName" placeholder="First name" required maxlength="200" />
		<input class="field" name="lastName" placeholder="Last name" required maxlength="200" />
		<input class="field" name="label" placeholder="Label (optional)" maxlength="200" />
		<p class="hint">Visible to guests who share this name, e.g. a town or "bride's side".</p>
		<button class="btn">Add guest</button>
		{#if form?.addError}<p class="warn" role="alert">{form.addError}</p>{/if}
	</form>
</section>

<ul class="guests">
	{#each data.guests as g (g.id)}
		<li>
			{#if editing === g.id}
				<form method="POST" action="?/update" class="edit" use:enhance={() => async ({ update }) => {
					await update();
					editing = null;
				}}>
					<input type="hidden" name="guestId" value={g.id} />
					<input class="field" name="firstName" value={g.firstName} required maxlength="200" aria-label="First name" />
					<input class="field" name="lastName" value={g.lastName} required maxlength="200" aria-label="Last name" />
					<input class="field" name="label" value={g.label} maxlength="200" aria-label="Label" placeholder="Label (optional)" />
					<button class="small-btn">Save</button>
					<button type="button" class="small-btn" onclick={() => (editing = null)}>Cancel</button>
				</form>
			{:else}
				<span class="name">{g.firstName} {g.lastName}{#if g.label}<em> ({g.label})</em>{/if}</span>
				<span class="picks">{g.picks} of 2</span>
				<span class="row-actions">
					<button class="small-btn" onclick={() => (editing = g.id)}>Edit</button>
					<form method="POST" action="?/remove" use:enhance>
						<input type="hidden" name="guestId" value={g.id} />
						<button class="small-btn" onclick={confirmSubmit(removeMessage(g))}>Remove</button>
					</form>
				</span>
			{/if}
		</li>
	{:else}
		<li class="empty">No guests yet. Upload the list or add guests one by one.</li>
	{/each}
</ul>

<style>
	h1 {
		font-weight: 400;
		margin: 0 0 12px;
	}
	h1 small {
		color: var(--muted);
		font-size: 1rem;
	}
	h2 {
		font-weight: 600;
		font-size: 1.05rem;
		margin: 0;
	}
	.notice {
		border-left: 3px solid var(--ink);
		padding: 6px 10px;
		background: rgba(255, 255, 255, 0.4);
	}
	.tools {
		display: grid;
		gap: 20px;
		margin-bottom: 28px;
	}
	@media (min-width: 720px) {
		.tools {
			grid-template-columns: 1fr 1fr;
		}
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 16px;
		border: 1px solid var(--line);
		background: rgba(255, 255, 255, 0.3);
	}
	.card p {
		margin: 0;
		font-size: 0.95rem;
	}
	.card a {
		color: var(--ink);
	}
	.hint {
		color: var(--muted);
		font-size: 0.85rem !important;
	}
	.guests {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.guests li {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
		padding: 8px 0;
		border-bottom: 1px solid var(--line);
	}
	.name {
		flex: 1 1 200px;
	}
	.name em {
		color: var(--muted);
	}
	.picks {
		color: var(--muted);
		font-size: 0.9rem;
	}
	.row-actions,
	.edit {
		display: flex;
		gap: 8px;
		align-items: center;
		flex-wrap: wrap;
	}
	.edit {
		width: 100%;
	}
	.edit .field {
		flex: 1 1 140px;
	}
	form {
		margin: 0;
	}
	.small-btn {
		font: inherit;
		font-size: 0.8rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		background: none;
		border: 1px solid var(--line);
		padding: 4px 10px;
		cursor: pointer;
		color: var(--ink);
	}
	.empty {
		color: var(--muted);
	}
</style>
