import { describe, it, expect } from 'vitest';
import { MASK_TOKEN, buildExcerpt, maskText } from './masking';

describe('maskText worked examples (Algorithm C)', () => {
  it('Req 5.1: MASK_TOKEN is "[number]"', () => {
    expect(MASK_TOKEN).toBe('[number]');
  });

  it('Req 5.1: one run of 10 digits is masked', () => {
    expect(maskText('Call 0700123456 now')).toBe('Call [number] now');
  });

  it('Req 5.1, 5.2: hyphens join 3 + 4 + 1 digits', () => {
    expect(maskText('123-4567-8')).toBe('[number]');
  });

  it('Req 5.1, 5.2: single spaces join 2 + 2 + 2 + 1 digits', () => {
    expect(maskText('12 34 56 7')).toBe('[number]');
  });

  it('Req 5.1, 5.2: a single space inside the group is replaced too', () => {
    expect(maskText('1234567 8')).toBe('[number]');
  });

  it('Req 5.2: a date-like group is masked', () => {
    expect(maskText('2026-11-05')).toBe('[number]');
    expect(maskText('paid on 2026-11-05 ok')).toBe('paid on [number] ok');
  });

  it('Req 5.2: two spaces do not join digit runs', () => {
    expect(maskText('123456  7')).toBe('123456  7');
  });

  it('Req 5.2: dots and slashes do not join digit runs', () => {
    expect(maskText('1234.5678/9012')).toBe('1234.5678/9012');
  });

  it('Req 5.1, 5.2: a hyphen not followed by a digit stays outside the group', () => {
    expect(maskText('1234567-x')).toBe('[number]-x');
  });

  it('Req 5.1: groups of 6 or fewer digits are kept', () => {
    expect(maskText('123456')).toBe('123456');
    expect(maskText('12 34 56')).toBe('12 34 56');
    expect(maskText('')).toBe('');
  });

  it('Req 5.3, 5.4: masking is idempotent on an example', () => {
    const once = maskText('a 1234567 b 12-34-56 c 99999999');
    expect(once).toBe('a [number] b 12-34-56 c [number]');
    expect(maskText(once)).toBe(once);
  });
});

describe('buildExcerpt', () => {
  it('Req 5.7: short text is only masked', () => {
    expect(buildExcerpt('call 0700123456')).toBe('call [number]');
  });

  it('Req 5.7: text is cut to 60 units', () => {
    const excerpt = buildExcerpt('a'.repeat(100));
    expect(excerpt).toBe('a'.repeat(60));
  });

  it('Req 5.7: a group straddling character 60 is masked before the cut', () => {
    const excerpt = buildExcerpt('x'.repeat(58) + '1234567' + 'tail');
    expect(excerpt).toBe('x'.repeat(58) + '[n');
    expect(/[0-9]/.test(excerpt)).toBe(false);
  });

  it('Req 5.7: a surrogate pair at the cut gives an excerpt of 59 units', () => {
    const excerpt = buildExcerpt('x'.repeat(59) + '😀' + 'abc');
    expect(excerpt).toBe('x'.repeat(59));
    expect(excerpt.length).toBe(59);
  });

  it('Req 5.7: a surrogate pair that ends exactly at 60 is kept whole', () => {
    const excerpt = buildExcerpt('x'.repeat(58) + '😀' + 'abc');
    expect(excerpt).toBe('x'.repeat(58) + '😀');
    expect(excerpt.length).toBe(60);
  });
});
