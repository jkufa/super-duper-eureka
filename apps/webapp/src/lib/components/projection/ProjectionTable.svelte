<script lang="ts">
  import type { ProjectionRun } from '@retirement/calculator';

  import { formatCurrency } from '$lib/formatters';
  import * as Table from '$lib/components/ui/table';

  let { run }: { run: ProjectionRun } = $props();

  const rows = $derived.by(() => {
    return run.projection.yearlyProjections.map((row, index, allRows) => {
      const previousContributions = index === 0 ? 0 : allRows[index - 1].contributions;
      return {
        ...row,
        yearContribution: row.contributions - previousContributions
      };
    });
  });

  const horizonYears = $derived(rows.length);
</script>

<div class="space-y-2">
  <h3 class="text-xl font-medium">Table View</h3>
  <Table.Root>
    <Table.Header
      class="sticky top-0 z-10 bg-background after:absolute after:bottom-0 after:w-full after:border-b after:border-border"
    >
      <Table.Row class="border-none">
        <Table.Head class="left-0 h-14 border-b">Year</Table.Head>
        <Table.Head class="h-14 border-b text-right">Salary</Table.Head>
        <Table.Head class="h-14 border-b text-right">Annual Contribution</Table.Head>
        <Table.Head class="h-14 border-b text-right">Portfolio Value</Table.Head>
        <Table.Head class="h-14 border-b text-right">Total Contributed</Table.Head>
        <Table.Head class="h-14 border-b text-right">Total Growth</Table.Head>
      </Table.Row>
    </Table.Header>

    <Table.Body>
      {#each rows as row (row.year)}
        {@const yearNumber = row.year + 1}
        {@const isMilestone =
          yearNumber === 1 || yearNumber === horizonYears || yearNumber % 5 === 0}
        {@const progressPercent = (yearNumber / horizonYears) * 100}
        <Table.Row class="group">
          <Table.Cell class="left-0">
            <div class="flex items-center gap-2 leading-6">
              <span class="font-mono text-xs font-medium text-muted-foreground uppercase">Year</span
              >
              <span class="font-semibold tabular-nums">{yearNumber}</span>
              {#if isMilestone}
                <span
                  class="size-1.5 rounded-full bg-growth/70"
                  aria-label={`Year ${yearNumber} milestone`}
                  title={`Year ${yearNumber} milestone`}
                ></span>
              {/if}
            </div>
            <div class="mt-1.5 h-1 w-full rounded-full bg-muted">
              <div
                class="h-full rounded-full bg-border"
                style={`width: ${progressPercent}%;`}
              ></div>
            </div>
          </Table.Cell>
          <Table.Cell class="text-right font-mono tabular-nums">
            {formatCurrency(row.salary)}
          </Table.Cell>
          <Table.Cell class="text-right font-mono tabular-nums">
            {formatCurrency(row.yearContribution)}
          </Table.Cell>
          <Table.Cell class="text-right font-mono tabular-nums">
            {formatCurrency(row.balance)}
          </Table.Cell>
          <Table.Cell class="text-right font-mono tabular-nums">
            {formatCurrency(row.contributions)}
          </Table.Cell>
          <Table.Cell class="text-right font-mono text-growth tabular-nums">
            +{formatCurrency(row.interest)}
          </Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>
</div>
