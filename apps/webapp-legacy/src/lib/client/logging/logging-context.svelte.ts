import { getContext, setContext } from 'svelte';
import { createWideEventLogger, getDefaultEnvironmentContext } from '@retirement/logger';
import type { WideEventBase, WideEventLogger } from '@retirement/logger';

const LOGGING_CONTEXT_KEY = Symbol('logging-context');

export interface LoggingContext {
  base: WideEventBase;
  logger: WideEventLogger;
}

interface LoggingContextOptions {
  base?: Partial<WideEventBase>;
  pretty?: boolean;
  indent?: number;
}

export function initLoggingContext(options?: LoggingContextOptions): LoggingContext {
  const existing = getContext<LoggingContext | undefined>(LOGGING_CONTEXT_KEY);
  if (existing) return existing;

  const requestId = options?.base?.request_id ?? randomId('req');
  const sessionId = options?.base?.session_id ?? getOrCreateSessionId();
  const runId = options?.base?.run_id ?? randomId('run');

  const base: WideEventBase = {
    ...getDefaultEnvironmentContext(),
    service_name: options?.base?.service_name ?? 'retirement-webapp',
    request_id: requestId,
    session_id: sessionId,
    run_id: runId,
    ...options?.base,
  };

  const logger = createWideEventLogger({
    base,
    pretty: options?.pretty,
    indent: options?.indent,
  });

  const context: LoggingContext = { base, logger };
  setContext(LOGGING_CONTEXT_KEY, context);
  return context;
}

export function getLoggingContext(): LoggingContext {
  const context = getContext<LoggingContext | undefined>(LOGGING_CONTEXT_KEY);
  if (!context) {
    throw new Error('Logging context is not set. Call initLoggingContext first.');
  }
  return context;
}

function randomId(prefix: string) {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function getOrCreateSessionId() {
  const fallback = randomId('session');
  if (typeof globalThis.sessionStorage === 'undefined') {
    return fallback;
  }

  try {
    const key = 'retirement_webapp_session_id';
    const existing = globalThis.sessionStorage.getItem(key);
    if (existing) return existing;
    globalThis.sessionStorage.setItem(key, fallback);
    return fallback;
  }
  catch {
    return fallback;
  }
}
