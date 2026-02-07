export interface WideEventBase {
  service_name: string;
  service_version?: string;
  environment?: string;
  region?: string;
  instance_id?: string;
  commit_hash?: string;
  runtime?: string;
  request_id?: string;
  session_id?: string;
  run_id?: string;
}

export type LogLevel = 'info' | 'error';
export interface WideEvent extends WideEventBase {
  timestamp: string;
  level: LogLevel;
  event_type: string;
  outcome?: 'success' | 'error';
  duration_ms?: number;
  error?: {
    message: string;
    type?: string;
  };
  [key: string]: unknown;
}

export interface WideEventInput {
  request_id?: string;
  session_id?: string;
  run_id?: string;
  event_type: string;
  outcome?: 'success' | 'error';
  duration_ms?: number;
  error?: {
    message: string;
    type?: string;
  };
  [key: string]: unknown;
}

export interface WideEventLogger {
  info: (event: WideEventInput) => void;
  error: (event: WideEventInput) => void;
}

export interface LoggerOptions {
  base: WideEventBase;
  sink?: {
    info: (payload: string) => void;
    error: (payload: string) => void;
  };
  pretty?: boolean;
  indent?: number;
}

export function createWideEventLogger(options: LoggerOptions): WideEventLogger {
  const sink = options.sink ?? getDefaultSink();
  const base = options.base;
  const pretty = options.pretty ?? true;
  const indent = pretty ? (options.indent ?? 2) : undefined;

  return {
    info: (event) => {
      const payload: WideEvent = {
        ...base,
        ...event,
        timestamp: new Date().toISOString(),
        level: 'info',
      };
      sink.info(JSON.stringify(payload, null, indent));
    },
    error: (event) => {
      const payload: WideEvent = {
        ...base,
        ...event,
        timestamp: new Date().toISOString(),
        level: 'error',
      };
      sink.error(JSON.stringify(payload, null, indent));
    },
  };
}

export function getDefaultEnvironmentContext() {
  const nodeProcess = getNodeProcess();
  if (!nodeProcess) {
    return getBrowserEnvironmentContext();
  }

  return {
    environment: nodeProcess.env.NODE_ENV ?? 'development',
    region: nodeProcess.env.REGION,
    instance_id: nodeProcess.env.INSTANCE_ID,
    commit_hash: nodeProcess.env.COMMIT_SHA ?? nodeProcess.env.GIT_SHA,
    runtime: `node ${nodeProcess.versions.node}`,
  };
}

interface NavigatorLike {
  userAgent?: string;
  platform?: string;
  language?: string;
  languages?: readonly string[];
}

interface WindowLike {
  innerWidth?: number;
  innerHeight?: number;
}

function getBrowserEnvironmentContext() {
  const nav = getNavigator();
  const win = getWindow();
  const userAgent = nav?.userAgent;
  const browser = parseBrowser(userAgent);
  const timezone = getTimezone();

  return {
    environment: 'browser',
    runtime: browser.version ? `browser ${browser.name} ${browser.version}` : `browser ${browser.name}`,
    browser_name: browser.name,
    browser_version: browser.version,
    user_agent: userAgent,
    platform: nav?.platform,
    language: nav?.language,
    languages: nav?.languages,
    timezone,
    viewport: (win?.innerWidth && win?.innerHeight)
      ? `${win.innerWidth}x${win.innerHeight}`
      : undefined,
  };
}

interface NodeProcessLike {
  env: Record<string, string | undefined>;
  versions: { node: string };
  stdout?: { write: (chunk: string) => void };
  stderr?: { write: (chunk: string) => void };
}

function getNodeProcess(): NodeProcessLike | undefined {
  if (typeof process === 'undefined') return undefined;
  return process as unknown as NodeProcessLike;
}

function getNavigator(): NavigatorLike | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return navigator as unknown as NavigatorLike;
}

function getWindow(): WindowLike | undefined {
  if (typeof window === 'undefined') return undefined;
  return window as unknown as WindowLike;
}

function getTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  catch {
    return undefined;
  }
}

function parseBrowser(userAgent?: string): { name: string; version?: string } {
  if (!userAgent) return { name: 'unknown' };

  const rules: Array<{ name: string; regex: RegExp }> = [
    { name: 'Edge', regex: /Edg\/([\d.]+)/ },
    { name: 'Chrome', regex: /Chrome\/([\d.]+)/ },
    { name: 'Firefox', regex: /Firefox\/([\d.]+)/ },
    { name: 'Safari', regex: /Version\/([\d.]+).*Safari/ },
  ];

  for (const rule of rules) {
    const match = userAgent.match(rule.regex);
    if (match) {
      return { name: rule.name, version: match[1] };
    }
  }

  return { name: 'unknown' };
}

function getDefaultSink() {
  const nodeProcess = getNodeProcess();
  if (nodeProcess?.stdout && nodeProcess.stderr) {
    return {
      info: (payload: string) => nodeProcess.stdout?.write(`${payload}\n`),
      error: (payload: string) => nodeProcess.stderr?.write(`${payload}\n`),
    };
  }

  const consoleLike = typeof globalThis.console === 'undefined'
    ? undefined
    : (globalThis.console as unknown as { log: (msg: string) => void; error: (msg: string) => void });

  return {
    info: (payload: string) => consoleLike?.log(payload),
    error: (payload: string) => consoleLike?.error(payload),
  };
}
