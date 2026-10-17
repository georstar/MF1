<script lang="ts">
	// Flip-book of the couple poses in static/couple/. To swap in new artwork,
	// replace the SVG files and update POSE_COUNT if the number of poses changes.
	const POSE_COUNT = 6;
	const FRAME_SECONDS = 0.2;

	let { size = 'full' }: { size?: 'full' | 'small' } = $props();

	const poses = Array.from({ length: POSE_COUNT }, (_, i) => `/couple/pose-${i + 1}.svg`);
</script>

<svelte:head>
	{#each poses as src (src)}
		<link rel="preload" as="image" href={src} />
	{/each}
</svelte:head>

<div
	class="couple {size}"
	role="img"
	aria-label="Maria and Frank dancing"
	style="--count: {POSE_COUNT}; --frame: {FRAME_SECONDS}s"
>
	{#each poses as src, i (src)}
		<img {src} alt="" style="--i: {i}" draggable="false" />
	{/each}
</div>

<style>
	.couple {
		position: relative;
		aspect-ratio: 360 / 320;
		width: 100%;
	}
	.full {
		max-width: 320px;
	}
	.small {
		max-width: 130px;
	}
	img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		visibility: hidden;
		user-select: none;
		animation: frame calc(var(--count) * var(--frame)) linear infinite;
		/* Negative delay starts each pose at its own slot in the loop. */
		animation-delay: calc((var(--i) - var(--count)) * var(--frame));
	}
	@keyframes frame {
		0% {
			visibility: visible;
		}
		/* 1 / POSE_COUNT of the loop; keep in step with POSE_COUNT. */
		16.66% {
			visibility: hidden;
		}
		100% {
			visibility: hidden;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		img {
			animation: none;
		}
		img:first-child {
			visibility: visible;
		}
	}
</style>
