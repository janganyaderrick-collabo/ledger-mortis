import { isWhitespaceCode } from '../model/chars';
import type { FormatId } from '../model/types';
import { hasRecognisedCsvHeader } from './csv-parser';
import { hasMessageStart } from './sms-parser';

function isBlank(text: string): boolean {
  for (let i = 0; i < text.length; i += 1) {
    if (!isWhitespaceCode(text.charCodeAt(i))) {
      return false;
    }
  }
  return true;
}

// Checks in order: blank text, a recognised CSV header, a Message_Start, otherwise unknown.
export function detectFormat(text: string): FormatId {
  if (isBlank(text)) {
    return 'unknown';
  }
  if (hasRecognisedCsvHeader(text)) {
    return 'csv';
  }
  if (hasMessageStart(text)) {
    return 'mobile-money-sms';
  }
  return 'unknown';
}
