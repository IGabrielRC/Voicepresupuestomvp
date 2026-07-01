import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { trackEvent } from '../lib/analytics.js';
import { newSlug } from '../services/slug.js';
import { newEditToken } from '../services/token.js';

export const testRouter = Router();

// DEV ONLY. Simulates the full voice-note flow with a mock Gemini response.
// Use this to demo the editor and public view without sending a real voice note.
testRouter.post('/test/simulate-voice', async (req, res) => {
  const body = req.body || {};
  const telegram_user_id = body.telegram_user_id || 1000000001;
  const client_name = body.client_name || 'Juan Pérez';
  const client_contact = body.client_contact || '+58 412 555-1234';
  const currency = body.currency || 'USD';
  const notes = body.notes ?? 'Materiales a cargo del cliente.';
  const terms = body.terms ?? '50% anticipo, saldo contra entrega.';
  const fakeItems = body.items || [
    { description: 'Pared de durlock (mano de obra)', qty: 2, unit_price: 8000 },
    { description: 'Pintura interior (m²)', qty: 12, unit_price: 5000 },
    { description: 'Viaje de materiales', qty: 1, unit_price: 15000 },
  ];

  // Find or create contractor
  let { data: existing } = await supabase
    .from('contractors')
    .select('id')
    .eq('telegram_user_id', telegram_user_id)
    .single();

  let contractorId = existing?.id;
  if (!contractorId) {
    const { data: created, error } = await supabase
      .from('contractors')
      .insert({ telegram_user_id })
      .select('id')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    contractorId = created.id;
  }

  const slug = newSlug();
  const editToken = newEditToken();
  const validityDays = 3;
  const expiresAt = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: quote, error: qErr } = await supabase
    .from('quotes')
    .insert({
      contractor_id: contractorId,
      slug,
      edit_token: editToken,
      client_name,
      client_contact,
      currency,
      notes,
      terms,
      validity_days: validityDays,
      expires_at: expiresAt,
      status: 'draft',
      raw_gemini_output: JSON.stringify({ source: 'simulate-voice' }),
    })
    .select('id, edit_token')
    .single();
  if (qErr) return res.status(500).json({ error: qErr.message });

  const items = fakeItems.map((it: any, i: number) => ({
    quote_id: quote.id,
    description: it.description,
    qty: it.qty,
    unit_price: it.unit_price,
    line_total: (it.qty || 0) * (it.unit_price || 0),
    sort_order: i,
  }));
  const { error: iErr } = await supabase.from('quote_items').insert(items);
  if (iErr) return res.status(500).json({ error: iErr.message });

  // Track the slug so public links resolve through quote_slugs history.
  const { error: slugErr } = await supabase.from('quote_slugs').insert({
    slug,
    quote_id: quote.id,
    is_active: true,
    created_at: new Date().toISOString(),
  });
  if (slugErr) console.error('[test] quote_slugs insert failed', slugErr);

  trackEvent({
    event_type: 'quote_created',
    contractor_id: contractorId,
    quote_id: quote.id,
    slug,
    metadata: { source: 'demo_route', items_count: fakeItems.length },
  });

  res.json({
    quote_id: quote.id,
    slug,
    contractor_id: contractorId,
    edit_url: `${process.env.WEB_BASE_URL || 'http://localhost:5173'}/q/${quote.id}?t=${quote.edit_token}`,
    public_url: `${process.env.WEB_BASE_URL || 'http://localhost:5173'}/s/${slug}`,
  });
});
