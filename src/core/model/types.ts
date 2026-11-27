export type Currency = string; // exactly three uppercase letters A-Z, enforced at construction

export interface Money {
  readonly minor: number;
  readonly currency: Currency;
}

export type Source = 'csv' | 'mobile-money-sms';

export interface Transaction {
  readonly id: string;
  readonly occurredOn: string; // Iso_Date "YYYY-MM-DD"
  readonly time?: string; // Time_Of_Day "HH:MM"
  readonly amount: Money;
  readonly description: string;
  readonly counterparty?: string;
  readonly source: Source;
  readonly reference?: string;
}

export interface Issue {
  readonly line: number;
  readonly message: string;
  readonly excerpt: string;
}

export type FormatId = 'csv' | 'mobile-money-sms' | 'unknown';

export interface ImportResult {
  readonly format: FormatId;
  readonly transactions: readonly Transaction[];
  readonly issues: readonly Issue[];
}

export type DateOrder = 'dmy' | 'mdy';

export interface ImportOptions {
  readonly format?: 'auto' | 'csv' | 'mobile-money-sms';
  readonly defaultCurrency?: Currency;
  readonly dateOrder?: DateOrder;
}

export type AmountFailureReason = 'invalid' | 'too-large';

export type ParseOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: AmountFailureReason };

export const FORMAT_LABELS: {
  readonly csv: string;
  readonly 'mobile-money-sms': string;
} = {
  csv: 'CSV',
  'mobile-money-sms': 'Mobile-money SMS',
};
