<div class="date" aria-label="Save the date: 18 July 2027">
	<span class="burst" aria-hidden="true"></span>
	<span class="script">Save the Date</span>
	<span class="digits">18.07.27</span>
</div>

<style>
	.date {
		position: relative;
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		padding: 10px 34px;
		margin-top: 6px;
	}
	.script {
		font-family: var(--font-script);
		font-size: 1.5rem;
		line-height: 1;
	}
	.digits {
		font-family: var(--font-script);
		font-size: 2rem;
		letter-spacing: 0.06em;
		line-height: 1.1;
	}
	/* Little pencil marks radiating around the date. */
	.burst,
	.burst::before,
	.burst::after {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	.burst {
		background:
			linear-gradient(var(--ink), var(--ink)) 6% 50% / 9px 1.5px no-repeat,
			linear-gradient(var(--ink), var(--ink)) 94% 50% / 9px 1.5px no-repeat;
	}
	.burst::before,
	.burst::after {
		content: '';
		background:
			linear-gradient(var(--ink), var(--ink)) 12% 8% / 1.5px 8px no-repeat,
			linear-gradient(var(--ink), var(--ink)) 88% 92% / 1.5px 8px no-repeat;
	}
	.burst::before {
		transform: rotate(-35deg);
	}
	.burst::after {
		transform: rotate(35deg) scaleX(-1);
	}
</style>
