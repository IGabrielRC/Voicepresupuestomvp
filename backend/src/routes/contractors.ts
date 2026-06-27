import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';

export const contractorsRouter = Router();

contractorsRouter.get('/contractors/:id/profile', async (req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('contractor_profiles')
    .select('*')
    .eq('contractor_id', req.params.id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ profile: data });
});

contractorsRouter.patch('/contractors/:id/profile', async (req: Request, res: Response) => {
  const { business_name, logo_url, contact_phone, contact_email, address, terms, default_currency } = req.body;
  const row = {
    contractor_id: req.params.id,
    business_name: business_name ?? null,
    logo_url: logo_url ?? null,
    contact_phone: contact_phone ?? null,
    contact_email: contact_email ?? null,
    address: address ?? null,
    terms: terms ?? null,
    default_currency: default_currency ?? 'USD',
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('contractor_profiles')
    .upsert(row, { onConflict: 'contractor_id' })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ profile: data });
});

// Find a contractor by their Telegram user ID, and return their quotes.
// Used by the web history page (linked from Telegram via /q/history?tg=X).
contractorsRouter.get('/contractors/by-telegram/:tg_id', async (req: Request, res: Response) => {
  const tgId = Number(req.params.tg_id);
  if (!Number.isFinite(tgId)) {
    return res.status(400).json({ error: 'invalid_tg_id' });
  }

  const { data: contractor, error: cErr } = await supabase
    .from('contractors')
    .select('id')
    .eq('telegram_user_id', tgId)
    .maybeSingle();
  if (cErr) return res.status(500).json({ error: cErr.message });

  if (!contractor) {
    return res.json({ contractor: null, quotes: [] });
  }

  const { data: quotes, error: qErr } = await supabase
    .from('quotes')
    .select(
      'id, slug, client_name, client_contact, status, client_response, currency, created_at'
    )
    .eq('contractor_id', contractor.id)
    .order('created_at', { ascending: false })
    .limit(20);
  if (qErr) return res.status(500).json({ error: qErr.message });

  // For each quote, count items so the list can show "3 items" without a separate request.
  const quoteIds = (quotes || []).map((q) => q.id);
  let itemCounts: Record<string, number> = {};
  if (quoteIds.length > 0) {
    const { data: items } = await supabase
      .from('quote_items')
      .select('quote_id')
      .in('quote_id', quoteIds);
    if (items) {
      for (const it of items) {
        itemCounts[it.quote_id] = (itemCounts[it.quote_id] || 0) + 1;
      }
    }
  }

  const enriched = (quotes || []).map((q) => ({
    ...q,
    item_count: itemCounts[q.id] || 0,
  }));

  res.json({ contractor, quotes: enriched });
});
