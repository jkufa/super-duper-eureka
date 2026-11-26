import type { Tooltip } from 'layerchart';
import { getContext, setContext, type Component, type ComponentProps, type Snippet } from 'svelte';

export const THEMES = { light: '', dark: '.dark' } as const;

type ChartConfigEntry = {
  label?: string;
  icon?: Component;
} & (
  | { color?: string; theme?: never }
  | { color?: never; theme: Record<keyof typeof THEMES, string> }
);

export type ChartConfig = Record<string, ChartConfigEntry>;

export type ExtractSnippetParams<T> = T extends Snippet<[infer P]> ? P : never;

export type TooltipPayload = ExtractSnippetParams<
  ComponentProps<typeof Tooltip.Root>['children']
>['payload'][number];

// Helper to extract item config from a payload.
export function getPayloadConfigFromPayload(
  config: ChartConfig,
  payload: TooltipPayload,
  key: string,
) {
  const nestedPayload
    = typeof payload.payload === 'object' && payload.payload !== null
      ? payload.payload as Record<string, unknown>
      : undefined;

  let configLabelKey: string = key;

  if (payload.key === key) {
    configLabelKey = payload.key;
  }
  else if (payload.name === key) {
    configLabelKey = payload.name;
  }
  else {
    const payloadRecord = payload as Record<string, unknown>;
    const payloadLabel = payloadRecord[key];
    if (typeof payloadLabel === 'string') {
      configLabelKey = payloadLabel;
    }
  }

  if (configLabelKey === key && nestedPayload) {
    const nestedPayloadLabel = nestedPayload[key];
    if (typeof nestedPayloadLabel === 'string') {
      configLabelKey = nestedPayloadLabel;
    }
  }

  return configLabelKey in config ? config[configLabelKey] : config[key];
}

interface ChartContextValue { config: ChartConfig }

const chartContextKey = Symbol('chart-context');

export function setChartContext(value: ChartContextValue) {
  return setContext(chartContextKey, value);
}

export function useChart() {
  return getContext<ChartContextValue>(chartContextKey);
}
