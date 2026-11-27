export const ISSUES: {
  readonly emptyInput: string;
  readonly unrecognisedText: string;
  readonly unrecognisedHeader: string;
  readonly malformedQuotedField: string;
  readonly unterminatedQuote: string;
  readonly wrongNumberOfFields: (expected: number, found: number) => string;
  readonly invalidDate: string;
  readonly invalidAmount: string;
  readonly amountTooLarge: string;
  readonly currencyMismatch: string;
  readonly invalidDebitOrCredit: string;
  readonly missingDescription: string;
  readonly unexpectedTextBeforeFirstMessage: string;
  readonly unrecognisedMessage: string;
  readonly invalidTransactionCost: string;
} = {
  emptyInput: 'Empty input',
  unrecognisedText: 'Unrecognised text',
  unrecognisedHeader: 'Unrecognised header',
  malformedQuotedField: 'Malformed quoted field',
  unterminatedQuote: 'Unterminated quote',
  wrongNumberOfFields: (expected: number, found: number): string =>
    'Wrong number of fields: expected ' + String(expected) + ', found ' + String(found),
  invalidDate: 'Invalid date',
  invalidAmount: 'Invalid amount',
  amountTooLarge: 'Amount too large',
  currencyMismatch: 'Currency mismatch',
  invalidDebitOrCredit: 'Invalid debit or credit',
  missingDescription: 'Missing description',
  unexpectedTextBeforeFirstMessage: 'Unexpected text before first message',
  unrecognisedMessage: 'Unrecognised message',
  invalidTransactionCost: 'Invalid transaction cost',
};
