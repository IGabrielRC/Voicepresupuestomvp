import type { Quote, QuoteItem, ContractorProfile, ClientResponse } from './types';

// Empty string = use relative URL (Vite proxy handles it in dev).
// In production, set VITE_API_URL=https://api.your-domain.com
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

async function parseError(res: Response): Promise<string> {
  const text = await res.text();
  if (!text) return `Error ${res.status}`;
  if (text.trim().startsWith('<')) {
    return `Error ${res.status} del servidor. Probá de nuevo en unos segundos.`;
  }
  try {
    const parsed = JSON.parse(text);
    if (parsed.message) return parsed.message;
    if (parsed.error) return parsed.error;
  } catch {
    /* fall through to raw text */
  }
  return text;
}

async function jsonFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
  });
  if (!res.ok) {
    const message = await parseError(res);
    throw new Error(message);
  }
  return res.json();
}

function authHeaders(token?: string): Record<string, string> {
  return token ? { 'x-edit-token': token } : {};
}

export const api = {
  getQuote: (id: string, token?: string) =>
    jsonFetch<{ quote: Quote; items: QuoteItem[] }>(`/api/quotes/${id}`, {
      headers: authHeaders(token),
    }),

  patchQuote: (id: string, body: Partial<Quote> & { items: QuoteItem[] }, token?: string) =>
    jsonFetch<{ quote: Quote; items: QuoteItem[] }>(`/api/quotes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: authHeaders(token),
    }),

  getQuoteBySlug: (slug: string) =>
    jsonFetch<{ quote: Quote; items: QuoteItem[] }>(`/api/quotes/slug/${slug}`),

  shareQuote: (id: string, token?: string) =>
    jsonFetch<{ public_url: string; slug: string; id: string }>(`/api/quotes/${id}/share`, {
      method: 'POST',
      headers: authHeaders(token),
    }),

  deleteQuote: (id: string, token?: string) =>
    jsonFetch<{ ok: boolean }>(`/api/quotes/${id}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    }),

  // Client response: accept / reject / request changes. Public endpoint.
  respondToQuote: (slug: string, response: Exclude<ClientResponse, 'pending'>) =>
    jsonFetch<{ ok: boolean; response: ClientResponse }>(
      `/api/quotes/slug/${slug}/respond`,
      { method: 'POST', body: JSON.stringify({ response }) }
    ),

  getProfile: (contractorId: string) =>
    jsonFetch<{ profile: ContractorProfile | null }>(`/api/contractors/${contractorId}/profile`),

  patchProfile: (contractorId: string, body: Partial<ContractorProfile>, token?: string) =>
    jsonFetch<{ profile: ContractorProfile }>(`/api/contractors/${contractorId}/profile`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: authHeaders(token),
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
        edit_token: string | null;
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
