<script lang="ts">
  import Button from 'gpuix-svelte-ui/components/Button.svelte';
  import Card from 'gpuix-svelte-ui/components/Card.svelte';
  import TextField from 'gpuix-svelte-ui/components/TextField.svelte';
  import { test_id } from 'gpuix-svelte-ui/shared';
  import type { Scenario } from './platform';

  // Spike Q2: a shared component built from the kit's Card, TextField and Button. On the web its
  // props come from a `+page.server.ts` load, so the server renders it and the page hydrates it.
  let { scenario }: { scenario: Scenario } = $props();

  // Seeds from the prop once; later edits are local, as in a controlled form.
  // svelte-ignore state_referenced_locally
  let name = $state(scenario.name);
  // svelte-ignore state_referenced_locally
  let balance = $state(scenario.startingBalance);
</script>

<Card title="Scenario" description="Loaded by {scenario.source}" testid="scenario-card">
  <TextField
    value={name}
    onchange={(value) => (name = value)}
    label="Scenario name"
    testid="scenario-name"
  />
  <div class="row">
    <div {...test_id('scenario-summary')}>{name}: ${balance.toLocaleString('en-US')}</div>
  </div>
  {#snippet footer()}
    <Button size="sm" variant="primary" testid="scenario-add" onclick={() => (balance += 1000)}>
      Add $1,000
    </Button>
  {/snippet}
</Card>

<style>
  .row {
    display: flex;
    flex-direction: row;
    gap: 8px;
  }
</style>
