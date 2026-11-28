import { describe, expect, it } from 'vitest';
import * as barrel from './index';

const EXPECTED_NAMES = [
  'AMOUNT_LIMIT',
  'ISSUES',
  'MASK_TOKEN',
  'addMoney',
  'buildExcerpt',
  'createMoney',
  'currencyExponent',
  'detectFormat',
  'fnv1a32Hex',
  'formatMoney',
  'importText',
  'isLeapYear',
  'isValidCalendarDate',
  'maskText',
  'parseAmountText',
  'parseDate',
  'parseTime',
];

describe('core barrel', () => {
  it('Req 21.1: exports exactly the documented runtime names', () => {
    expect(Object.keys(barrel).sort()).toEqual([...EXPECTED_NAMES].sort());
  });

  it('Req 21.2: exports no Test_Only_Helper or internal helper', () => {
    const names = Object.keys(barrel);
    const forbidden = [
      'writeCsv',
      'writeCsvRow',
      'writeCsvField',
      'writePaidSms',
      'formatKsh',
      'delimiterArb',
      'groupArb',
      'parseCsv',
      'parseSms',
      'readCsv',
      'FORMAT_LABELS',
      'isAsciiDigit',
    ];
    for (const name of forbidden) {
      expect(names).not.toContain(name);
    }
    for (const name of names) {
      expect(name.endsWith('Arb')).toBe(false);
      expect(name.startsWith('write')).toBe(false);
    }
  });
});
