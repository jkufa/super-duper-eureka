<script lang="ts">
  import { Bug } from '@lucide/svelte';
  import * as Button from '$lib/components/ui/button';
  import type { ProjectionRun } from '@retirement/calculator';
  import { buildRunWideEvent, buildStepWideEventInput } from '@retirement/calculator';
  import type { RetirementConfig } from '@retirement/calculator/types';
  import { browser } from '$app/environment';
  import { getLoggingContext } from '$lib/client/logging/logging-context.svelte';

  import DebuggerPanel from './DebuggerPanel.svelte';

  let {
    config,
    run,
    logContext = {}
  }: {
    config: RetirementConfig & { mockSeed?: number };
    run: ProjectionRun;
    logContext?: Record<string, unknown>;
  } = $props();

  const { logger, base } = getLoggingContext();

  let open = $state(false);
  let stepIndex = $state(0);

  const debugData = $derived.by(() => {
    if (!browser) {
      return {
        eventDetails: {},
        configuration: {},
        steps: [] as any[]
      };
    }

    const projectionRun = run;
    const logFeature = typeof logContext?.feature === 'string' ? logContext.feature : undefined;
    const projectionYears =
      typeof logContext?.projection_years === 'number' ? logContext.projection_years : undefined;
    const contributionRuleCount =
      typeof logContext?.contribution_rule_count === 'number'
        ? logContext.contribution_rule_count
        : undefined;
    const mockRealData =
      typeof logContext?.mock_real_data === 'boolean' ? logContext.mock_real_data : undefined;
    const mockSeed =
      typeof logContext?.mock_seed === 'number' ? logContext.mock_seed : config.mockSeed;

    const contextualFields = {
      feature: logFeature,
      projection_years: projectionYears,
      contribution_rule_count: contributionRuleCount,
      mock_real_data: mockRealData,
      mock_seed: mockSeed
    };

    const eventDetails = {
      service_name: base.service_name,
      ...contextualFields,
      request_id: base.request_id,
      event_type: 'retirement_calc_step',
      outcome: 'success'
    };

    const configuration = {
      time_horizon_years: config.timeHorizonYears,
      start_date: config.startDate,
      current_balance: config.currentBalance,
      interest: config.interest,
      salary: config.salary,
      contributions_count: config.contributions.length,
      mock_seed: contextualFields.mock_seed
    };

    const steps = projectionRun.steps.map((step) => {
      const event = buildStepWideEventInput(config, step, eventDetails);
      logger.info(event);
      return event.step;
    });

    logger.info(
      buildRunWideEvent(config, projectionRun, eventDetails, {
        durationMs: 0,
        outcome: 'success'
      })
    );

    return {
      eventDetails,
      configuration,
      steps
    };
  });

  const stepCount = $derived(debugData.steps.length);
  const activeStep = $derived(debugData.steps[stepIndex] ?? null);

  function setStep(nextIndex: number) {
    const max = Math.max(0, debugData.steps.length - 1);
    stepIndex = Math.min(Math.max(0, nextIndex), max);
  }
</script>

<div class="fixed start-4 bottom-4 z-40">
  {#if !open}
    <Button.Root onclick={() => (open = true)}>
      <Bug class="size-4" />
      Open debugger
    </Button.Root>
  {/if}
</div>

{#if open}
  <DebuggerPanel
    {stepIndex}
    {stepCount}
    eventDetails={debugData.eventDetails}
    configuration={debugData.configuration}
    stepPayload={activeStep}
    onClose={() => (open = false)}
    onStepChange={setStep}
  />
{/if}
