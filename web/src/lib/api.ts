import type { Quote, QuoteItem, ContractorProfile, ClientResponse } from './types';

// Empty string = use relative URL (Vite proxy handles it in dev).
// In production, set VITE_API_URL=https://api.your-domain.com
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

async function jsonFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${text}`);
  }
  return res.json();
}

export const api = {
  getQuote: (id: string) =>
    jsonFetch<{ quote: Quote; items: QuoteItem[] }>(`/api/quotes/${id}`),

  patchQuote: (id: string, body: Partial<Quote> & { items: QuoteItem[] }) =>
    jsonFetch<{ quote: Quote; items: QuoteItem[] }>(`/api/quotes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  getQuoteBySlug: (slug: string) =>
    jsonFetch<{ quote: Quote; items: QuoteItem[] }>(`/api/quotes/slug/${slug}`),

  shareQuote: (id: string) =>
    jsonFetch<{ public_url: string; slug: string; id: string }>(`/api/quotes/${id}/share`, {
      method: 'POST',
    }),

  deleteQuote: (id: string) =>
    jsonFetch<{ ok: boolean }>(`/api/quotes/${id}`, { method: 'DELETE' }),

  // Client response: accept / reject / request changes. Public endpoint.
  respondToQuote: (slug: string, response: Exclude<ClientResponse, 'pending'>) =>
    jsonFetch<{ ok: boolean; response: ClientResponse }>(
      `/api/quotes/slug/${slug}/respond`,
      { method: 'POST', body: JSON.stringify({ response }) }
    ),

  getProfile: (contractorId: string) =>
    jsonFetch<{ profile: ContractorProfile | null }>(`/api/contractors/${contractorId}/profile`),

  patchProfile: (contractorId: string, body: Partial<ContractorProfile>) =>
    jsonFetch<{ profile: ContractorProfile }>(`/api/contractors/${contractorId}/profile`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  simulateVoice: (
    body: { telegram_user_id?: number; client_name?: string; currency?: string; items?: any[] } = {}
  ) =>
    jsonFetch<{
      quote_id: string;
      slug: string;
      contractor_id: string;
      edit_url: string;
      public_url: string;
    }>(`/api/test/simulate-voice`, { method: 'POST', body: JSON.stringify(body) }),

  getContractorByTelegram: (tgUserId: number) =>
    jsonFetch<{
      contractor: { id: string } | null;
      quotes: Array<{
        id: string;
        slug: string;
        client_name: string | null;
        client_contact: string | null;
        status: 'draft' | 'shared' | 'expired';
        client_response: 'pending' | 'accepted' | 'rejected' | 'changes_requested';
        currency: string;
        created_at: string;
        item_count: number;
      }>;
    }>(`/api/contractors/by-telegram/${tgUserId}`),
};
