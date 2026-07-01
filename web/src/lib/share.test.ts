import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWhatsAppShareUrl } from './share.ts';

test('buildWhatsAppShareUrl encodes the public URL and friendly message', () => {
  const url = 'https://presupuestoya.example.com/q/abc123';
  const result = buildWhatsAppShareUrl(url);

  assert.ok(result.startsWith('https://wa.me/?text='));
  assert.ok(result.includes(encodeURIComponent(url)));
  assert.ok(result.includes(encodeURIComponent('Te paso el presupuesto:')));
});

test('buildWhatsAppShareUrl handles URLs with special characters', () => {
  const url = 'https://presupuestoya.example.com/q/abc 123?foo=bar&baz=qux';
  const result = buildWhatsAppShareUrl(url);

  assert.doesNotMatch(result, /\s/);
  assert.ok(result.includes(encodeURIComponent(url)));
});
