export interface WideEventBase {
  service_name: string;
  service_version?: string;
  environment?: string;
  region?: string;
  instance_id?: string;
  commit_hash?: string;
  runtime?: string;
  browser_name?: string;
  browser_version?: string;
  user_agent?: string;
  platform?: string;
  language?: string;
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
  info: (event: WideEventInput) => WideEvent;
  error: (event: WideEventInput) => WideEvent;
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
      return payload;
    },
    error: (event) => {
      const payload: WideEvent = {
        ...base,
        ...event,
        timestamp: new Date().toISOString(),
        level: 'error',
      };
      sink.error(JSON.stringify(payload, null, indent));
      return payload;
    },
  };
}

export function getDefaultEnvironmentContext(): Partial<WideEventBase> {
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
  userAgentData?: NavigatorUADataLike;
}

interface NavigatorUADataLike {
  brands?: readonly { brand: string; version: string }[];
  platform?: string;
  mobile?: boolean;
}

function getBrowserEnvironmentContext(): Partial<WideEventBase> {
  const nav = getNavigator();
  const userAgent = nav?.userAgent;
  const uaData = nav?.userAgentData;
  const brand = pickBrowserBrand(uaData?.brands);
  const browserName = brand?.brand;
  const browserVersion = brand?.version;
  const runtime = browserName
    ? (browserVersion ? `browser ${browserName} ${browserVersion}` : `browser ${browserName}`)
    : 'browser';
  return {
    environment: 'browser',
    runtime,
    browser_name: browserName,
    browser_version: browserVersion,
    user_agent: userAgent,
    platform: uaData?.platform ?? nav?.platform,
    language: nav?.language,
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

function pickBrowserBrand(
  brands?: readonly { brand: string; version: string }[],
): { brand: string; version: string } | undefined {
  if (!brands) return undefined;
  for (const entry of brands) {
    const brand = entry.brand.trim();
    if (brand && brand.toLowerCase() !== 'not.a/brand') {
      return entry;
    }
  }
  return brands[0];
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
