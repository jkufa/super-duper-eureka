import type { ParsedCustomVariableTiming } from '$lib/forms/frequency-nlp';

export type TimingTarget = 'draft' | 'edit';

interface TimingParseControllerConfig {
  debounceMs: number;
  parse: (text: string) => ParsedCustomVariableTiming | null;
  onParsed: (target: TimingTarget, parsed: ParsedCustomVariableTiming) => void;
  onParseError: (target: TimingTarget) => void;
  onInfoClear: (target: TimingTarget) => void;
}

export function createTimingParseController(config: TimingParseControllerConfig) {
  const timers: Record<TimingTarget, ReturnType<typeof setTimeout> | null> = {
    draft: null,
    edit: null,
  };

  function clearTimer(target: TimingTarget) {
    if (!timers[target]) return;
    clearTimeout(timers[target]);
    timers[target] = null;
  }

  function applyParsedTiming(
    target: TimingTarget,
    text: string,
    options?: { silentOnFailure?: boolean },
  ) {
    const parsed = config.parse(text);
    if (!parsed) {
      if (options?.silentOnFailure) return;
      config.onParseError(target);
      return;
    }
    config.onParsed(target, parsed);
  }

  function schedule(target: TimingTarget, text: string) {
    const trimmed = text.trim();
    clearTimer(target);

    if (trimmed.length < 4) {
      config.onInfoClear(target);
      return;
    }

    timers[target] = setTimeout(() => {
      applyParsedTiming(target, text, { silentOnFailure: true });
      timers[target] = null;
    }, config.debounceMs);
  }

  function flush(target: TimingTarget, text: string) {
    clearTimer(target);
    applyParsedTiming(target, text);
  }

  function cleanup() {
    clearTimer('draft');
    clearTimer('edit');
  }

  return {
    schedule,
    flush,
    cleanup,
  };
}
