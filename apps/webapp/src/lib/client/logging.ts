import { getContext, setContext } from 'svelte';
import { get, writable } from 'svelte/store';
import type { WideEventInput } from '@retirement/logger';
import { logger } from '$lib/client/logger';

const LOGGING_CONTEXT_KEY = Symbol('client-logging-context');

type SharedContext = Record<string, unknown>;
type LogLevel = 'info' | 'error';

export interface ClientLoggingContext {
  info: (event: WideEventInput) => void;
  error: (event: WideEventInput) => void;
  setSharedContext: (context: SharedContext) => void;
  mergeSharedContext: (context: SharedContext) => void;
  clearSharedContext: () => void;
  getSharedContext: () => SharedContext;
  withScope: (scope: SharedContext) => Pick<ClientLoggingContext, 'info' | 'error'>;
}

function createClientLoggingContext(initialContext: SharedContext = {}): ClientLoggingContext {
  const sharedContext = writable<SharedContext>(initialContext);

  const emit = (level: LogLevel, event: WideEventInput) => {
    if (typeof window === 'undefined') return;
    const payload: WideEventInput = {
      ...get(sharedContext),
      ...event,
    };

    if (level === 'error') {
      logger.error(payload);
      return;
    }
    logger.info(payload);
  };

  return {
    info: (event) => { emit('info', event); },
    error: (event) => { emit('error', event); },
    setSharedContext: (context) => { sharedContext.set({ ...context }); },
    mergeSharedContext: (context) => { sharedContext.update(current => ({ ...current, ...context })); },
    clearSharedContext: () => { sharedContext.set({}); },
    getSharedContext: () => get(sharedContext),
    withScope: scope => ({
      info: (event) => { emit('info', { ...scope, ...event }); },
      error: (event) => { emit('error', { ...scope, ...event }); },
    }),
  };
}

export function provideClientLoggingContext(initialContext: SharedContext = {}): ClientLoggingContext {
  const context = createClientLoggingContext(initialContext);
  setContext(LOGGING_CONTEXT_KEY, context);
  return context;
}

export function useClientLoggingContext(): ClientLoggingContext {
  return getContext<ClientLoggingContext>(LOGGING_CONTEXT_KEY);
}
