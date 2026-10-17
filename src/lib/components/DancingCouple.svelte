<script lang="ts">
	// Flip-book of the couple frames in static/couple/ (made by scripts/draw-couple.mjs).
	// To swap in new artwork, replace the SVG files and update FRAME_COUNT.
	const FRAME_COUNT = 20;
	// One slow sway every 2 seconds.
	const FRAME_MS = 100;

	let { size = 'full' }: { size?: 'full' | 'small' } = $props();

	const frames = Array.from({ length: FRAME_COUNT }, (_, i) => `/couple/pose-${i + 1}.svg`);
	let current = $state(0);

	$effect(() => {
		// A still pose for people who ask their phone for less motion.
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		let raf = 0;
		const start = performance.now();
		const tick = (now: number) => {
			current = Math.floor((now - start) / FRAME_MS) % FRAME_COUNT;
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});
</script>

<svelte:head>
	{#each frames as src (src)}
		<link rel="preload" as="image" href={src} />
	{/each}
</svelte:head>

<div class="couple {size}" role="img" aria-label="Maria and Frank dancing">
	{#each frames as src, i (src)}
		<img {src} alt="" class:shown={i === current} draggable="false" />
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
	}
	.shown {
		visibility: visible;
	}
</style>
