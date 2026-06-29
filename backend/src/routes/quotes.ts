import { Router, Request, Response } from 'express';
import { env } from '../lib/env.js';
import { supabase } from '../lib/supabase.js';
import { sendMessage } from '../services/telegram.js';
import { checkPatchRateLimit } from '../middleware/rateLimit.js';
import { validatePatchQuoteBody } from '../middleware/validate.js';

export const quotesRouter = Router();

// Columns exposed by the public quote endpoint. Never expose edit_token here.
const PUBLIC_QUOTE_SELECT =
  'id, contractor_id, slug, client_name, client_contact, currency, notes, terms, validity_days, expires_at, status, client_response, total_override, created_at, quote_items(*)' as const;

async function loadQuote(id: string) {
  const { data, error } = await supabase
    .from('quotes')
    .select('*, quote_items(*)')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return data;
}

function getRequestEditToken(req: Request): string | null {
  const header = req.headers['x-edit-token'];
  if (typeof header === 'string' && header.length > 0) return header;
  if (Array.isArray(header) && typeof header[0] === 'string' && header[0].length > 0)
    return header[0];

  const query = req.query.t;
  if (typeof query === 'string' && query.length > 0) return query;
  if (Array.isArray(query) && typeof query[0] === 'string' && query[0].length > 0)
    return query[0];

  return null;
}

type AuthResult =
  | { ok: true; quoteId: string }
  | { ok: false; reason: 'missing' | 'invalid' | 'not_found' };

async function authorizeQuoteEdit(req: Request, id: string): Promise<AuthResult> {
  const token = getRequestEditToken(req);
  if (!token) return { ok: false, reason: 'missing' };

  const { data, error } = await supabase
    .from('quotes')
    .select('id, edit_token')
    .eq('id', id)
    .single();
  if (error || !data) return { ok: false, reason: 'not_found' };
  if (data.edit_token !== token) return { ok: false, reason: 'invalid' };

  return { ok: true, quoteId: data.id };
}

function invalidEditToken(res: Response) {
  return res.status(403).json({ error: 'invalid_edit_token' });
}

quotesRouter.get('/quotes/:id', async (req: Request, res: Response) => {
  const auth = await authorizeQuoteEdit(req, req.params.id);
  if (!auth.ok) return invalidEditToken(res);

  const data = await loadQuote(auth.quoteId);
  if (!data) return res.status(404).json({ error: 'not_found' });
  res.json({ quote: data, items: data.quote_items });
});

quotesRouter.patch('/quotes/:id', async (req: Request, res: Response) => {
  const auth = await authorizeQuoteEdit(req, req.params.id);
  if (!auth.ok) return invalidEditToken(res);

  // Rate limit: max 1 PATCH per second per IP. Prevents runaway auto-save loops.
  const ip = (req.ip || req.socket.remoteAddress || 'unknown').toString();
  if (!checkPatchRateLimit(ip)) {
    return res.status(429).json({ error: 'too_many_requests' });
  }

  // Input validation: reject malformed bodies early.
  const validationError = validatePatchQuoteBody(req.body);
  if (validationError) {
    return res.status(400).json({ error: 'invalid_input', message: validationError });
  }

  // Lock once accepted: prevent silent edits after the client signed off.
  const { data: current } = await supabase
    .from('quotes')
    .select('client_response, status')
    .eq('id', auth.quoteId)
    .single();
  if (current?.client_response === 'accepted') {
    return res.status(403).json({
      error: 'quote_locked',
      message: 'Este presupuesto ya fue aceptado por el cliente. Creá uno nuevo si necesitás hacer cambios.',
    });
  }

  const { client_name, client_contact, currency, notes, terms, validity_days, total_override, items } = req.body;

  let expires_at: string | null = null;
  if (validity_days) {
    expires_at = new Date(Date.now() + Number(validity_days) * 24 * 60 * 60 * 1000).toISOString();
  }

  const { error: uErr } = await supabase
    .from('quotes')
    .update({ client_name, client_contact, currency, notes, terms, validity_days, expires_at, total_override })
    .eq('id', auth.quoteId);
  if (uErr) return res.status(500).json({ error: uErr.message });

  // Replace items (simple and correct for MVP).
  await supabase.from('quote_items').delete().eq('quote_id', auth.quoteId);
  if (Array.isArray(items) && items.length > 0) {
    const rows = items.map((it: any, i: number) => ({
      quote_id: auth.quoteId,
      description: it.description,
      qty: it.qty,
      unit_price: it.unit_price,
      line_total: it.qty && it.unit_price ? Number(it.qty) * Number(it.unit_price) : 0,
      sort_order: it.sort_order ?? i,
    }));
    const { error: iErr } = await supabase.from('quote_items').insert(rows);
    if (iErr) return res.status(500).json({ error: iErr.message });
  }

  const data = await loadQuote(auth.quoteId);
  res.json({ quote: data, items: data?.quote_items || [] });
});

quotesRouter.get('/quotes/slug/:slug', async (req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('quotes')
    .select(PUBLIC_QUOTE_SELECT)
    .eq('slug', req.params.slug)
    .single();
  if (error || !data) return res.status(404).json({ error: 'not_found' });
  res.json({ quote: data, items: data.quote_items });
});

quotesRouter.post('/quotes/:id/share', async (req: Request, res: Response) => {
  const auth = await authorizeQuoteEdit(req, req.params.id);
  if (!auth.ok) return invalidEditToken(res);

  const { data, error } = await supabase
    .from('quotes')
    .update({ status: 'shared' })
    .eq('id', auth.quoteId)
    .select('slug, id')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  const public_url = `${env.WEB_BASE_URL}/s/${data.slug}`;
  res.json({ public_url, slug: data.slug, id: data.id });
});

// Delete a quote. Items cascade (FK ON DELETE CASCADE).
quotesRouter.delete('/quotes/:id', async (req: Request, res: Response) => {
  const auth = await authorizeQuoteEdit(req, req.params.id);
  if (!auth.ok) return invalidEditToken(res);

  const { error } = await supabase.from('quotes').delete().eq('id', auth.quoteId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// Client response: accept / reject / request changes. Public endpoint (no auth for MVP).
// Notifies the contractor via Telegram.
quotesRouter.post('/quotes/slug/:slug/respond', async (req: Request, res: Response) => {
  const { response } = req.body || {};
  if (!['accepted', 'rejected', 'changes_requested'].includes(response)) {
    return res.status(400).json({ error: 'invalid_response' });
  }

  // Fetch quote with contractor's telegram_user_id and edit_token (via FK join).
  const { data: quote, error: qErr } = await supabase
    .from('quotes')
    .select('id, contractor_id, client_name, slug, edit_token, contractors(telegram_user_id)')
    .eq('slug', req.params.slug)
    .single();
  if (qErr || !quote) return res.status(404).json({ error: 'not_found' });

  const { error: uErr } = await supabase
    .from('quotes')
    .update({ client_response: response })
    .eq('id', quote.id);
  if (uErr) return res.status(500).json({ error: uErr.message });

  // Notify contractor via Telegram (best-effort, don't fail the request if it fails).
  const telegramUserId = (quote as any).contractors?.telegram_user_id;
  if (telegramUserId) {
    const labels: Record<string, string> = {
      accepted: '✅ ACEPTÓ',
      rejected: '❌ RECHAZÓ',
      changes_requested: '💬 PIDIÓ CAMBIOS en',
    };
    const verb = labels[response];
    const clientName = quote.client_name || 'tu cliente';
    const editToken = (quote as any).edit_token;
    const editUrl = `${env.WEB_BASE_URL}/q/${quote.id}?t=${editToken}`;
    try {
      await sendMessage(
        telegramUserId,
        `${verb} tu presupuesto, <b>${escapeHtml(clientName)}</b>.\n\nTocá un botón:`,
        {
          inline_keyboard: [
            [{ text: '📝 Ver y editar', url: editUrl }],
            [{ text: '➕ Crear nuevo', url: `${env.WEB_BASE_URL}/` }],
          ],
        }
      );
    } catch (e) {
      console.error('[respond] telegram notify failed', e);
    }
  }

  res.json({ ok: true, response });
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
