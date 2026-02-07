<script lang="ts">
  import { Bug } from '@lucide/svelte';
  import * as Button from '$lib/components/ui/button';

  import DebuggerPanel from './DebuggerPanel.svelte';

  type SimulationStep = {
    step_index: number;
    year_index: number;
    month_index: number;
    balance_start: number;
    balance_end: number;
    interest_earned: number;
    contributions_this_step: number;
    active_contributions: Array<{
      id: string;
      type: string;
      amount: number;
      timing: {
        frequency: string;
        placement: string;
      };
    }>;
  };

  const eventDetails = {
    service_name: 'retirement-cli',
    request_id: '43be2c15-9866-4455-9890-0b3ab9dde778',
    session_id: 'd3d72f36-1dda-4adf-93c5-f8caa883bb97',
    run_id: '716b5b0a-2981-4e4f-b90f-28c25392628c',
    environment: 'development',
    runtime: 'node 24.3.0',
    event_type: 'retirement_calc_step',
    outcome: 'success'
  };

  const configuration = {
    time_horizon_years: 20,
    start_date: '2026-01-01T00:00:00.000Z',
    current_balance: 75000,
    interest: {
      annualRate: 0.05,
      variance: 0.01,
      compounding: 'monthly'
    },
    salary: {
      annualBase: 110000,
      annualRaiseRate: 0.03
    },
    contributions_count: 2
  };

  const steps: SimulationStep[] = [
    {
      step_index: 0,
      year_index: 0,
      month_index: 0,
      balance_start: 75000,
      balance_end: 76357.8,
      interest_earned: 307.8,
      contributions_this_step: 1050,
      active_contributions: [
        {
          id: '401k',
          type: 'salaryPercent',
          amount: 550,
          timing: { frequency: 'monthly', placement: 'start' }
        },
        {
          id: 'roth',
          type: 'flat',
          amount: 500,
          timing: { frequency: 'monthly', placement: 'end' }
        }
      ]
    },
    {
      step_index: 1,
      year_index: 0,
      month_index: 1,
      balance_start: 76357.8,
      balance_end: 77722.32,
      interest_earned: 314.52,
      contributions_this_step: 1050,
      active_contributions: [
        {
          id: '401k',
          type: 'salaryPercent',
          amount: 550,
          timing: { frequency: 'monthly', placement: 'start' }
        },
        {
          id: 'roth',
          type: 'flat',
          amount: 500,
          timing: { frequency: 'monthly', placement: 'end' }
        }
      ]
    },
    {
      step_index: 2,
      year_index: 0,
      month_index: 2,
      balance_start: 77722.32,
      balance_end: 79093.66,
      interest_earned: 321.34,
      contributions_this_step: 1050,
      active_contributions: [
        {
          id: '401k',
          type: 'salaryPercent',
          amount: 550,
          timing: { frequency: 'monthly', placement: 'start' }
        },
        {
          id: 'roth',
          type: 'flat',
          amount: 500,
          timing: { frequency: 'monthly', placement: 'end' }
        }
      ]
    }
  ];

  let open = $state(true);
  let stepIndex = $state(0);

  const activeStep = $derived(steps[stepIndex]);

  function setStep(nextIndex: number) {
    stepIndex = Math.min(Math.max(0, nextIndex), steps.length - 1);
  }
</script>

<div class="fixed right-4 bottom-4 z-40">
  {#if !open}
    <Button.Root onclick={() => (open = true)}>
      <Bug class="size-4" />
      Open debugger
    </Button.Root>
  {/if}
</div>

<DebuggerPanel
  {open}
  {stepIndex}
  stepCount={steps.length}
  {eventDetails}
  {configuration}
  stepPayload={activeStep}
  onClose={() => (open = false)}
  onStepChange={setStep}
/>
