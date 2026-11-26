<script lang="ts">
  import Button from 'gpuix-svelte-ui/components/Button.svelte';
  import Card from 'gpuix-svelte-ui/components/Card.svelte';
  import TextField from 'gpuix-svelte-ui/components/TextField.svelte';
  import { test_id } from 'gpuix-svelte-ui/shared';
  import type { Platform } from './platform';

  // Spike Q5: the desktop's clipboard and app-data file, through the adapters the app passes in.
  let {
    clipboard,
    store,
    copyText
  }: {
    clipboard: NonNullable<Platform['clipboard']>;
    store: NonNullable<Platform['store']>;
    /** What the copy button puts on the clipboard. */
    copyText: string;
  } = $props();

  let note = $state('');
  let loaded = $state('loading…');
  let status = $state('');

  $effect(() => {
    store.load().then(
      (value) => (loaded = value === null ? 'nothing saved yet' : JSON.stringify(value)),
      (error: unknown) => (loaded = `load failed: ${String(error)}`)
    );
  });

  async function save() {
    const value = { note, savedAt: new Date().toISOString() };
    try {
      await store.save(value);
      status = `saved ${JSON.stringify(value)}`;
    } catch (error) {
      status = `save failed: ${String(error)}`;
    }
  }

  async function copy() {
    try {
      await clipboard.write(copyText);
      status = `copied "${copyText}"`;
    } catch (error) {
      status = `copy failed: ${String(error)}`;
    }
  }
</script>

<Card title="Desktop plumbing" description={store.location} testid="plumbing-card">
  <div {...test_id('plumbing-loaded')}>On launch: {loaded}</div>
  <TextField
    value={note}
    onchange={(value) => (note = value)}
    label="Note"
    testid="plumbing-note"
  />
  <div {...test_id('plumbing-status')}>{status}</div>
  {#snippet footer()}
    <Button size="sm" testid="plumbing-save" onclick={save}>Save to disk</Button>
    <Button size="sm" testid="plumbing-copy" onclick={copy}>Copy summary</Button>
  {/snippet}
</Card>
