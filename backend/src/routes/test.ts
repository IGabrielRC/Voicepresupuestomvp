import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { newSlug } from '../services/slug.js';

export const testRouter = Router();

// DEV ONLY. Simulates the full voice-note flow with a mock Gemini response.
// Use this to demo the editor and public view without sending a real voice note.
testRouter.post('/test/simulate-voice', async (req, res) => {
  const body = req.body || {};
  const telegram_user_id = body.telegram_user_id || 1000000001;
  const client_name = body.client_name || 'Juan Pérez';
  const client_contact = body.client_contact || '+54 11 5555-1234';
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
  const validityDays = 15;
  const expiresAt = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: quote, error: qErr } = await supabase
    .from('quotes')
    .insert({
      contractor_id: contractorId,
      slug,
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
    .select('id')
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

  res.json({
    quote_id: quote.id,
    slug,
    contractor_id: contractorId,
    edit_url: `${process.env.WEB_BASE_URL || 'http://localhost:5173'}/q/${quote.id}`,
    public_url: `${process.env.WEB_BASE_URL || 'http://localhost:5173'}/s/${slug}`,
  });
});
