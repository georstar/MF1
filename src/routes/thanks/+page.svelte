<script lang="ts">
	import DancingCouple from '#lib/components/DancingCouple.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<main class="page">
	<DancingCouple />
	<p class="hand lead">See you on the<br /><span class="big">dance floor!</span></p>
	<ul class="songs">
		{#each data.picks as p (p.id)}
			<li>
				{#if p.artworkUrl}<img src={p.artworkUrl} alt="" />{:else}<span class="art"></span>{/if}
				<span><strong>{p.title}</strong><small>{p.artist}</small></span>
			</li>
		{/each}
	</ul>
	<p class="footer">Maria &amp; Frank · 18.07.27</p>
</main>

<style>
	.lead {
		text-align: center;
		margin: 8px 0 16px;
	}
	.big {
		font-size: 1.05rem;
	}
	.songs {
		list-style: none;
		padding: 0;
		margin: 0;
		width: 100%;
	}
	li {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 0;
		border-bottom: 1px solid var(--line);
	}
	li span {
		display: flex;
		flex-direction: column;
	}
	strong {
		font-weight: 600;
	}
	small {
		color: var(--muted);
		font-size: 0.8rem;
	}
	img,
	.art {
		width: 44px;
		height: 44px;
		filter: grayscale(0.85);
		background: #c9c1bf;
	}
	.footer {
		margin-top: auto;
		padding-top: 24px;
		color: var(--muted);
		font-size: 0.85rem;
	}
</style>
