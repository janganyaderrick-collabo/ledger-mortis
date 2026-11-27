import { describe, it, expect } from 'vitest';
import { FORMAT_LABELS } from './types';
import type {
  Currency,
  Money,
  Source,
  Transaction,
  Issue,
  FormatId,
  ImportResult,
  DateOrder,
  ImportOptions,
  AmountFailureReason,
  ParseOutcome,
} from './types';

describe('types', () => {
  it('Req 7.1, 7.2: a Transaction has the documented fields and both sources compile', () => {
    const currency: Currency = 'USD';
    const amount: Money = { minor: -500, currency };
    const minimal: Transaction = {
      id: 'tx-00000000',
      occurredOn: '2026-01-31',
      amount,
      description: 'Coffee',
      source: 'csv',
    };
    const full: Transaction = {
      ...minimal,
      time: '09:05',
      counterparty: 'Crypt Cafe',
      reference: 'ABCDEFGHIJ',
      source: 'mobile-money-sms',
    };
    const sources: Source[] = [minimal.source, full.source];
    expect(sources).toEqual(['csv', 'mobile-money-sms']);
    expect(full.time).toBe('09:05');
  });

  it('Req 7.3, 7.4: ImportResult and Issue have the documented shape', () => {
    const issue: Issue = { line: 1, message: 'Empty input', excerpt: '' };
    const formats: FormatId[] = ['csv', 'mobile-money-sms', 'unknown'];
    const result: ImportResult = {
      format: formats[2] ?? 'unknown',
      transactions: [],
      issues: [issue],
    };
    expect(result.issues[0]?.line).toBe(1);
    expect(formats).toHaveLength(3);
  });

  it('Req 7.3: ImportOptions, DateOrder, AmountFailureReason and ParseOutcome compile with every member', () => {
    const order: DateOrder = 'mdy';
    const options: ImportOptions = { format: 'auto', defaultCurrency: 'KES', dateOrder: order };
    const empty: ImportOptions = {};
    const failure: AmountFailureReason = 'too-large';
    const good: ParseOutcome<number> = { ok: true, value: 1 };
    const bad: ParseOutcome<number> = { ok: false, reason: failure };
    expect(options.dateOrder).toBe('mdy');
    expect(Object.keys(empty)).toHaveLength(0);
    expect(good.ok).toBe(true);
    expect(bad.ok ? 'ok' : bad.reason).toBe('too-large');
  });

  it('Req 7.7: FORMAT_LABELS has the user-facing labels of the two formats', () => {
    expect(FORMAT_LABELS.csv).toBe('CSV');
    expect(FORMAT_LABELS['mobile-money-sms']).toBe('Mobile-money SMS');
    expect(Object.keys(FORMAT_LABELS)).toHaveLength(2);
  });
});
