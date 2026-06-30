export type ShareMode = 'reissue_changes' | 'reissue_rejected' | 'share_accepted';

export interface QuoteItemLike {
  description: string | null;
  qty: number | null;
  unit_price: number | null;
  line_total: number;
  sort_order: number;
}

export interface QuoteLike {
  id: string;
  contractor_id: string;
  slug: string;
  client_name: string | null;
  client_contact: string | null;
  currency: string;
  notes: string | null;
  terms: string | null;
  validity_days: number | null;
  expires_at: string | null;
  status: string;
  client_response: string;
  total_override: number | null;
  is_active?: boolean | null;
  quote_items?: Array<QuoteItemLike>;
}

export function isShareMode(value: unknown): value is ShareMode {
  return value === 'reissue_changes' || value === 'reissue_rejected' || value === 'share_accepted';
}

export function buildInactiveSlugMessage(
  clientResponse: string | null | undefined,
  newSlug: string | null | undefined
): { error: 'replaced'; message: string; new_slug?: string } {
  const hasReplacement = !!newSlug;

  if (clientResponse === 'rejected') {
    return {
      error: 'replaced',
      message: hasReplacement
        ? 'Este presupuesto fue rechazado y reemplazado.'
        : 'Este presupuesto fue rechazado.',
      ...(newSlug ? { new_slug: newSlug } : {}),
    };
  }

  if (clientResponse === 'changes_requested') {
    return {
      error: 'replaced',
      message: hasReplacement
        ? 'Este presupuesto se reemplazó por una nueva versión.'
        : 'Este presupuesto ya no está disponible.',
      ...(newSlug ? { new_slug: newSlug } : {}),
    };
  }

  return {
    error: 'replaced',
    message: hasReplacement
      ? 'Este presupuesto se reemplazó por una nueva versión.'
      : 'Este presupuesto ya no está disponible.',
    ...(newSlug ? { new_slug: newSlug } : {}),
  };
}

export function buildCloneRow(
  quote: QuoteLike,
  newSlug: string,
  newEditToken: string
): Omit<QuoteLike, 'id' | 'created_at' | 'quote_items'> & { edit_token: string } {
  return {
    contractor_id: quote.contractor_id,
    slug: newSlug,
    edit_token: newEditToken,
    client_name: quote.client_name,
    client_contact: quote.client_contact,
    currency: quote.currency,
    notes: quote.notes,
    terms: quote.terms,
    validity_days: quote.validity_days,
    expires_at: quote.expires_at,
    status: 'shared',
    client_response: 'pending',
    total_override: quote.total_override,
    is_active: true,
  };
}

export function buildCloneItems(
  items: QuoteLike['quote_items'],
  newQuoteId: string
): Array<{
  quote_id: string;
  description: string | null;
  qty: number | null;
  unit_price: number | null;
  line_total: number;
  sort_order: number;
}> {
  return (items || []).map((it, i) => ({
    quote_id: newQuoteId,
    description: it.description ?? null,
    qty: it.qty ?? null,
    unit_price: it.unit_price ?? null,
    line_total: it.line_total ?? 0,
    sort_order: it.sort_order ?? i,
  }));
}

/**
 * Compares the last saved JSON snapshot with the current quote + items.
 * Returns true when there are unsaved changes (caller should save before share).
 */
export function isQuoteDirty(
  lastSavedSnapshot: string | null | undefined,
  quote: Record<string, unknown>,
  items: Array<Record<string, unknown>>
): boolean {
  if (!lastSavedSnapshot) return true;
  try {
    return lastSavedSnapshot !== JSON.stringify({ q: quote, i: items });
  } catch {
    return true;
  }
}

/** Inserts a new item at the top of the list and recomputes sort_order. */
export function insertItemAtTop<T extends QuoteItemLike>(
  items: T[],
  newItem: Omit<T, 'sort_order'>
): T[] {
  return [{ ...newItem, sort_order: 0 } as T, ...items.map((it, i) => ({ ...it, sort_order: i + 1 }))];
}

/** Computes acceptance stats from a contractor's quotes (archived quotes excluded). */
export function computeContractorStats(
  quotes: Array<{ is_active?: boolean | null; client_response: string }>
): { total: number; accepted: number; rate: number } {
  const active = quotes.filter((q) => q.is_active !== false);
  const total = active.length;
  const accepted = active.filter((q) => q.client_response === 'accepted').length;
  const rate = total > 0 ? Math.round((accepted / total) * 100) : 0;
  return { total, accepted, rate };
}
