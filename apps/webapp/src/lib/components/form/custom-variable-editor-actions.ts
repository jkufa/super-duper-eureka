import { TIMING_PARSE_ERROR_MESSAGE } from '$lib/forms/frequency-nlp';
import type { RetirementConfigFormValues } from '$lib/forms/retirement-config-form';
import {
  resolveParsedTimingOrStructured,
  toCustomVariableId,
  validateAndNormalizeCustomVariableInput,
} from './custom-variable-editor-model';

type CustomVariable = RetirementConfigFormValues['customVariables'][number];

interface BaseActionInput {
  currentYear: number;
  horizonYears: number;
  referenceDate: Date;
}

export interface CreateVariableActionInput extends BaseActionInput {
  name: string;
  type: CustomVariable['type'];
  amount: number;
  placement: CustomVariable['placement'];
  timingNaturalText: string;
  timing: {
    frequency: CustomVariable['frequency'];
    day: number;
    month: number;
    year: number;
    yearStart: number;
    yearEnd: number;
  };
  growth: {
    enabled: boolean;
    type: CustomVariable['growthType'];
    amount: number;
    cadence: CustomVariable['growthCadence'];
  };
}

export interface SaveVariableActionInput extends BaseActionInput {
  id: string;
  name: string;
  type: CustomVariable['type'];
  amount: number;
  placement: CustomVariable['placement'];
  timingNaturalText: string;
  timing: {
    frequency: CustomVariable['frequency'];
    day: number;
    month: number;
    year: number;
    yearStart: number;
    yearEnd: number;
  };
  growth: {
    enabled: boolean;
    type: CustomVariable['growthType'];
    amount: number;
    cadence: CustomVariable['growthCadence'];
  };
}

interface ActionResult { error: string | null }

interface CreateActionSuccess extends ActionResult { variable: CustomVariable }

interface SaveActionSuccess extends ActionResult { variable: CustomVariable }

interface ActionFailure extends ActionResult { variable: null }

function resolveAndNormalize(input: {
  name: string;
  type: CustomVariable['type'];
  amount: number;
  placement: CustomVariable['placement'];
  timingNaturalText: string;
  timing: {
    frequency: CustomVariable['frequency'];
    day: number;
    month: number;
    year: number;
    yearStart: number;
    yearEnd: number;
  };
  growth: {
    enabled: boolean;
    type: CustomVariable['growthType'];
    amount: number;
    cadence: CustomVariable['growthCadence'];
  };
  context: BaseActionInput;
}) {
  const parsedTiming = resolveParsedTimingOrStructured(
    input.timingNaturalText,
    {
      frequency: input.timing.frequency,
      day: input.timing.day,
      month: input.timing.month,
      year: input.timing.year,
      yearStart: input.timing.yearStart,
      yearEnd: input.timing.yearEnd,
    },
    {
      referenceDate: input.context.referenceDate,
      projectionStartYear: input.context.currentYear,
      horizonYears: input.context.horizonYears,
    },
  );

  if (!parsedTiming) {
    return { error: TIMING_PARSE_ERROR_MESSAGE, normalized: null };
  }

  const { error, normalized } = validateAndNormalizeCustomVariableInput({
    name: input.name,
    type: input.type,
    amount: input.amount,
    placement: input.placement,
    timingNaturalText: input.timingNaturalText,
    yearStart: input.timing.yearStart,
    yearEnd: input.timing.yearEnd,
    growthEnabled: input.growth.enabled,
    growthType: input.growth.type,
    growthAmount: input.growth.amount,
    growthCadence: input.growth.cadence,
    parsedTiming,
  });

  if (error || !normalized) {
    return { error, normalized: null };
  }

  return {
    error: null,
    normalized,
  };
}

export function buildCreatedCustomVariable(input: CreateVariableActionInput): CreateActionSuccess | ActionFailure {
  const resolved = resolveAndNormalize({
    name: input.name,
    type: input.type,
    amount: input.amount,
    placement: input.placement,
    timingNaturalText: input.timingNaturalText,
    timing: input.timing,
    growth: input.growth,
    context: input,
  });
  if (resolved.error || !resolved.normalized) {
    return {
      error: resolved.error,
      variable: null,
    };
  }

  return {
    error: null,
    variable: {
      id: toCustomVariableId(input.name),
      ...resolved.normalized,
      timingInputMode: 'hybrid',
    },
  };
}

export function buildSavedCustomVariable(input: SaveVariableActionInput): SaveActionSuccess | ActionFailure {
  const resolved = resolveAndNormalize({
    name: input.name,
    type: input.type,
    amount: input.amount,
    placement: input.placement,
    timingNaturalText: input.timingNaturalText,
    timing: input.timing,
    growth: input.growth,
    context: input,
  });
  if (resolved.error || !resolved.normalized) {
    return {
      error: resolved.error,
      variable: null,
    };
  }

  return {
    error: null,
    variable: {
      id: input.id,
      ...resolved.normalized,
      timingInputMode: 'hybrid',
    },
  };
}
