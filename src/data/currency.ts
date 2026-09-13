export interface CurrencyConfig {
  code: string;
  symbol: string;
  name: string;
  rateAgainstEUR: number;
}

export const CURRENCIES: CurrencyConfig[] = [
  { code: 'MAD', symbol: 'DH', name: 'Moroccan Dirham', rateAgainstEUR: 10.8 },
  { code: 'EUR', symbol: '€', name: 'Euro', rateAgainstEUR: 1.0 },
  { code: 'USD', symbol: '$', name: 'US Dollar', rateAgainstEUR: 1.08 },
  { code: 'GBP', symbol: '£', name: 'British Pound', rateAgainstEUR: 0.85 },
  { code: 'SAR', symbol: 'SR', name: 'Saudi Riyal', rateAgainstEUR: 4.05 },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham', rateAgainstEUR: 3.97 },
];

export function formatCurrency(
  amountInEUR: number,
  targetCurrencyCode: string = 'MAD',
  language: string = 'en'
): string {
  const config = CURRENCIES.find((c) => c.code === targetCurrencyCode) || CURRENCIES[0];
  const converted = Math.round(amountInEUR * config.rateAgainstEUR);

  if (language === 'ar') {
    return `${converted} ${config.symbol}`;
  }
  return `${config.symbol} ${converted.toLocaleString()}`;
}

export function formatPriceLevel(
  level: '$' | '$$' | '$$$' | '$$$$' | undefined,
  currencyCode: string = 'MAD'
): string {
  if (!level) return '—';
  return level;
}
