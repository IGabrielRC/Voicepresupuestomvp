// Basic input validation for the PATCH /api/quotes/:id body.
// Returns null if valid, or an error message string.

const MAX_NAME = 200;
const MAX_NOTES = 5000;
const MAX_DESCRIPTION = 500;
const MAX_ITEMS = 100;
const ALLOWED_CURRENCIES = new Set(['USD', 'VES', 'ARS', 'EUR', 'MXN', 'COP', 'BRL']);

export function validatePatchQuoteBody(body: any): string | null {
  if (!body || typeof body !== 'object') return 'body inválido';

  if (body.client_name !== null && body.client_name !== undefined) {
    if (typeof body.client_name !== 'string') return 'client_name debe ser string';
    if (body.client_name.length > MAX_NAME) return `client_name excede ${MAX_NAME} chars`;
  }

  if (body.client_contact !== null && body.client_contact !== undefined) {
    if (typeof body.client_contact !== 'string') return 'client_contact debe ser string';
    if (body.client_contact.length > MAX_NAME) return `client_contact excede ${MAX_NAME} chars`;
  }

  if (body.currency !== null && body.currency !== undefined) {
    if (typeof body.currency !== 'string') return 'currency debe ser string';
    if (!ALLOWED_CURRENCIES.has(body.currency)) return `currency inválida: ${body.currency}`;
  }

  if (body.notes !== null && body.notes !== undefined) {
    if (typeof body.notes !== 'string') return 'notes debe ser string';
    if (body.notes.length > MAX_NOTES) return `notes excede ${MAX_NOTES} chars`;
  }

  if (body.terms !== null && body.terms !== undefined) {
    if (typeof body.terms !== 'string') return 'terms debe ser string';
    if (body.terms.length > MAX_NOTES) return `terms excede ${MAX_NOTES} chars`;
  }

  if (body.validity_days !== null && body.validity_days !== undefined) {
    if (typeof body.validity_days !== 'number') return 'validity_days debe ser número';
    if (body.validity_days < 1 || body.validity_days > 3650) return 'validity_days fuera de rango (1-3650)';
  }

  if (body.total_override !== null && body.total_override !== undefined) {
    if (typeof body.total_override !== 'number' || !Number.isFinite(body.total_override))
      return 'total_override debe ser un número válido';
    if (body.total_override < 0) return 'total_override no puede ser negativo';
  }

  if (body.items !== null && body.items !== undefined) {
    if (!Array.isArray(body.items)) return 'items debe ser array';
    if (body.items.length > MAX_ITEMS) return `máximo ${MAX_ITEMS} items`;
    for (let i = 0; i < body.items.length; i++) {
      const it = body.items[i];
      if (!it || typeof it !== 'object') return `item[${i}] inválido`;
      if (typeof it.description !== 'string') return `item[${i}].description debe ser string`;
      if (it.description.length > MAX_DESCRIPTION)
        return `item[${i}].description excede ${MAX_DESCRIPTION} chars`;
      if (it.qty !== null && it.qty !== undefined) {
        if (typeof it.qty !== 'number' || !Number.isFinite(it.qty) || it.qty < 0)
          return `item[${i}].qty inválido`;
      }
      if (it.unit_price !== null && it.unit_price !== undefined) {
        if (
          typeof it.unit_price !== 'number' ||
          !Number.isFinite(it.unit_price) ||
          it.unit_price < 0
        )
          return `item[${i}].unit_price inválido`;
      }
    }
  }

  return null;
}
