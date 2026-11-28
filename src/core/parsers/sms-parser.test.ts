import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildHashInput, fnv1a32Hex } from '../model/ids';
import { ISSUES } from '../model/issues';
import { buildExcerpt, maskText } from '../model/masking';
import { parseAmountText } from '../model/money';
import type { Transaction } from '../model/types';
import { hasMessageStart, parseSms } from './sms-parser';
import {
  balanceSentence,
  costSentence,
  countLineFeeds,
  formatKsh,
  separatorArb,
  writeAirtimeSms,
  writePaidSms,
  writeReceivedSms,
  writeReversalSms,
  writeSentSms,
  writeWithdrawnSms,
} from './sms-parser.testkit';
import type { NamedSmsFields, SmsFields } from './sms-parser.testkit';

const RUNS = { numRuns: 200 };

interface Expected {
  readonly occurredOn: string;
  readonly time: string;
  readonly minor: number;
  readonly description: string;
  readonly counterparty?: string;
  readonly reference: string;
}

// An expected Transaction with the id blanked, so that toStrictEqual also checks absent fields.
function tx(e: Expected): Transaction {
  return {
    id: '',
    occurredOn: e.occurredOn,
    time: e.time,
    amount: { minor: e.minor, currency: 'KES' },
    description: e.description,
    ...(e.counterparty === undefined ? {} : { counterparty: e.counterparty }),
    source: 'mobile-money-sms',
    reference: e.reference,
  };
}

function costTx(
  e: Pick<Expected, 'occurredOn' | 'time' | 'reference'> & { minor: number },
): Transaction {
  return tx({ ...e, description: 'Transaction cost' });
}

function parsed(text: string): {
  transactions: Transaction[];
  issues: ReturnType<typeof parseSms>['issues'];
} {
  const result = parseSms(text);
  return {
    transactions: result.transactions.map((t) => ({ ...t, id: '' })),
    issues: result.issues,
  };
}

const CODE = 'QA12BC34DE';
const BASE: SmsFields = {
  code: CODE,
  amount: 'Ksh1,250.00',
  date: '5/11/26',
  time: '6:42 PM',
};
const NOV5 = { occurredOn: '2026-11-05', time: '18:42', reference: CODE };

function named(name: string, over: Partial<NamedSmsFields> = {}): NamedSmsFields {
  return { ...BASE, name, ...over };
}

// The excerpt of a short single-line message that holds no long digit group.
function cut(text: string): string {
  return text.slice(0, 60);
}

function issueOnly(text: string, line: number, message: string): void {
  expect(parsed(text)).toStrictEqual({
    transactions: [],
    issues: [{ line, message, excerpt: cut(text) }],
  });
}

const EXAMPLE_MESSAGES: readonly string[] = [
  'QA12BC34DE Confirmed. Ksh1,250.00 paid to Moonlight Grocers on 5/11/26 at 6:42 PM. New balance is Ksh8,420.50. Transaction cost, Ksh0.00.',
  'QA12BC34DF Confirmed. Ksh500.00 sent to Ada Wanjiru 0700123456 on 6/11/26 at 9:05 AM. New balance is Ksh7,915.50. Transaction cost, Ksh5.00.',
  'QA12BC34DG Confirmed. You have received Ksh3,000.00 from Kofi Mensah 0711000222 on 7/11/26 at 2:30 PM. New balance is Ksh10,915.50.',
  'QA12BC34DH Confirmed. You bought Ksh100.00 of airtime on 7/11/26 at 2:35 PM. New balance is Ksh10,815.50.',
  'QA12BC34DJ Confirmed. Ksh2,000.00 withdrawn from Agent Lakeside Shop on 8/11/26 at 10:15 AM. New balance is Ksh8,815.50. Transaction cost, Ksh29.00.',
  'QA12BC34DK Confirmed. Reversal of QA12BC34DE completed. Ksh1,250.00 credited to your account on 9/11/26 at 8:00 AM. New balance is Ksh10,065.50.',
];

const EXAMPLE_EXPECTED: readonly Transaction[] = [
  tx({
    occurredOn: '2026-11-05',
    time: '18:42',
    minor: -125000,
    description: 'Moonlight Grocers',
    counterparty: 'Moonlight Grocers',
    reference: 'QA12BC34DE',
  }),
  tx({
    occurredOn: '2026-11-06',
    time: '09:05',
    minor: -50000,
    description: 'Ada Wanjiru',
    counterparty: 'Ada Wanjiru',
    reference: 'QA12BC34DF',
  }),
  costTx({ occurredOn: '2026-11-06', time: '09:05', reference: 'QA12BC34DF', minor: -500 }),
  tx({
    occurredOn: '2026-11-07',
    time: '14:30',
    minor: 300000,
    description: 'Kofi Mensah',
    counterparty: 'Kofi Mensah',
    reference: 'QA12BC34DG',
  }),
  tx({
    occurredOn: '2026-11-07',
    time: '14:35',
    minor: -10000,
    description: 'Airtime',
    reference: 'QA12BC34DH',
  }),
  tx({
    occurredOn: '2026-11-08',
    time: '10:15',
    minor: -200000,
    description: 'Agent Lakeside Shop',
    counterparty: 'Agent Lakeside Shop',
    reference: 'QA12BC34DJ',
  }),
  costTx({ occurredOn: '2026-11-08', time: '10:15', reference: 'QA12BC34DJ', minor: -2900 }),
  tx({
    occurredOn: '2026-11-09',
    time: '08:00',
    minor: 125000,
    description: 'Reversal of QA12BC34DE',
    reference: 'QA12BC34DK',
  }),
];

describe('the six example messages', () => {
  it('Req 13.15, 20.12: parse in one text to the eight amounts, in order, with fields and costs', () => {
    const result = parsed(EXAMPLE_MESSAGES.join('\n'));
    expect(result.issues).toStrictEqual([]);
    expect(result.transactions).toStrictEqual(EXAMPLE_EXPECTED);
    expect(result.transactions.map((t) => t.amount.minor)).toStrictEqual([
      -125000, -50000, -500, 300000, -10000, -200000, -2900, 125000,
    ]);
  });

  it('Req 13.15, 14.3, 14.5: the cost transactions follow their parents, and the zero cost makes none', () => {
    const result = parseSms(EXAMPLE_MESSAGES.join(' '));
    expect(result.transactions).toHaveLength(8);
    expect(result.transactions[2]?.description).toBe('Transaction cost');
    expect(result.transactions[1]?.reference).toBe(result.transactions[2]?.reference);
    expect(result.transactions[6]?.description).toBe('Transaction cost');
    expect(result.transactions[0]?.description).toBe('Moonlight Grocers');
  });

  it('Req 14.8, 6.1: ids are the hash of source, date, minor amount, currency and description', () => {
    const result = parseSms(EXAMPLE_MESSAGES.join('\n'));
    const idOf = (date: string, minor: number, description: string): string =>
      'tx-' +
      fnv1a32Hex(buildHashInput('mobile-money-sms', date, String(minor), 'KES', description));
    expect(result.transactions[0]?.id).toBe(idOf('2026-11-05', -125000, 'Moonlight Grocers'));
    expect(result.transactions[2]?.id).toBe(idOf('2026-11-06', -500, 'Transaction cost'));
    expect(new Set(result.transactions.map((t) => t.id)).size).toBe(8);
  });

  it('Req 14.8, 6.4: identical messages get distinct ids and the same text parses the same twice', () => {
    const text = writePaidSms(named('Ada')) + '\n' + writePaidSms(named('Ada'));
    const first = parseSms(text);
    const base = first.transactions[0]?.id ?? '';
    expect(first.transactions[1]?.id).toBe(base + '-2');
    expect(parseSms(text)).toStrictEqual(first);
  });
});

interface KindCase {
  readonly label: string;
  readonly write: (extras: Pick<SmsFields, 'balance' | 'cost'>) => string;
  readonly parent: Transaction;
}

const KINDS: readonly KindCase[] = [
  {
    label: 'paid to',
    write: (x) => writePaidSms(named('Moonlight Grocers', x)),
    parent: tx({
      ...NOV5,
      minor: -125000,
      description: 'Moonlight Grocers',
      counterparty: 'Moonlight Grocers',
    }),
  },
  {
    label: 'sent to',
    write: (x) => writeSentSms(named('Ada Wanjiru', x)),
    parent: tx({
      ...NOV5,
      minor: -125000,
      description: 'Ada Wanjiru',
      counterparty: 'Ada Wanjiru',
    }),
  },
  {
    label: 'received from',
    write: (x) => writeReceivedSms(named('Kofi Mensah', x)),
    parent: tx({ ...NOV5, minor: 125000, description: 'Kofi Mensah', counterparty: 'Kofi Mensah' }),
  },
  {
    label: 'airtime',
    write: (x) => writeAirtimeSms({ ...BASE, ...x }),
    parent: tx({ ...NOV5, minor: -125000, description: 'Airtime' }),
  },
  {
    label: 'withdrawn from',
    write: (x) => writeWithdrawnSms(named('Agent Lakeside Shop', x)),
    parent: tx({
      ...NOV5,
      minor: -125000,
      description: 'Agent Lakeside Shop',
      counterparty: 'Agent Lakeside Shop',
    }),
  },
  {
    label: 'reversal',
    write: (x) => writeReversalSms({ ...BASE, reversedCode: 'QA12BC34DF', ...x }),
    parent: tx({ ...NOV5, minor: 125000, description: 'Reversal of QA12BC34DF' }),
  },
];

const BALANCE_VARIANTS: readonly (string | undefined)[] = [
  undefined,
  'New balance is Ksh8,420.50.',
  'New Wallet balance is Ksh8,420.50.',
  'new balance is Ksh8,420.50.',
  'NEW WALLET BALANCE IS KES8.00.',
  'New balance is anything at all.',
];

describe('each kind alone', () => {
  for (const kind of KINDS) {
    it(`Req 13.1 to 13.6, 13.11, 13.12: ${kind.label} gives exactly one transaction`, () => {
      expect(parsed(kind.write({}))).toStrictEqual({ transactions: [kind.parent], issues: [] });
    });

    it(`Req 14.1, 14.2, 12.7: ${kind.label} ignores an absent, lower-case or worded balance sentence`, () => {
      for (const balance of BALANCE_VARIANTS) {
        expect(parsed(kind.write({ balance }))).toStrictEqual({
          transactions: [kind.parent],
          issues: [],
        });
      }
    });

    it(`Req 14.3, 14.5: ${kind.label} with a cost puts the cost transaction right after the parent`, () => {
      const cost = costTx({
        occurredOn: '2026-11-05',
        time: '18:42',
        reference: CODE,
        minor: -500,
      });
      expect(
        parsed(
          kind.write({ balance: 'New balance is Ksh1.00.', cost: 'Transaction cost, Ksh5.00.' }),
        ),
      ).toStrictEqual({
        transactions: [kind.parent, cost],
        issues: [],
      });
    });
  }

  it('Req 12.7, 12.8, 13.1 to 13.6: keywords in mixed case match and names keep their case', () => {
    const cases: readonly [string, Transaction[]][] = [
      [
        'QA12BC34DE CONFIRMED. kSh1,250.00 PAID To mOONlight GrOcers oN 5/11/26 aT 6:42 pM. nEw BALANCE iS Ksh8.00. TRANSACTION cost, ksh5.00.',
        [
          tx({
            ...NOV5,
            minor: -125000,
            description: 'mOONlight GrOcers',
            counterparty: 'mOONlight GrOcers',
          }),
          costTx({ ...NOV5, minor: -500 }),
        ],
      ],
      [
        'QA12BC34DE Confirmed. KES500.00 SENT TO aDA wANJIRU ON 6/11/26 AT 9:05 am.',
        [
          tx({
            occurredOn: '2026-11-06',
            time: '09:05',
            reference: CODE,
            minor: -50000,
            description: 'aDA wANJIRU',
            counterparty: 'aDA wANJIRU',
          }),
        ],
      ],
      [
        'QA12BC34DE CONFIRMED. YOU HAVE RECEIVED kes3,000.00 FROM kofi MENSAH ON 7/11/26 AT 2:30 pm.',
        [
          tx({
            occurredOn: '2026-11-07',
            time: '14:30',
            reference: CODE,
            minor: 300000,
            description: 'kofi MENSAH',
            counterparty: 'kofi MENSAH',
          }),
        ],
      ],
      [
        'QA12BC34DE confirmed. YOU BOUGHT ksh100.00 OF AIRTIME ON 7/11/26 AT 2:35 PM.',
        [
          tx({
            occurredOn: '2026-11-07',
            time: '14:35',
            reference: CODE,
            minor: -10000,
            description: 'Airtime',
          }),
        ],
      ],
      [
        'QA12BC34DE Confirmed. KSH2,000.00 WITHDRAWN FROM aGENT lakeside ON 8/11/26 AT 10:15 AM.',
        [
          tx({
            occurredOn: '2026-11-08',
            time: '10:15',
            reference: CODE,
            minor: -200000,
            description: 'aGENT lakeside',
            counterparty: 'aGENT lakeside',
          }),
        ],
      ],
      [
        'QA12BC34DE Confirmed. REVERSAL OF QA12BC34DF COMPLETED. ksh1,250.00 CREDITED TO YOUR ACCOUNT ON 9/11/26 AT 8:00 AM.',
        [
          tx({
            occurredOn: '2026-11-09',
            time: '08:00',
            reference: CODE,
            minor: 125000,
            description: 'Reversal of QA12BC34DF',
          }),
        ],
      ],
    ];
    for (const [text, expected] of cases) {
      expect(parsed(text)).toStrictEqual({ transactions: expected, issues: [] });
    }
  });
});

describe('segmentation', () => {
  const ADA = writePaidSms(named('Ada', { amount: 'Ksh1.00' }));
  const adaTx = tx({ ...NOV5, minor: -100, description: 'Ada', counterparty: 'Ada' });

  it('Req 12.1: a Message_Code with a lower-case letter starts no message', () => {
    const text = 'QA12bC34DE Confirmed. Ksh1.00 paid to Ada on 5/11/26 at 6:42 PM.';
    expect(hasMessageStart(text)).toBe(false);
    issueOnly(text, 1, ISSUES.unexpectedTextBeforeFirstMessage);
  });

  it('Req 12.1: an 11-character run, a 9-character run, or a code preceded by a letter or digit starts no message', () => {
    for (const code of ['QA12BC34DEF', 'QA12BC34D', 'xQA12BC34DE', '7QA12BC34DE']) {
      const text = `${code} Confirmed. Ksh1.00 paid to Ada on 5/11/26 at 6:42 PM.`;
      expect(hasMessageStart(text)).toBe(false);
      issueOnly(text, 1, ISSUES.unexpectedTextBeforeFirstMessage);
    }
  });

  it('Req 12.1, 12.3: a code preceded by a hyphen does start a message and the hyphen is text before it', () => {
    expect(hasMessageStart('-' + ADA)).toBe(true);
    expect(parsed('-' + ADA)).toStrictEqual({
      transactions: [adaTx],
      issues: [{ line: 1, message: ISSUES.unexpectedTextBeforeFirstMessage, excerpt: '-' }],
    });
  });

  it('Req 12.1: "Confirmed." may stand on the next line after a line break', () => {
    const text = 'QA12BC34DE\r\n\r\nConfirmed. Ksh1.00 paid to Ada on 5/11/26 at 6:42 PM.';
    expect(hasMessageStart(text)).toBe(true);
    expect(parsed(text)).toStrictEqual({ transactions: [adaTx], issues: [] });
  });

  it('Req 12.1: "Confirmed." must follow the code after whitespace', () => {
    expect(hasMessageStart('QA12BC34DEConfirmed. Ksh1.00')).toBe(false);
    expect(hasMessageStart('')).toBe(false);
    expect(hasMessageStart('QA12BC34DE Confirmed')).toBe(false);
  });

  it('Req 12.2: two messages with no separator are both parsed', () => {
    const second = writeSentSms(named('Kofi', { code: 'QA12BC34DF', amount: 'Ksh2.00' }));
    expect(parsed(ADA + second)).toStrictEqual({
      transactions: [
        adaTx,
        tx({
          occurredOn: '2026-11-05',
          time: '18:42',
          reference: 'QA12BC34DF',
          minor: -200,
          description: 'Kofi',
          counterparty: 'Kofi',
        }),
      ],
      issues: [],
    });
  });

  it('Req 12.2: blank lines, a single line break and a space all separate messages', () => {
    for (const sep of ['\n\n\n', '\n', ' ', '\r\n', '\t']) {
      expect(parsed(ADA + sep + ADA).transactions).toStrictEqual([adaTx, adaTx]);
    }
  });

  it('Req 12.3: text before the first message is one issue on the line of its first non-blank character', () => {
    expect(parsed('\n\n  hi there\n' + ADA)).toStrictEqual({
      transactions: [adaTx],
      issues: [{ line: 3, message: ISSUES.unexpectedTextBeforeFirstMessage, excerpt: 'hi there' }],
    });
  });

  it('Req 12.3, 5.7: text with no message at all is one masked issue; blank or empty text gives nothing', () => {
    expect(parsed('just words  here\n0700123456')).toStrictEqual({
      transactions: [],
      issues: [
        {
          line: 1,
          message: ISSUES.unexpectedTextBeforeFirstMessage,
          excerpt: 'just words here [number]',
        },
      ],
    });
    expect(parsed('')).toStrictEqual({ transactions: [], issues: [] });
    expect(parsed(' \n\t\r\n ')).toStrictEqual({ transactions: [], issues: [] });
  });

  it('Req 12.4: every whitespace run inside a message, line breaks included, is one space', () => {
    const text =
      'QA12BC34DE   Confirmed.\n\tKsh1.00\r\npaid  to Ada\n\n  Wanjiru   on 5/11/26   at\n6:42    PM.';
    expect(parsed(text)).toStrictEqual({
      transactions: [
        tx({ ...NOV5, minor: -100, description: 'Ada Wanjiru', counterparty: 'Ada Wanjiru' }),
      ],
      issues: [],
    });
  });

  it('Req 12.5, 12.6: an unrecognised message gives one issue and the others still parse', () => {
    const bad = 'QA12BC34DG Confirmed. Hello there.';
    expect(parsed(ADA + '\n' + bad + '\n' + ADA)).toStrictEqual({
      transactions: [adaTx, adaTx],
      issues: [{ line: 2, message: ISSUES.unrecognisedMessage, excerpt: bad }],
    });
  });

  it('Req 12.5: the line counts line feeds only, so blank lines count and a lone CR does not', () => {
    const bad = 'QA12BC34DG Confirmed. Hello there.';
    const issueLine = (text: string): number | undefined => parsed(text).issues[0]?.line;
    expect(issueLine(ADA + '\n\n\n' + bad)).toBe(4);
    expect(issueLine(ADA + '\r\r\n' + bad)).toBe(2);
    expect(issueLine(ADA + '\r' + bad)).toBe(1);
    expect(issueLine('\n\r\n' + bad)).toBe(3);
    expect(
      issueLine('QA12BC34DE\nConfirmed. Ksh1.00 paid to Ada\non 5/11/26 at 6:42 PM.\n' + bad),
    ).toBe(4);
  });

  it('Req 12.5, 5.7: the excerpt joins the lines of the message, is masked and is cut to 60 characters', () => {
    expect(parsed('QA12BC34DG Confirmed.\nCall 0700 123 456 now')).toStrictEqual({
      transactions: [],
      issues: [
        {
          line: 1,
          message: ISSUES.unrecognisedMessage,
          excerpt: 'QA12BC34DG Confirmed. Call [number] now',
        },
      ],
    });
    const long = 'QA12BC34DG Confirmed. ' + 'word '.repeat(30);
    expect(parseSms(long).issues[0]?.excerpt).toBe(long.slice(0, 60));
  });

  it('Req 12.6: structure that does not match gives "Unrecognised message"', () => {
    for (const body of [
      'Confirmed.Ksh1.00 paid to Ada on 5/11/26 at 6:42 PM.',
      'Confirmed. Hello.',
      'Confirmed.',
      'Confirmed. Ksh1.00 paid to Ada',
      'Confirmed. Ksh1.00 gave to Ada on 5/11/26 at 6:42 PM.',
      'Confirmed. paid to Ada on 5/11/26 at 6:42 PM.',
      'Confirmed. Ksh paid to Ada on 5/11/26 at 6:42 PM.',
      'Confirmed. You bought Ksh1.00 of airtime for Ada on 5/11/26 at 6:42 PM.',
      'Confirmed. Reversal of qa12bc34df completed. Ksh1.00 credited to your account on 5/11/26 at 6:42 PM.',
      'Confirmed. Reversal of QA12BC34DF completed. Ksh1.00 credited on 5/11/26 at 6:42 PM.',
    ]) {
      issueOnly(`${CODE} ${body}`, 1, ISSUES.unrecognisedMessage);
    }
  });
});

describe('name cleanup', () => {
  function nameResult(name: string): ReturnType<typeof parsed> {
    return parsed(writePaidSms(named(name, { amount: 'Ksh1.00' })));
  }
  function nameTx(name: string): Transaction {
    return tx({ ...NOV5, minor: -100, description: name, counterparty: name });
  }

  it('Req 13.9: one trailing "." before the Date_Marker is stripped, once', () => {
    expect(nameResult('Moonlight Grocers.').transactions).toStrictEqual([
      nameTx('Moonlight Grocers'),
    ]);
    expect(nameResult('Grocers..').transactions).toStrictEqual([nameTx('Grocers.')]);
  });

  it('Req 13.9: a Phone_Token and the one space before it are dropped, whole group included', () => {
    expect(nameResult('Agent 12 0711000222').transactions).toStrictEqual([nameTx('Agent')]);
    expect(nameResult('Ada Wanjiru 0700123456').transactions).toStrictEqual([
      nameTx('Ada Wanjiru'),
    ]);
    expect(nameResult('Ada Wanjiru +0711000222').transactions).toStrictEqual([
      nameTx('Ada Wanjiru'),
    ]);
    expect(nameResult('Ada 0700-123-456').transactions).toStrictEqual([nameTx('Ada')]);
    expect(nameResult('Ada 0700123456.').transactions).toStrictEqual([nameTx('Ada')]);
  });

  it('Req 13.9, 5.5: a digit group glued to a name, or a lone number, stays and is masked', () => {
    expect(nameResult('Ada0700123456').transactions).toStrictEqual([nameTx('Ada[number]')]);
    expect(nameResult('0700123456').transactions).toStrictEqual([nameTx('[number]')]);
    expect(nameResult('Ada 0700123456x').transactions).toStrictEqual([nameTx('Ada [number]x')]);
  });

  it('Req 13.9: a short digit group is neither dropped nor masked', () => {
    expect(nameResult('Shop 123456').transactions).toStrictEqual([nameTx('Shop 123456')]);
  });

  it('Req 13.8: a name with " on " but no full Date_Marker is kept whole', () => {
    expect(nameResult('Hill on Hill Cafe').transactions).toStrictEqual([
      nameTx('Hill on Hill Cafe'),
    ]);
    expect(nameResult('Hill on 5/11/26 at 6:42 Cafe').transactions).toStrictEqual([
      nameTx('Hill on 5/11/26 at 6:42 Cafe'),
    ]);
  });

  it('Req 13.8: the name ends at the first complete Date_Marker', () => {
    const text =
      'QA12BC34DE Confirmed. Ksh1.00 paid to Ada on 5/11/26 at 6:42 PM. on 6/11/26 at 7:00 AM.';
    expect(parsed(text).transactions).toStrictEqual([nameTx('Ada')]);
  });

  it('Req 13.10: an empty name after cleanup gives "Unrecognised message"', () => {
    issueOnly(writePaidSms(named('.', { amount: 'Ksh1.00' })), 1, ISSUES.unrecognisedMessage);
  });
});

describe('dates and times', () => {
  const withWhen = (date: string, time: string): string =>
    writePaidSms(named('Ada', { amount: 'Ksh1.00', date, time }));

  it('Req 13.13: a correct layout with an impossible value gives "Invalid date"', () => {
    for (const [date, time] of [
      ['31/2/26', '6:42 PM'],
      ['29/2/26', '6:42 PM'],
      ['0/5/26', '6:42 PM'],
      ['5/13/26', '6:42 PM'],
      ['5/11/26', '13:00 PM'],
      ['5/11/26', '0:30 AM'],
      ['5/11/26', '6:60 PM'],
    ] as const) {
      issueOnly(withWhen(date, time), 1, ISSUES.invalidDate);
    }
  });

  it('Req 13.13, 12.6: a wrong layout gives "Unrecognised message"', () => {
    for (const [date, time] of [
      ['5/11/2026', '6:42 PM'],
      ['5-11-26', '6:42 PM'],
      ['5/11', '6:42 PM'],
      ['5/11/6', '6:42 PM'],
      ['123/11/26', '6:42 PM'],
      ['5/11/26', '6:42'],
      ['5/11/26', '6:42PM'],
      ['5/11/26', '6:4 PM'],
      ['5/11/26', '106:42 PM'],
      ['5/11/26', '18:42'],
    ] as const) {
      issueOnly(withWhen(date, time), 1, ISSUES.unrecognisedMessage);
    }
  });

  it('Req 13.13, 5.5: an ISO date is a wrong layout and its excerpt is masked', () => {
    expect(parsed(withWhen('2026-11-05', '6:42 PM'))).toStrictEqual({
      transactions: [],
      issues: [
        {
          line: 1,
          message: ISSUES.unrecognisedMessage,
          excerpt: 'QA12BC34DE Confirmed. Ksh1.00 paid to Ada on [number] at 6:4',
        },
      ],
    });
  });

  it('Req 13.12: the day is read first, 2-digit years are 2000 plus, and 12-hour times convert', () => {
    const when = (date: string, time: string): Transaction[] =>
      parsed(withWhen(date, time)).transactions;
    const first = (date: string, time: string): string => {
      const t = when(date, time)[0];
      return `${t?.occurredOn ?? ''} ${t?.time ?? ''}`;
    };
    expect(first('12/1/26', '6:42 PM')).toBe('2026-01-12 18:42');
    expect(first('29/2/24', '12:00 AM')).toBe('2024-02-29 00:00');
    expect(first('05/11/00', '12:30 PM')).toBe('2000-11-05 12:30');
    expect(first('5/11/26', '11:59 pm')).toBe('2026-11-05 23:59');
    expect(first('5/11/26', '1:05 am')).toBe('2026-11-05 01:05');
    expect(first('5/11/26', '06:42 PM')).toBe('2026-11-05 18:42');
  });
});

describe('amounts', () => {
  const withAmount = (amount: string, extra: Partial<NamedSmsFields> = {}): string =>
    writePaidSms(named('Ada', { amount, ...extra }));
  const minorOf = (amount: string): number | undefined =>
    parsed(withAmount(amount)).transactions[0]?.amount.minor;

  it('Req 13.14, 12.8: Ksh and KES prefixes in any case, with or without a space, are accepted', () => {
    expect(minorOf('KES1,250.00')).toBe(-125000);
    expect(minorOf('kes 1,250.00')).toBe(-125000);
    expect(minorOf('KsH1,250.00')).toBe(-125000);
    expect(minorOf('ksh 5')).toBe(-500);
  });

  it('Req 13.14: decimals of one or two digits, none, and a sentence full stop are handled', () => {
    expect(minorOf('Ksh5.5')).toBe(-550);
    expect(minorOf('Ksh5')).toBe(-500);
    expect(minorOf('Ksh0.05')).toBe(-5);
    expect(minorOf('Ksh1,000,000')).toBe(-100000000);
  });

  it('Req 13.14: a currency other than KES in the text is not an amount', () => {
    issueOnly(withAmount('USD5.00'), 1, ISSUES.unrecognisedMessage);
    issueOnly(withAmount('5.00'), 1, ISSUES.unrecognisedMessage);
  });

  it('Req 13.14, D5(d): three or more decimals leave text that matches no keyword', () => {
    issueOnly(withAmount('Ksh5.123'), 1, ISSUES.unrecognisedMessage);
    issueOnly(withAmount('Ksh12,34'), 1, ISSUES.unrecognisedMessage);
  });

  it('Req 13.16: a grouping error gives "Invalid amount"', () => {
    issueOnly(withAmount('Ksh1234,567.00'), 1, ISSUES.invalidAmount);
    issueOnly(withAmount('Ksh1234,567,890'), 1, ISSUES.invalidAmount);
  });

  it('Req 13.16: the limit is accepted and one minor unit more gives "Amount too large"', () => {
    expect(minorOf('Ksh1,000,000,000.00')).toBe(-100_000_000_000);
    issueOnly(withAmount('Ksh1,000,000,000.01'), 1, ISSUES.amountTooLarge);
    issueOnly(withAmount('Ksh99,999,999,999,999'), 1, ISSUES.amountTooLarge);
  });

  it('Req 13.16, 12.5: the first failing check names the issue (structure, amount, name, date)', () => {
    issueOnly(
      'QA12BC34DE Confirmed. Ksh1234,567.00 paid to Ada on 31/2/26 at 6:42 PM.',
      1,
      ISSUES.invalidAmount,
    );
    issueOnly(
      'QA12BC34DE Confirmed. Ksh1234,567.00 paid to . on 5/11/26 at 6:42 PM.',
      1,
      ISSUES.invalidAmount,
    );
    issueOnly(
      'QA12BC34DE Confirmed. Ksh1.00 paid to . on 31/2/26 at 6:42 PM.',
      1,
      ISSUES.unrecognisedMessage,
    );
    issueOnly('QA12BC34DE Confirmed. Ksh1234,567.00 hello', 1, ISSUES.unrecognisedMessage);
  });

  it('Req 13.1, 13.4, 13.6: an amount error in an airtime or a reversal message names the issue too', () => {
    issueOnly(writeAirtimeSms({ ...BASE, amount: 'Ksh1234,567.00' }), 1, ISSUES.invalidAmount);
    issueOnly(
      writeReversalSms({ ...BASE, amount: 'Ksh1,000,000,000.01', reversedCode: 'QA12BC34DF' }),
      1,
      ISSUES.amountTooLarge,
    );
  });
});

describe('cost sentences', () => {
  const paidWith = (cost: string | undefined, over: Partial<NamedSmsFields> = {}): string =>
    writePaidSms(named('Ada', { amount: 'Ksh1.00', cost, ...over }));
  const parent = tx({ ...NOV5, minor: -100, description: 'Ada', counterparty: 'Ada' });

  it('Req 14.4: a zero cost creates no transaction', () => {
    for (const cost of [
      'Transaction cost, Ksh0.00.',
      'Transaction cost, Ksh0.',
      'Transaction cost, KES0',
    ]) {
      expect(parsed(paidWith(cost))).toStrictEqual({ transactions: [parent], issues: [] });
    }
  });

  it('Req 14.3, 14.5: a positive cost creates one cost transaction with the parent date, time and reference', () => {
    expect(parsed(paidWith('Transaction cost, Ksh29.00.'))).toStrictEqual({
      transactions: [parent, costTx({ ...NOV5, minor: -2900 })],
      issues: [],
    });
    expect(parsed(paidWith('Transaction cost,Ksh0.01.')).transactions[1]).toStrictEqual(
      costTx({ ...NOV5, minor: -1 }),
    );
  });

  it('Req 14.3: the cost sentence may come before the balance sentence', () => {
    const text = paidWith('Transaction cost, Ksh5.00. New balance is Ksh1.00.');
    expect(parsed(text).transactions).toStrictEqual([parent, costTx({ ...NOV5, minor: -500 })]);
  });

  it('Req 14.3, 13.11: a reversal cost carries the reversal message own code as its reference', () => {
    const text = writeReversalSms({
      ...BASE,
      reversedCode: 'QA12BC34DF',
      cost: 'Transaction cost, Ksh5.00.',
    });
    const result = parsed(text);
    expect(result.transactions[0]?.reference).toBe(CODE);
    expect(result.transactions[0]?.description).toBe('Reversal of QA12BC34DF');
    expect(result.transactions[1]).toStrictEqual(costTx({ ...NOV5, minor: -500 }));
  });

  it('Req 14.6: a bad, missing or too-large cost keeps the parent and gives "Invalid transaction cost"', () => {
    for (const cost of [
      'Transaction cost, Kshx.',
      'Transaction cost,',
      'Transaction cost, Ksh.',
      'Transaction cost, Ksh1,000,000,000.01.',
      'Transaction cost, Ksh1234,567.00.',
      'Transaction cost, 5.00.',
    ]) {
      const text = paidWith(cost);
      expect(parsed(text)).toStrictEqual({
        transactions: [parent],
        issues: [{ line: 1, message: ISSUES.invalidTransactionCost, excerpt: cut(text) }],
      });
    }
  });

  it('Req 14.6, 14.7: the cost issue carries the line of its own message and the others still parse', () => {
    const bad = paidWith('Transaction cost, Kshx.');
    const result = parsed(paidWith(undefined) + '\n\n' + bad + '\n' + paidWith(undefined));
    expect(result.transactions).toStrictEqual([parent, parent, parent]);
    expect(result.issues).toStrictEqual([
      { line: 3, message: ISSUES.invalidTransactionCost, excerpt: cut(bad) },
    ]);
  });

  it('Req 14.8, 5.5: a cost row has no counterparty and its text holds no long digit group', () => {
    const cost = parsed(paidWith('Transaction cost, Ksh5.00.', { name: 'Ada 0700123456' }))
      .transactions[1];
    expect(cost?.counterparty).toBeUndefined();
    expect(cost?.description).toBe('Transaction cost');
    expect(maskText(cost?.description ?? '')).toBe('Transaction cost');
  });
});

describe('P41 SMS message round trip', () => {
  type KindName = 'paid' | 'sent' | 'received' | 'airtime' | 'withdrawn' | 'reversal';

  interface Spec {
    readonly kind: KindName;
    readonly code: string;
    readonly reversedCode: string;
    readonly minor: number;
    readonly name: string;
    readonly phone: string;
    readonly day: number;
    readonly month: number;
    readonly year: number;
    readonly hour: number;
    readonly minute: number;
    readonly pm: boolean;
    readonly pad: boolean;
    readonly balance: number;
    readonly cost: number | undefined;
    readonly bad: boolean;
  }

  const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
  const codeArb = fc
    .array(fc.constantFrom(...CODE_CHARS), { minLength: 10, maxLength: 10 })
    .map((chars) => chars.join(''));
  const WORDS = ['Ada', 'Moonlight', 'Grocers', 'Hill', 'on', 'Cafe', 'Kofi', 'Lakeside', 'Shop'];
  const nameArb = fc
    .array(fc.constantFrom(...WORDS), { minLength: 1, maxLength: 3 })
    .map((words) => words.join(' '));
  const BALANCES: readonly (string | undefined)[] = [
    undefined,
    balanceSentence('Ksh8,420.50'),
    balanceSentence('Ksh8.00', 'Wallet'),
    'new balance is Ksh1.00.',
  ];

  const specArb: fc.Arbitrary<Spec> = fc.record({
    kind: fc.constantFrom<KindName>('paid', 'sent', 'received', 'airtime', 'withdrawn', 'reversal'),
    code: codeArb,
    reversedCode: codeArb,
    minor: fc.integer({ min: 1, max: 1_000_000_000 }),
    name: nameArb,
    phone: fc.constantFrom('', ' 0711000222', ' +0711000222', ' 12 0711000222', ' 0700-123-456'),
    day: fc.integer({ min: 1, max: 28 }),
    month: fc.integer({ min: 1, max: 12 }),
    year: fc.integer({ min: 0, max: 99 }),
    hour: fc.integer({ min: 1, max: 12 }),
    minute: fc.integer({ min: 0, max: 59 }),
    pm: fc.boolean(),
    pad: fc.boolean(),
    balance: fc.integer({ min: 0, max: BALANCES.length - 1 }),
    cost: fc.option(fc.integer({ min: 0, max: 99_999 }), { nil: undefined }),
    bad: fc.integer({ min: 0, max: 5 }).map((n) => n === 0),
  });

  const two = (n: number): string => String(n).padStart(2, '0');

  function render(spec: Spec): string {
    if (spec.bad) {
      return `${spec.code} Confirmed. Something else entirely.`;
    }
    const fields: SmsFields = {
      code: spec.code,
      amount: formatKsh(spec.minor),
      date: `${spec.pad ? two(spec.day) : String(spec.day)}/${spec.pad ? two(spec.month) : String(spec.month)}/${two(spec.year)}`,
      time: `${spec.pad ? two(spec.hour) : String(spec.hour)}:${two(spec.minute)} ${spec.pm ? 'PM' : 'AM'}`,
      balance: BALANCES[spec.balance],
      cost: spec.cost === undefined ? undefined : costSentence(formatKsh(spec.cost)),
    };
    const withName = { ...fields, name: spec.name + spec.phone };
    switch (spec.kind) {
      case 'paid':
        return writePaidSms(withName);
      case 'sent':
        return writeSentSms(withName);
      case 'received':
        return writeReceivedSms(withName);
      case 'withdrawn':
        return writeWithdrawnSms(withName);
      case 'airtime':
        return writeAirtimeSms(fields);
      case 'reversal':
        return writeReversalSms({ ...fields, reversedCode: spec.reversedCode });
    }
  }

  function expectedRows(spec: Spec): Transaction[] {
    const occurredOn = `20${two(spec.year)}-${two(spec.month)}-${two(spec.day)}`;
    const time = `${two((spec.hour % 12) + (spec.pm ? 12 : 0))}:${two(spec.minute)}`;
    const inflow = spec.kind === 'received' || spec.kind === 'reversal';
    const base = { occurredOn, time, reference: spec.code };
    const minor = inflow ? spec.minor : 0 - spec.minor;
    let parent: Transaction;
    if (spec.kind === 'airtime') {
      parent = tx({ ...base, minor, description: 'Airtime' });
    } else if (spec.kind === 'reversal') {
      parent = tx({ ...base, minor, description: maskText('Reversal of ' + spec.reversedCode) });
    } else {
      parent = tx({ ...base, minor, description: spec.name, counterparty: spec.name });
    }
    return spec.cost !== undefined && spec.cost > 0
      ? [parent, costTx({ ...base, minor: 0 - spec.cost })]
      : [parent];
  }

  it('Req 12.1, 12.2, 13.1 to 13.6, 16.7, 20.6, 20.11: messages round trip across any separator mix', () => {
    // Feature: 01-parsers, Property 41: SMS message round trip preserves messages across any separator mix
    fc.assert(
      fc.property(
        fc.array(specArb, { minLength: 1, maxLength: 6 }),
        fc.array(separatorArb, { minLength: 7, maxLength: 7 }),
        (specs, seps) => {
          let text = seps[0] ?? '';
          let feeds = countLineFeeds(text);
          const expectedTransactions: Transaction[] = [];
          const expectedIssues: { line: number; message: string; excerpt: string }[] = [];
          specs.forEach((spec, index) => {
            const message = render(spec);
            if (spec.bad) {
              expectedIssues.push({
                line: feeds + 1,
                message: ISSUES.unrecognisedMessage,
                excerpt: buildExcerpt(message),
              });
            } else {
              expectedTransactions.push(...expectedRows(spec));
            }
            const sep = seps[index + 1] ?? '';
            text += message + sep;
            feeds += countLineFeeds(sep);
          });
          const result = parsed(text);
          expect(result.transactions).toStrictEqual(expectedTransactions);
          expect(result.issues).toStrictEqual(expectedIssues);
          expect(parseSms(text)).toStrictEqual(parseSms(text));
        },
      ),
      RUNS,
    );
  });
});

describe('P53 Sms_Amount extraction matches the Amount_Grammar', () => {
  const digit = fc.constantFrom(...'0123456789'.split(''));
  const digitsOf = (min: number, max: number): fc.Arbitrary<string> =>
    fc.array(digit, { minLength: min, maxLength: max }).map((d) => d.join(''));
  const digitsTextArb: fc.Arbitrary<string> = fc
    .tuple(
      digitsOf(1, 14),
      fc.array(digitsOf(3, 3), { minLength: 0, maxLength: 3 }),
      fc.option(digitsOf(1, 2), { nil: undefined }),
    )
    .map(
      ([first, groups, decimals]) =>
        [first, ...groups].join(',') + (decimals === undefined ? '' : '.' + decimals),
    );
  const prefixArb = fc.constantFrom('Ksh', 'KES', 'kes', 'ksh', 'KsH', 'Ksh ', 'kes ');

  it('Req 13.14, 13.16: the digits text gives the Amount_Grammar result under KES, or its issue', () => {
    // Feature: 01-parsers, Property 53: Sms_Amount extraction matches the Amount_Grammar under KES
    fc.assert(
      fc.property(prefixArb, digitsTextArb, (prefix, digitsText) => {
        const text = writePaidSms(named('Ada', { amount: prefix + digitsText }));
        const outcome = parseAmountText(digitsText, 'KES');
        const result = parsed(text);
        if (outcome.ok) {
          expect(result.issues).toStrictEqual([]);
          expect(result.transactions).toStrictEqual([
            tx({
              ...NOV5,
              minor: 0 - outcome.value.minor,
              description: 'Ada',
              counterparty: 'Ada',
            }),
          ]);
        } else {
          expect(result.transactions).toStrictEqual([]);
          expect(result.issues).toStrictEqual([
            {
              line: 1,
              message:
                outcome.reason === 'too-large' ? ISSUES.amountTooLarge : ISSUES.invalidAmount,
              excerpt: buildExcerpt(text),
            },
          ]);
        }
      }),
      RUNS,
    );
  });
});

describe('P55 transaction cost sentences', () => {
  const kindArb = fc.integer({ min: 0, max: KINDS.length - 1 });
  const costArb = fc.oneof(fc.constant(0), fc.integer({ min: 1, max: 1_000_000_000 }));

  it('Req 14.3, 14.4, 14.5: a cost transaction exists exactly when the cost is positive, right after its parent', () => {
    // Feature: 01-parsers, Property 55: Transaction cost sentences create a cost transaction exactly when positive
    fc.assert(
      fc.property(kindArb, costArb, fc.boolean(), (kindIndex, cost, costFirst) => {
        const kind = KINDS[kindIndex];
        if (kind === undefined) {
          throw new Error('kind index out of range');
        }
        const costText = costSentence(formatKsh(cost));
        const balanceText = balanceSentence('Ksh8.00');
        const result = parseSms(
          kind.write({
            cost: costFirst ? `${costText} ${balanceText}` : costText,
            balance: costFirst ? undefined : balanceText,
          }),
        );
        const plain = result.transactions.map((t) => ({ ...t, id: '' }));
        const expected =
          cost > 0 ? [kind.parent, costTx({ ...NOV5, minor: 0 - cost })] : [kind.parent];
        expect(plain).toStrictEqual(expected);
        expect(result.issues).toStrictEqual([]);
        expect(new Set(result.transactions.map((t) => t.id)).size).toBe(result.transactions.length);
      }),
      RUNS,
    );
  });
});
