import { applyRetirementConfigFormValues, type RetirementConfigFormValues } from '$lib/forms/retirement-config-form';
import type { RetirementConfig } from '@retirement/calculator/types';
import { initRetirementConfigContext, type RetirementConfigContext } from './config-context.svelte';

interface CreateRetirementConfigStoreInput {
  baseConfig: RetirementConfig;
  committedValues: RetirementConfigFormValues;
  context?: RetirementConfigContext;
  persist?: boolean;
}

export function createRetirementConfigStore(input: CreateRetirementConfigStoreInput) {
  const context = input.context ?? initRetirementConfigContext();
  const liveConfig = applyRetirementConfigFormValues(input.baseConfig, input.committedValues);
  if (input.persist !== false) {
    context.setStoredConfig(liveConfig);
  }
  return liveConfig;
}
