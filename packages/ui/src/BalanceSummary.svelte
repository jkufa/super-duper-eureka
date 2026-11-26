<script lang="ts">
  import { calculateProjection, makeConfig } from '@retirement/calculator';

  const config = makeConfig({ currentBalance: 100_000, timeHorizonYears: 30 });
  const { finalBalance } = calculateProjection(config, config.interest.annualRate);
  const formatted = Math.round(finalBalance).toLocaleString('en-US');
</script>

<div class="summary">
  <div>Balance after {config.timeHorizonYears} years</div>
  <div class="balance">${formatted}</div>
</div>

<style>
  .summary {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .balance {
    font-size: 24px;
    font-weight: 600;
  }
</style>
