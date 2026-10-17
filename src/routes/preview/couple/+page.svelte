<script lang="ts">
	import DancingCouple from '#lib/components/DancingCouple.svelte';
	import Monogram from '#lib/components/Monogram.svelte';
</script>

<main class="page">
	<Monogram showDate />
	<DancingCouple />
	<hr style="width:100%;border:0;border-top:1px solid var(--line);margin:32px 0" />
	<Monogram small />
	<DancingCouple size="small" />
</main>
