export function isAsciiDigit(code: number): boolean {
  return code >= 48 && code <= 57;
}

export function isAsciiLetter(code: number): boolean {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

export function isAsciiUpperOrDigit(code: number): boolean {
  return (code >= 65 && code <= 90) || isAsciiDigit(code);
}

// Exactly the set that String.prototype.trim removes.
export function isWhitespaceCode(code: number): boolean {
  return (
    (code >= 0x09 && code <= 0x0d) ||
    code === 0x20 ||
    code === 0xa0 ||
    code === 0x1680 ||
    (code >= 0x2000 && code <= 0x200a) ||
    code === 0x2028 ||
    code === 0x2029 ||
    code === 0x202f ||
    code === 0x205f ||
    code === 0x3000 ||
    code === 0xfeff
  );
}

export function asciiLowerCode(code: number): number {
  return code >= 65 && code <= 90 ? code + 32 : code;
}

// True when text holds keywordLowercase at index, comparing with ASCII case folding.
export function startsWithKeywordAt(
  text: string,
  index: number,
  keywordLowercase: string,
): boolean {
  if (index < 0 || index + keywordLowercase.length > text.length) {
    return false;
  }
  for (let k = 0; k < keywordLowercase.length; k += 1) {
    if (asciiLowerCode(text.charCodeAt(index + k)) !== keywordLowercase.charCodeAt(k)) {
      return false;
    }
  }
  return true;
}
