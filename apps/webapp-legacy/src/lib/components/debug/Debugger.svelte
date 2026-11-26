<script lang="ts">
  import type { ProjectionRun } from '@retirement/calculator';
  import type { RetirementConfig } from '@retirement/calculator/types';
  import LoggingProvider from '$lib/client/logging/LoggingProvider.svelte';
  import DebuggerBody from './DebuggerBody.svelte';

  let {
    config,
    run,
    requestId,
    logContext
  }: {
    config: RetirementConfig & { mockSeed?: number };
    run: ProjectionRun;
    requestId?: string;
    logContext?: Record<string, unknown>;
  } = $props();
</script>

<LoggingProvider
  base={{
    service_name: 'retirement-webapp',
    request_id: requestId
  }}
  pretty={true}
>
  <DebuggerBody {config} {run} {logContext} />
</LoggingProvider>
