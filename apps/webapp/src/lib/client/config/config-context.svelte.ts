import { getContext, setContext } from 'svelte';
import type { RetirementConfig } from '@retirement/calculator/types';

const RETIREMENT_CONFIG_CONTEXT_KEY = Symbol('retirement-config-context');
const DEFAULT_STORAGE_KEY = 'retirement_webapp_retirement_config';

export interface RetirementConfigContext {
  storageKey: string;
  getStoredConfig: () => RetirementConfig | undefined;
  setStoredConfig: (config: RetirementConfig) => void;
  clearStoredConfig: () => void;
}

interface RetirementConfigContextOptions {
  storageKey?: string;
}

export function initRetirementConfigContext(
  options?: RetirementConfigContextOptions,
): RetirementConfigContext {
  const existing = getContext<RetirementConfigContext | undefined>(RETIREMENT_CONFIG_CONTEXT_KEY);
  if (existing) return existing;

  const storageKey = options?.storageKey ?? DEFAULT_STORAGE_KEY;

  const context: RetirementConfigContext = {
    storageKey,
    getStoredConfig() {
      if (typeof globalThis.localStorage === 'undefined') {
        return undefined;
      }

      try {
        const raw = globalThis.localStorage.getItem(storageKey);
        if (!raw) return undefined;

        const parsed = JSON.parse(raw);
        return isRetirementConfigLike(parsed) ? (parsed as RetirementConfig) : undefined;
      }
      catch {
        return undefined;
      }
    },
    setStoredConfig(config) {
      if (typeof globalThis.localStorage === 'undefined') {
        return;
      }

      try {
        globalThis.localStorage.setItem(storageKey, JSON.stringify(config));
      }
      catch {
        // Swallow storage write errors (quota, private mode, etc).
      }
    },
    clearStoredConfig() {
      if (typeof globalThis.localStorage === 'undefined') {
        return;
      }

      try {
        globalThis.localStorage.removeItem(storageKey);
      }
      catch {
        // Swallow storage errors to avoid breaking the app.
      }
    },
  };

  setContext(RETIREMENT_CONFIG_CONTEXT_KEY, context);
  return context;
}

export function getRetirementConfigContext(): RetirementConfigContext {
  const context = getContext<RetirementConfigContext | undefined>(RETIREMENT_CONFIG_CONTEXT_KEY);
  if (!context) {
    throw new Error('Retirement config context is not set. Call initRetirementConfigContext first.');
  }
  return context;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRetirementConfigLike(value: unknown): value is RetirementConfig {
  if (!isRecord(value)) return false;
  return (
    typeof value.currentBalance === 'number'
    && typeof value.timeHorizonYears === 'number'
    && isRecord(value.interest)
    && isRecord(value.salary)
    && Array.isArray(value.contributions)
  );
}
