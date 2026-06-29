export interface QuoteItem {
  id?: string;
  description: string;
  qty: number | null;
  unit_price: number | null;
  line_total: number;
  sort_order: number;
}

export type ClientResponse = 'pending' | 'accepted' | 'rejected' | 'changes_requested';

export interface Quote {
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
  status: 'draft' | 'shared' | 'expired';
  client_response: ClientResponse;
  total_override: number | null;
  edit_token?: string | null;
  is_active?: boolean | null;
  replaced_by_slug?: string | null;
  created_at: string;
}

export interface ContractorProfile {
  id?: string;
  contractor_id: string;
  business_name: string | null;
  logo_url: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  address: string | null;
  terms: string | null;
  default_currency: string;
}
