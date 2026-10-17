<script lang="ts">
	let { small = false }: { small?: boolean } = $props();
</script>

<h1 class="monogram" class:small>M. &amp; F.</h1>

<style>
	.monogram {
		text-align: center;
	}
	.small {
		font-size: 2rem;
	}
</style>
