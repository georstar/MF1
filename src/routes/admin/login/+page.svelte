<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<form method="POST" class="login" use:enhance>
	<h1>Song list</h1>
	<label class="label" for="password">Password</label>
	<input class="field" id="password" name="password" type="password" autocomplete="current-password" required />
	{#if form?.wrong}
		<p class="warn" role="alert">That password doesn't match.</p>
	{/if}
	<button class="btn btn-solid">Log in</button>
</form>

<style>
	.login {
		max-width: 360px;
		margin: 40px auto;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	h1 {
		font-weight: 400;
		text-align: center;
	}
</style>
