import { describe, expect, it } from 'vitest';
import { firstFieldErrors, plainText } from '@/lib/validation';
import { z } from 'zod';

describe('plainText', () => {
  it('accepts trimmed text', () => expect(plainText(2, 20).parse('  hello  ')).toBe('hello'));
  it('rejects markup', () =>
    expect(plainText().safeParse('<script>alert(1)</script>').success).toBe(false));
  it('flattens field errors without unsafe casts', () => {
    const parsed = z.object({ name: plainText(3, 10) }).safeParse({ name: 'x' });
    if (parsed.success) throw new Error('expected failure');
    expect(firstFieldErrors(parsed.error).name).toBeDefined();
  });
});
