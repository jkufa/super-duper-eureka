const DEFAULT_LOCALE = 'en-US';

export const currencyFormatOptions = {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
} as const satisfies Intl.NumberFormatOptions;

export const compactNumberFormatOptions = {
  notation: 'compact',
  maximumFractionDigits: 1,
} as const satisfies Intl.NumberFormatOptions;

export const currencyFormatter = new Intl.NumberFormat(DEFAULT_LOCALE, currencyFormatOptions);
export const compactNumberFormatter = new Intl.NumberFormat(
  DEFAULT_LOCALE,
  compactNumberFormatOptions,
);

export function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

export function formatCompactNumber(value: number) {
  return compactNumberFormatter.format(value);
}
