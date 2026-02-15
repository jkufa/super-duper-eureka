<script lang="ts">
  import type { ProjectionRun } from '@retirement/calculator';

  import { formatCurrency } from '$lib/formatters';
  import * as Table from '$lib/components/ui/table';

  let { run, startYear }: { run: ProjectionRun; startYear: number } = $props();

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
  <h2 class="text-xl font-semibold tracking-tight">Projection Table</h2>
  <Table.Root>
    <Table.Header
      class="sticky -top-32 z-10 bg-background after:absolute after:bottom-0 after:w-full after:border-b after:border-border"
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
        {@const fullYear = startYear + row.year}
        {@const progressPercent = (yearNumber / horizonYears) * 100}
        <Table.Row class="group">
          <Table.Cell class="left-0">
            <div class="inline-flex flex-col gap-1">
              <div class="tabular-nums">
                {fullYear} <span class="font-semibold text-muted-foreground">({row.year})</span>
              </div>
              <div class="relative h-0.5 w-full bg-muted" aria-hidden="true">
                <div
                  class="absolute top-1/2 h-0.5 -translate-y-1/2 bg-border"
                  style={`width: ${progressPercent}%;`}
                ></div>
              </div>
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
