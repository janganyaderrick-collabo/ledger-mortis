import fc from 'fast-check';

// Test_Only_Helper SMS writer: one function per message kind, each with an optional
// balance sentence and an optional cost sentence (both given as full sentences).

export interface SmsFields {
  readonly code: string;
  // Amount text with its prefix, for example "Ksh1,250.00".
  readonly amount: string;
  // Sms_Date text, for example "5/11/26".
  readonly date: string;
  // Sms_Time text, for example "6:42 PM".
  readonly time: string;
  readonly balance?: string | undefined;
  readonly cost?: string | undefined;
}

export interface NamedSmsFields extends SmsFields {
  readonly name: string;
}

export interface ReversalSmsFields extends SmsFields {
  readonly reversedCode: string;
}

function tail(fields: SmsFields): string {
  const balance = fields.balance === undefined ? '' : ' ' + fields.balance;
  const cost = fields.cost === undefined ? '' : ' ' + fields.cost;
  return balance + cost;
}

function marker(fields: SmsFields): string {
  return ` on ${fields.date} at ${fields.time}.`;
}

export function writePaidSms(fields: NamedSmsFields): string {
  return `${fields.code} Confirmed. ${fields.amount} paid to ${fields.name}${marker(fields)}${tail(fields)}`;
}

export function writeSentSms(fields: NamedSmsFields): string {
  return `${fields.code} Confirmed. ${fields.amount} sent to ${fields.name}${marker(fields)}${tail(fields)}`;
}

export function writeReceivedSms(fields: NamedSmsFields): string {
  return `${fields.code} Confirmed. You have received ${fields.amount} from ${fields.name}${marker(fields)}${tail(fields)}`;
}

export function writeAirtimeSms(fields: SmsFields): string {
  return `${fields.code} Confirmed. You bought ${fields.amount} of airtime${marker(fields)}${tail(fields)}`;
}

export function writeWithdrawnSms(fields: NamedSmsFields): string {
  return `${fields.code} Confirmed. ${fields.amount} withdrawn from ${fields.name}${marker(fields)}${tail(fields)}`;
}

export function writeReversalSms(fields: ReversalSmsFields): string {
  return `${fields.code} Confirmed. Reversal of ${fields.reversedCode} completed. ${fields.amount} credited to your account${marker(fields)}${tail(fields)}`;
}

export function balanceSentence(amount: string, word?: string): string {
  return word === undefined ? `New balance is ${amount}.` : `New ${word} balance is ${amount}.`;
}

export function costSentence(amount: string): string {
  return `Transaction cost, ${amount}.`;
}

// Renders a non-negative minor amount as "Ksh1,250.00".
export function formatKsh(minor: number): string {
  const whole = String(Math.floor(minor / 100));
  const cents = String(minor % 100).padStart(2, '0');
  const groups: string[] = [];
  for (let end = whole.length; end > 0; end -= 3) {
    groups.unshift(whole.slice(Math.max(0, end - 3), end));
  }
  return `Ksh${groups.join(',')}.${cents}`;
}

export function countLineFeeds(text: string): number {
  let count = 0;
  for (let k = 0; k < text.length; k += 1) {
    if (text.charCodeAt(k) === 10) {
      count += 1;
    }
  }
  return count;
}

// Separator mix between messages: none, a space, line breaks of every kind, a lone CR,
// blank lines, tabs and a no-break space.
export const separatorArb: fc.Arbitrary<string> = fc.constantFrom(
  '',
  ' ',
  '\n',
  '\r\n',
  '\n\n',
  '\r',
  '\t',
  ' \n ',
  '\n\r\n\n',
  '\u00a0',
);
