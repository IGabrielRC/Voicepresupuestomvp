import { Router, Request, Response } from 'express';
import { env } from '../lib/env.js';
import { supabase } from '../lib/supabase.js';
import { trackEvent } from '../lib/analytics.js';
import { sendMessage } from '../services/telegram.js';
import { newSlug } from '../services/slug.js';
import { newEditToken } from '../services/token.js';
import {
  isShareMode,
  buildInactiveSlugMessage,
  buildCloneRow,
  buildCloneItems,
  type ShareMode,
} from '../services/quotes.js';
import { checkPatchRateLimit, checkViewRateLimit } from '../middleware/rateLimit.js';
import { validatePatchQuoteBody } from '../middleware/validate.js';

const MAX_SLUG_ATTEMPTS = 3;

function isUniqueViolation(error: any): boolean {
  return error?.code === '23505';
}

export const quotesRouter = Router();

// Columns exposed by the public quote endpoint. Never expose edit_token here.
const PUBLIC_QUOTE_SELECT =
  'id, contractor_id, slug, client_name, client_contact, currency, notes, terms, validity_days, expires_at, status, client_response, total_override, created_at, is_active, quote_items(*)' as const;

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

async function ensureSlugActive(quoteId: string, slug: string) {
  const now = new Date().toISOString();
  const { error } = await supabase.from('quote_slugs').upsert(
    {
      slug,
      quote_id: quoteId,
      is_active: true,
      created_at: now,
    },
    { onConflict: 'slug' }
  );
  if (error) console.error('[ensureSlugActive] failed', error);
}

async function deactivateSlug(
  quoteId: string,
  slug: string,
  replacedBySlug: string,
  now: string
) {
  const { error } = await supabase.from('quote_slugs').upsert(
    {
      slug,
      quote_id: quoteId,
      is_active: false,
      replaced_by_slug: replacedBySlug,
      created_at: now,
    },
    { onConflict: 'slug' }
  );
  if (error) console.error('[deactivateSlug] failed', error);
}

async function deactivateActiveSlugsExcept(
  quoteId: string,
  keepSlug: string,
  replacedBySlug: string
) {
  const { error } = await supabase
    .from('quote_slugs')
    .update({ is_active: false, replaced_by_slug: replacedBySlug })
    .eq('quote_id', quoteId)
    .eq('is_active', true)
    .neq('slug', keepSlug);
  if (error) console.error('[deactivateActiveSlugsExcept] failed', error);
}

async function tryReserveSlug(
  quoteId: string,
  slug: string,
  now: string
): Promise<{ ok: true } | { ok: false; collision: boolean; message: string }> {
  const { error } = await supabase.from('quote_slugs').insert({
    slug,
    quote_id: quoteId,
    is_active: true,
    created_at: now,
  });
  if (!error) return { ok: true };
  return {
    ok: false,
    collision: isUniqueViolation(error),
    message: error.message || 'No se pudo reservar el link público.',
  };
}

async function resolveReplacementSlug(
  replacedBySlug: string | null | undefined
): Promise<string | null> {
  if (!replacedBySlug) return null;
  const { data: replacement } = await supabase
    .from('quote_slugs')
    .select('is_active')
    .eq('slug', replacedBySlug)
    .single();
  return replacement?.is_active ? replacedBySlug : null;
}

async function buildInactiveResponse(quoteId: string): Promise<{ error: 'replaced'; message: string; new_slug?: string }> {
  const { data: sourceQuote } = await supabase
    .from('quotes')
    .select('client_response, replaced_by_slug')
    .eq('id', quoteId)
    .single();

  let newSlug: string | null = await resolveReplacementSlug(sourceQuote?.replaced_by_slug);
  return buildInactiveSlugMessage(sourceQuote?.client_response, newSlug);
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

  // Lock once accepted or archived: prevent edits on signed-off / replaced quotes.
  const { data: current } = await supabase
    .from('quotes')
    .select('client_response, status, is_active')
    .eq('id', auth.quoteId)
    .single();
  if (current?.is_active === false) {
    return res.status(403).json({
      error: 'quote_archived',
      message: 'Este presupuesto está archivado. Crea uno nuevo si necesitas hacer cambios.',
    });
  }
  if (current?.client_response === 'accepted') {
    return res.status(403).json({
      error: 'quote_locked',
      message: 'Este presupuesto ya fue aceptado por el cliente. Crea uno nuevo si necesitas hacer cambios.',
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
  const slug = req.params.slug;

  // Slug history is the source of truth for public links.
  const { data: slugRow, error: sErr } = await supabase
    .from('quote_slugs')
    .select('quote_id, is_active, replaced_by_slug')
    .eq('slug', slug)
    .single();

  if (sErr || !slugRow) {
    // Fallback for any legacy slug not yet in history.
    const { data, error } = await supabase
      .from('quotes')
      .select(PUBLIC_QUOTE_SELECT)
      .eq('slug', slug)
      .single();
    if (error || !data) return res.status(404).json({ error: 'not_found' });
    const is_expired = data.expires_at ? new Date(data.expires_at).getTime() < Date.now() : false;
    return res.json({ quote: { ...data, is_expired }, items: data.quote_items });
  }

  if (!slugRow.is_active) {
    const newSlug = await resolveReplacementSlug(slugRow.replaced_by_slug);
    const { data: sourceQuote } = await supabase
      .from('quotes')
      .select('client_response')
      .eq('id', slugRow.quote_id)
      .single();

    const body = buildInactiveSlugMessage(sourceQuote?.client_response, newSlug);
    return res.status(410).json(body);
  }

  const { data, error } = await supabase
    .from('quotes')
    .select(PUBLIC_QUOTE_SELECT)
    .eq('id', slugRow.quote_id)
    .single();
  if (error || !data) return res.status(404).json({ error: 'not_found' });
  const is_expired = data.expires_at ? new Date(data.expires_at).getTime() < Date.now() : false;
  res.json({ quote: { ...data, is_expired }, items: data.quote_items });
});

// Public "view receipt": records that someone opened the public quote and notifies the contractor.
// Rate-limited to 1 call per minute per IP+slug so Telegram isn't spammed on refreshes.
quotesRouter.post('/quotes/slug/:slug/viewed', async (req: Request, res: Response) => {
  const slug = req.params.slug;
  const ip = (req.ip || req.socket.remoteAddress || 'unknown').toString();

  if (!checkViewRateLimit(ip, slug)) {
    return res.status(429).json({ error: 'too_many_requests' });
  }

  // Resolve slug to quote (prefer slug history, fallback to legacy slug on quotes table).
  const { data: slugRow, error: sErr } = await supabase
    .from('quote_slugs')
    .select('quote_id, is_active, replaced_by_slug')
    .eq('slug', slug)
    .single();

  let quoteId: string | null = null;
  if (sErr || !slugRow) {
    const { data: legacy } = await supabase
      .from('quotes')
      .select('id, is_active')
      .eq('slug', slug)
      .single();
    if (!legacy) return res.status(404).json({ error: 'not_found' });
    if (legacy.is_active === false) {
      const body = await buildInactiveResponse(legacy.id);
      return res.status(410).json(body);
    }
    quoteId = legacy.id;
  } else {
    if (!slugRow.is_active) {
      const body = await buildInactiveResponse(slugRow.quote_id);
      return res.status(410).json(body);
    }
    quoteId = slugRow.quote_id;
  }

  const { data: quote, error: qErr } = await supabase
    .from('quotes')
    .select('id, contractor_id, client_name, edit_token, view_count, contractors(telegram_user_id)')
    .eq('id', quoteId)
    .single();
  if (qErr || !quote) return res.status(404).json({ error: 'not_found' });

  // Update view timestamp + counter atomically. Use an SQL increment so concurrent
  // viewers do not lose updates.
  const now = new Date().toISOString();
  const previousCount = (quote as any).view_count || 0;
  await supabase.rpc('increment_quote_view', { quote_id: quote.id, now });

  // Notify contractor only on the first view of this quote (view_count went 0 -> 1).
  // Self-notification suppression: the public link has no edit token, so we treat
  // the contractor the same as a client and only fire on the very first open.
  const isFirstView = previousCount === 0;

  trackEvent({
    event_type: 'quote_viewed',
    contractor_id: quote.contractor_id,
    quote_id: quote.id,
    slug,
    metadata: { first_view: isFirstView },
  });

  const telegramUserId = (quote as any).contractors?.telegram_user_id;
  if (isFirstView && telegramUserId) {
    const clientName = quote.client_name || 'tu cliente';
    const editUrl = `${env.WEB_BASE_URL}/q/${quote.id}?t=${(quote as any).edit_token}`;
    try {
      await sendMessage(
        telegramUserId,
        `👀 <b>${escapeHtml(clientName)} abrió el presupuesto.</b>`,
        {
          inline_keyboard: [[{ text: '📝 Ver presupuesto', url: editUrl }]],
        }
      );
    } catch (e) {
      console.error('[viewed] telegram notify failed', e);
    }
  }

  res.json({ ok: true });
});

quotesRouter.post('/quotes/:id/share', async (req: Request, res: Response) => {
  const auth = await authorizeQuoteEdit(req, req.params.id);
  if (!auth.ok) return invalidEditToken(res);

  const mode: ShareMode = isShareMode(req.body?.mode) ? req.body.mode : 'share_accepted';

  const { data: quote, error: qErr } = await supabase
    .from('quotes')
    .select('*, quote_items(*)')
    .eq('id', auth.quoteId)
    .single();
  if (qErr || !quote) return res.status(404).json({ error: 'not_found' });

  if (quote.is_active === false) {
    return res.status(403).json({
      error: 'quote_archived',
      message: 'Este presupuesto está archivado y no se puede compartir.',
    });
  }

  const publicBase = `${env.WEB_BASE_URL}/s`;
  const now = new Date().toISOString();

  // Default / accepted: keep the same slug and mark as shared.
  if (mode === 'share_accepted') {
    const { data, error } = await supabase
      .from('quotes')
      .update({ status: 'shared' })
      .eq('id', quote.id)
      .select('slug, id')
      .single();
    if (error) return res.status(500).json({ error: error.message });

    await ensureSlugActive(quote.id, data.slug);

    trackEvent({
      event_type: 'quote_shared',
      contractor_id: quote.contractor_id,
      quote_id: quote.id,
      slug: data.slug,
      metadata: { mode },
    });

    const public_url = `${publicBase}/${data.slug}`;
    return res.json({ public_url, slug: data.slug, id: data.id });
  }

  // Changes requested: same quote, fresh slug, old slug becomes inactive.
  if (mode === 'reissue_changes') {
    let nextSlug: string | null = null;
    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
      const candidate = newSlug();
      const reserved = await tryReserveSlug(quote.id, candidate, now);
      if (reserved.ok) {
        nextSlug = candidate;
        break;
      }
      if (!reserved.collision) {
        return res.status(500).json({ error: reserved.message });
      }
    }
    if (!nextSlug) {
      return res.status(500).json({ error: 'slug_collision' });
    }

    // Deactivate every other active slug for this quote so prior reissues stop leaking.
    await deactivateActiveSlugsExcept(quote.id, nextSlug, nextSlug);

    const { error: uErr } = await supabase
      .from('quotes')
      .update({ slug: nextSlug, status: 'shared', client_response: 'pending' })
      .eq('id', quote.id);
    if (uErr) return res.status(500).json({ error: uErr.message });

    trackEvent({
      event_type: 'quote_shared',
      contractor_id: quote.contractor_id,
      quote_id: quote.id,
      slug: nextSlug,
      metadata: { mode },
    });
    trackEvent({
      event_type: 'quote_reissued',
      contractor_id: quote.contractor_id,
      quote_id: quote.id,
      slug: nextSlug,
      metadata: { mode, old_slug: quote.slug, new_slug: nextSlug },
    });

    const public_url = `${publicBase}/${nextSlug}`;
    return res.json({ public_url, slug: nextSlug, id: quote.id });
  }

  // Rejected: clone the quote, archive the original, old slug points to the new one.
  let nextSlug = newSlug();
  const nextEditToken = newEditToken();
  const cloneRow = buildCloneRow(quote, nextSlug, nextEditToken);

  const { data: newQuote, error: cErr } = await supabase
    .from('quotes')
    .insert(cloneRow)
    .select('id, slug')
    .single();
  if (cErr) return res.status(500).json({ error: cErr.message });

  const itemRows = buildCloneItems(quote.quote_items, newQuote.id);
  if (itemRows.length > 0) {
    const { error: iErr } = await supabase.from('quote_items').insert(itemRows);
    if (iErr) {
      await supabase.from('quotes').delete().eq('id', newQuote.id);
      return res.status(500).json({ error: iErr.message });
    }
  }

  let reservedSlug: string | null = null;
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const { error: insertErr } = await supabase.from('quote_slugs').insert({
      slug: nextSlug,
      quote_id: newQuote.id,
      is_active: true,
      created_at: now,
    });
    if (!insertErr) {
      reservedSlug = nextSlug;
      break;
    }
    if (!isUniqueViolation(insertErr)) {
      await supabase.from('quotes').delete().eq('id', newQuote.id);
      return res.status(500).json({ error: insertErr.message });
    }
    nextSlug = newSlug();
    const { error: updateErr } = await supabase
      .from('quotes')
      .update({ slug: nextSlug })
      .eq('id', newQuote.id);
    if (updateErr) {
      await supabase.from('quotes').delete().eq('id', newQuote.id);
      return res.status(500).json({ error: updateErr.message });
    }
  }

  if (!reservedSlug) {
    await supabase.from('quotes').delete().eq('id', newQuote.id);
    return res.status(500).json({ error: 'slug_collision' });
  }

  await supabase
    .from('quotes')
    .update({ is_active: false, replaced_by_slug: reservedSlug, status: 'shared' })
    .eq('id', quote.id);

  await deactivateSlug(quote.id, quote.slug, reservedSlug, now);

  trackEvent({
    event_type: 'quote_shared',
    contractor_id: quote.contractor_id,
    quote_id: newQuote.id,
    slug: reservedSlug,
    metadata: { mode },
  });
  trackEvent({
    event_type: 'quote_reissued',
    contractor_id: quote.contractor_id,
    quote_id: newQuote.id,
    slug: reservedSlug,
    metadata: { mode, old_slug: quote.slug, new_slug: reservedSlug },
  });

  const public_url = `${publicBase}/${reservedSlug}`;
  return res.json({ public_url, slug: reservedSlug, id: newQuote.id });
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

  const slug = req.params.slug;

  // Resolve through slug history first so stale / replaced links are rejected.
  const { data: slugRow, error: sErr } = await supabase
    .from('quote_slugs')
    .select('quote_id, is_active, replaced_by_slug')
    .eq('slug', slug)
    .single();

  let quoteId: string | null = null;

  if (sErr || !slugRow) {
    // Legacy slug fallback: look up the quote directly.
    const { data: legacyQuote, error: lErr } = await supabase
      .from('quotes')
      .select('id, is_active')
      .eq('slug', slug)
      .single();
    if (lErr || !legacyQuote) return res.status(404).json({ error: 'not_found' });
    quoteId = legacyQuote.id;
    if (legacyQuote.is_active === false) {
      const body = await buildInactiveResponse(legacyQuote.id);
      return res.status(410).json(body);
    }
  } else {
    if (!slugRow.is_active) {
      const body = await buildInactiveResponse(slugRow.quote_id);
      return res.status(410).json(body);
    }
    quoteId = slugRow.quote_id;
  }

  // Fetch quote with contractor's telegram_user_id and edit_token (via FK join).
  const { data: quote, error: qErr } = await supabase
    .from('quotes')
    .select('id, contractor_id, client_name, slug, edit_token, is_active, contractors(telegram_user_id)')
    .eq('id', quoteId)
    .single();
  if (qErr || !quote) return res.status(404).json({ error: 'not_found' });

  if (quote.is_active === false) {
    const body = await buildInactiveResponse(quote.id);
    return res.status(410).json(body);
  }

  const { error: uErr } = await supabase
    .from('quotes')
    .update({ client_response: response })
    .eq('id', quote.id);
  if (uErr) return res.status(500).json({ error: uErr.message });

  trackEvent({
    event_type: 'quote_responded',
    contractor_id: quote.contractor_id,
    quote_id: quote.id,
    slug,
    metadata: { response },
  });

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
        `${verb} tu presupuesto, <b>${escapeHtml(clientName)}</b>.\n\nToca un botón:`,
        {
          inline_keyboard: [
            [{ text: '📝 Ver y editar', url: editUrl }],
            [{ text: '➕ Crear nuevo', callback_data: 'create_new' }],
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
