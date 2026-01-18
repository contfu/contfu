<script lang="ts">
	import Header from "$lib/components/Header.svelte";
	import "../app.css";

	let { data, children } = $props();
</script>

<Header user={data.user} isUnderConstruction={data.isUnderConstruction} />
{@render children()}
