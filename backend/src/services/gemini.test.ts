import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuoteJson, PROMPT } from './gemini.js';

test('parseQuoteJson keeps distinct unpriced tasks as separate items', () => {
  const raw = JSON.stringify({
    client_name: null,
    client_contact: null,
    currency: 'USD',
    notes: null,
    terms: null,
    items: [
      { description: 'Arreglar canilla', qty: null, unit_price: null },
      { description: 'Cambiar cerradura', qty: null, unit_price: null },
      { description: 'Pintar pared', qty: null, unit_price: null },
    ],
    missing_fields: [],
  });

  const result = parseQuoteJson(raw);

  assert.equal(result.items.length, 3);
  assert.equal(result.items[0].description, 'Arreglar canilla');
  assert.equal(result.items[0].qty, 1);
  assert.equal(result.items[0].unit_price, null);
  assert.equal(result.items[1].description, 'Cambiar cerradura');
  assert.equal(result.items[2].description, 'Pintar pared');
});

test('parseQuoteJson preserves unit_price: null', () => {
  const raw = JSON.stringify({
    items: [{ description: 'Revisar pérdida', qty: 1, unit_price: null }],
  });

  const result = parseQuoteJson(raw);

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].unit_price, null);
  assert.equal(result.items[0].qty, 1);
});

test('parseQuoteJson extracts JSON from markdown wrapper', () => {
  const raw = 'Aquí tienes:\n```json\n{"items":[{"description":"Test","qty":2,"unit_price":100}]}\n```';

  const result = parseQuoteJson(raw);

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].description, 'Test');
  assert.equal(result.items[0].qty, 2);
  assert.equal(result.items[0].unit_price, 100);
});

test('prompt example 1 does not claim 4 items for 3 listed items', () => {
  assert.doesNotMatch(PROMPT, /→ 4 items/);
  assert.match(PROMPT, /Ejemplo 1:[\s\S]*?→ 3 items/);
});
