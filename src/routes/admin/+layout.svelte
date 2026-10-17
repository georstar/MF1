<script lang="ts">
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<svelte:head>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="admin">
	<header>
		<span class="monogram small">M. &amp; F.</span>
		{#if data.role}
			<nav>
				<a href="/admin" aria-current={page.url.pathname === '/admin' ? 'page' : undefined}>Songs</a>
				{#if data.role === 'bride'}
					<a href="/admin/guests" aria-current={page.url.pathname === '/admin/guests' ? 'page' : undefined}>Guests</a>
				{/if}
				<form method="POST" action="/admin/logout"><button class="linkish">Log out</button></form>
			</nav>
		{/if}
	</header>
	{@render children()}
</div>

<style>
	.admin {
		max-width: 920px;
		margin: 0 auto;
		padding: 16px 16px 48px;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
		border-bottom: 1px solid var(--line);
		padding-bottom: 8px;
		margin-bottom: 20px;
	}
	.small {
		font-size: 2rem;
	}
	nav {
		display: flex;
		align-items: center;
		gap: 18px;
	}
	nav a,
	.linkish {
		color: var(--ink);
		font: inherit;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		text-decoration: none;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		font-size: 0.85rem;
	}
	nav a[aria-current='page'] {
		text-decoration: underline;
		text-underline-offset: 4px;
	}
	form {
		margin: 0;
	}
</style>
