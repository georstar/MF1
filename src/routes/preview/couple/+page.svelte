<script lang="ts">
	import DancingCouple from '#lib/components/DancingCouple.svelte';
	import Monogram from '#lib/components/Monogram.svelte';
	import SaveTheDate from '#lib/components/SaveTheDate.svelte';
</script>

<main class="page">
	<Monogram />
	<DancingCouple />
	<SaveTheDate />
	<hr style="width:100%;border:0;border-top:1px solid var(--line);margin:32px 0" />
	<Monogram small />
	<DancingCouple size="small" />
</main>
