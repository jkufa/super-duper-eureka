import { compareDates, daysInMonth, isLeapYear, parsePlainDate } from '../plain-date';
import type { PlainDate } from '../plain-date';
import { createSeededRandom } from '../random';

/** Whole-number draws from the seeded stream. Every value a case holds is built from these. */
export interface Draw {
  /** A whole number from `lo` to `hi`, both included. */
  int: (lo: number, hi: number) => number;
  /** True `percent` times in 100. */
  chance: (percent: number) => boolean;
  pick: <T>(items: ReadonlyArray<T>) => T;
}

export function makeDraw(seed: number): Draw {
  const next = createSeededRandom(seed);
  const int = (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1));
  return {
    int,
    chance: (percent) => int(1, 100) <= percent,
    pick: (items) => itemAt(items, int(0, items.length - 1))
  };
}

export function itemAt<T>(items: ReadonlyArray<T>, index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new RangeError(`No item at ${String(index)} of ${String(items.length)}.`);
  }
  return item;
}

/** Days since 1 March of year 0, by the civil-calendar algorithm on whole numbers. */
export function dayNumber({ year, month, day }: PlainDate): number {
  const shiftedYear = month <= 2 ? year - 1 : year;
  const era = Math.floor(shiftedYear / 400);
  const yearOfEra = shiftedYear - era * 400;
  const dayOfYear = Math.floor((153 * (month > 2 ? month - 3 : month + 9) + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146_097 + dayOfEra;
}

export function fromDayNumber(days: number): PlainDate {
  const era = Math.floor(days / 146_097);
  const dayOfEra = days - era * 146_097;
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1460) +
      Math.floor(dayOfEra / 36_524) -
      Math.floor(dayOfEra / 146_096)) /
      365
  );
  const dayOfYear =
    dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const shiftedMonth = Math.floor((5 * dayOfYear + 2) / 153);
  const month = shiftedMonth < 10 ? shiftedMonth + 3 : shiftedMonth - 9;
  return {
    year: yearOfEra + era * 400 + (month <= 2 ? 1 : 0),
    month,
    day: dayOfYear - Math.floor((153 * shiftedMonth + 2) / 5) + 1
  };
}

export function addDays(date: PlainDate, days: number): PlainDate {
  return fromDayNumber(dayNumber(date) + days);
}

export function daysBetween(from: PlainDate, to: PlainDate): number {
  return dayNumber(to) - dayNumber(from);
}

/** A date from `from` up to, and not including, `to`. `from` when the range is empty. */
export function dateIn(draw: Draw, from: PlainDate, to: PlainDate): PlainDate {
  return addDays(from, draw.int(0, Math.max(0, daysBetween(from, to) - 1)));
}

export function lastDayOf(date: PlainDate): PlainDate {
  return { ...date, day: daysInMonth(date.year, date.month) };
}

/** The latest 29 February on or before `date`. */
export function leapDayOnOrBefore(date: PlainDate): PlainDate {
  let year = date.year;
  while (!isLeapYear(year) || compareDates({ year, month: 2, day: 29 }, date) > 0) {
    year -= 1;
  }
  return { year, month: 2, day: 29 };
}

/** A date the generator wrote itself, read back. */
export function dateOf(text: string): PlainDate {
  const date = parsePlainDate(text);
  if (!date) {
    throw new RangeError(`A generated date is not valid: ${text}.`);
  }
  return date;
}
