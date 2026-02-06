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

export interface WideEvent extends WideEventBase {
  timestamp: string;
  level: 'info' | 'error';
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
  info: (event: Omit<WideEvent, 'level' | 'timestamp'>) => void;
  error: (event: Omit<WideEvent, 'level' | 'timestamp'>) => void;
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
    return {
      environment: 'browser',
      runtime: 'browser',
    };
  }

  return {
    environment: nodeProcess.env.NODE_ENV ?? 'development',
    region: nodeProcess.env.REGION,
    instance_id: nodeProcess.env.INSTANCE_ID,
    commit_hash: nodeProcess.env.COMMIT_SHA ?? nodeProcess.env.GIT_SHA,
    runtime: `node ${nodeProcess.versions.node}`,
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
