import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isShareMode,
  buildInactiveSlugMessage,
  buildCloneRow,
  buildCloneItems,
  isQuoteDirty,
  insertItemAtTop,
  computeContractorStats,
  type QuoteLike,
} from './quotes.js';

const baseQuote: QuoteLike = {
  id: 'quote-1',
  contractor_id: 'contractor-1',
  slug: 'old-slug',
  client_name: 'Juan',
  client_contact: '+54 9 11 1234 5678',
  currency: 'ARS',
  notes: 'Notas',
  terms: 'Términos',
  validity_days: 7,
  expires_at: '2026-07-07T00:00:00Z',
  status: 'shared',
  client_response: 'pending',
  total_override: null,
  is_active: true,
  quote_items: [
    { description: 'Item A', qty: 2, unit_price: 100, line_total: 200, sort_order: 0 },
    { description: 'Item B', qty: 1, unit_price: 50, line_total: 50, sort_order: 1 },
  ],
};

test('isShareMode accepts valid modes', () => {
  assert.equal(isShareMode('reissue_changes'), true);
  assert.equal(isShareMode('reissue_rejected'), true);
  assert.equal(isShareMode('share_accepted'), true);
  assert.equal(isShareMode('invalid'), false);
  assert.equal(isShareMode(undefined), false);
});

test('buildInactiveSlugMessage for rejected response', () => {
  const result = buildInactiveSlugMessage('rejected', 'new-slug');
  assert.equal(result.error, 'replaced');
  assert.equal(result.message, 'Este presupuesto fue rechazado y reemplazado.');
  assert.equal(result.new_slug, 'new-slug');
});

test('buildInactiveSlugMessage for rejected without replacement', () => {
  const result = buildInactiveSlugMessage('rejected', null);
  assert.equal(result.message, 'Este presupuesto fue rechazado.');
  assert.equal('new_slug' in result, false);
});

test('buildInactiveSlugMessage for changes_requested response', () => {
  const result = buildInactiveSlugMessage('changes_requested', 'new-slug');
  assert.equal(result.error, 'replaced');
  assert.equal(result.message, 'Este presupuesto se reemplazó por una nueva versión.');
  assert.equal(result.new_slug, 'new-slug');
});

test('buildInactiveSlugMessage for unknown response', () => {
  const result = buildInactiveSlugMessage('accepted', 'new-slug');
  assert.equal(result.error, 'replaced');
  assert.equal(result.message, 'Este presupuesto se reemplazó por una nueva versión.');
  assert.equal(result.new_slug, 'new-slug');
});

test('buildCloneRow creates a fresh shareable quote row', () => {
  const clone = buildCloneRow(baseQuote, 'new-slug', 'new-token');

  assert.equal(clone.slug, 'new-slug');
  assert.equal(clone.edit_token, 'new-token');
  assert.equal(clone.client_response, 'pending');
  assert.equal(clone.status, 'shared');
  assert.equal(clone.is_active, true);
  assert.equal(clone.contractor_id, baseQuote.contractor_id);
  assert.equal(clone.client_name, baseQuote.client_name);
  assert.equal('id' in clone, false);
  assert.equal('quote_items' in clone, false);
});

test('buildCloneItems copies items with a new quote id', () => {
  const items = buildCloneItems(baseQuote.quote_items, 'quote-2');

  assert.equal(items.length, 2);
  assert.equal(items[0].quote_id, 'quote-2');
  assert.equal(items[0].description, 'Item A');
  assert.equal(items[0].line_total, 200);
  assert.equal(items[1].quote_id, 'quote-2');
  assert.equal(items[1].sort_order, 1);
});

test('isQuoteDirty returns false when snapshot matches current state', () => {
  const quote = { client_name: 'Juan', currency: 'USD' };
  const items = [{ description: 'Item', qty: 1, unit_price: 10, line_total: 10, sort_order: 0 }];
  const snapshot = JSON.stringify({ q: quote, i: items });
  assert.equal(isQuoteDirty(snapshot, quote, items), false);
});

test('isQuoteDirty returns true when state changed', () => {
  const quote = { client_name: 'Juan', currency: 'USD' };
  const items = [{ description: 'Item', qty: 1, unit_price: 10, line_total: 10, sort_order: 0 }];
  const snapshot = JSON.stringify({ q: quote, i: items });
  const changed = [...items, { description: 'New', qty: 1, unit_price: 5, line_total: 5, sort_order: 1 }];
  assert.equal(isQuoteDirty(snapshot, quote, changed), true);
});

test('insertItemAtTop places new item at index 0', () => {
  const items: Array<{ description: string; qty: number; unit_price: number | null; line_total: number; sort_order: number }> = [
    { description: 'Old', qty: 1, unit_price: 10, line_total: 10, sort_order: 0 },
  ];
  const next = insertItemAtTop(items, { description: 'New', qty: 1, unit_price: null, line_total: 0 });

  assert.equal(next.length, 2);
  assert.equal(next[0].description, 'New');
  assert.equal(next[0].sort_order, 0);
  assert.equal(next[1].description, 'Old');
  assert.equal(next[1].sort_order, 1);
});

test('computeContractorStats excludes archived quotes and computes rate', () => {
  const quotes = [
    { is_active: true, client_response: 'accepted' },
    { is_active: true, client_response: 'pending' },
    { is_active: false, client_response: 'accepted' },
    { is_active: true, client_response: 'rejected' },
  ];
  const stats = computeContractorStats(quotes);
  assert.equal(stats.total, 3);
  assert.equal(stats.accepted, 1);
  assert.equal(stats.rate, 33);
});
