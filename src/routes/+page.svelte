<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import DancingCouple from '#lib/components/DancingCouple.svelte';
	import Monogram from '#lib/components/Monogram.svelte';
	import SaveTheDate from '#lib/components/SaveTheDate.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// Skip the intro when coming back from a submitted name.
	let step: 'intro' | 'name' = $state(untrack(() => form) ? 'name' : 'intro');
	let busy = $state(false);
</script>

{#if step === 'intro'}
	<main class="page intro">
		<Monogram />
		<DancingCouple />
		<SaveTheDate />
		<div class="reveal">
			{#if data.closed}
				<p class="hand lead">The song list is closed.<br />See you on the dance floor!</p>
			{:else}
				<p class="hand lead">Pick the songs<br /><span class="big">for our dance floor</span></p>
				{#if data.next}
					<a class="btn" href={data.next}>Let's dance</a>
				{:else}
					<button class="btn" onclick={() => (step = 'name')}>Let's dance</button>
				{/if}
			{/if}
		</div>
	</main>
{:else}
	<main class="page">
		<Monogram small />
		<DancingCouple size="small" />

		{#if form?.closed}
			<p class="hand lead">The song list is closed.<br />See you on the dance floor!</p>
		{:else if form?.choices}
			<h2 class="title">Which one are you?</h2>
			<form method="POST" action="?/choose" class="choices" use:enhance={() => {
				busy = true;
				return async ({ update }) => {
					await update();
					busy = false;
				};
			}}>
				<input type="hidden" name="name" value={form.name} />
				{#each form.choices as choice (choice.id)}
					<button class="btn" name="guestId" value={choice.id} disabled={busy}>{choice.label}</button>
				{/each}
			</form>
		{:else}
			<p class="welcome">Welcome! Tell us who you are.</p>
			<form method="POST" action="?/name" class="name-form" use:enhance={() => {
				busy = true;
				return async ({ update }) => {
					await update({ reset: false });
					busy = false;
				};
			}}>
				<label class="label" for="name">Your name</label>
				<input
					class="field"
					id="name"
					name="name"
					placeholder="as on your invitation, in Latin letters"
					autocomplete="name"
					autocapitalize="words"
					required
					value={form?.name ?? ''}
				/>
				{#if form?.notFound}
					<p class="warn" role="alert">We can't find that name. Try it as written on your invitation.</p>
				{/if}
				<button class="btn btn-solid" disabled={busy}>Continue</button>
			</form>
		{/if}
	</main>
{/if}

<style>
	.intro {
		justify-content: center;
		gap: 4px;
	}
	.reveal {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 18px;
		margin-top: 18px;
		opacity: 0;
		animation: reveal 0.9s ease-out 3s forwards;
	}
	@keyframes reveal {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.reveal {
			animation: none;
			opacity: 1;
		}
	}
	.lead {
		text-align: center;
		margin: 0;
	}
	.big {
		font-size: 1.05rem;
	}
	.welcome {
		margin: 20px 0 8px;
		text-align: center;
	}
	.title {
		font-weight: 400;
		font-size: 1.4rem;
		margin: 20px 0 12px;
	}
	.name-form,
	.choices {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.name-form .btn {
		margin-top: 12px;
	}
	.choices .btn {
		text-transform: none;
		letter-spacing: 0.02em;
	}
</style>
