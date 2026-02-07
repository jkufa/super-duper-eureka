<script lang="ts">
  import { useClientLoggingContext } from '$lib/client/logging';
  import { Button } from '$lib/components/ui/button';

  const log = useClientLoggingContext();
  log.mergeSharedContext({ feature: 'calculator' });
  log.info({ event_type: 'button_clicked', action: 'calculate' });
</script>

<Button
  onclick={() => {
    log.info({ event_type: 'button_clicked', action: 'calculate' });
  }}
>
  Debug
</Button>
