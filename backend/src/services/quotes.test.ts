import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isShareMode,
  buildInactiveSlugMessage,
  buildCloneRow,
  buildCloneItems,
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
