import { Router } from 'express';
import multer from 'multer';
import { supabase } from '../lib/supabase.js';
import { audioToQuote } from '../services/gemini.js';
import { newSlug } from '../services/slug.js';
import { newEditToken } from '../services/token.js';

export const voiceRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) cb(null, true);
    else cb(new Error('Solo se aceptan archivos de audio.'));
  },
});

// Default contractor for the demo (the first one in the existing data).
// In production this would come from the user's session.
const DEFAULT_CONTRACTOR_ID = '487a13e0-6c7f-4da8-bad1-1e77000eaa24';

voiceRouter.post('/voice/from-web', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'no_audio' });

    const audio = req.file.buffer;
    const mimeType = req.file.mimetype || 'audio/webm';
    const contractorId = (req.body?.contractor_id as string) || DEFAULT_CONTRACTOR_ID;

    let quoteJson;
    try {
      quoteJson = await audioToQuote(audio, mimeType);
    } catch (e: any) {
      console.error('[voice] gemini error', e?.message || e);
      return res.status(500).json({ error: 'gemini_error', message: e?.message });
    }

    const slug = newSlug();
    const editToken = newEditToken();
    const validityDays = 15;
    const expiresAt = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString();

    const { data: quote, error: qErr } = await supabase
      .from('quotes')
      .insert({
        contractor_id: contractorId,
        slug,
        edit_token: editToken,
        client_name: quoteJson.client_name,
        client_contact: quoteJson.client_contact,
        currency: quoteJson.currency || 'USD',
        notes: quoteJson.notes,
        terms: quoteJson.terms,
        validity_days: validityDays,
        expires_at: expiresAt,
        status: 'draft',
        raw_gemini_output: JSON.stringify(quoteJson),
      })
      .select('id, edit_token')
      .single();
    if (qErr) throw qErr;

    if (quoteJson.items.length > 0) {
      const items = quoteJson.items.map((it, i) => ({
        quote_id: quote.id,
        description: it.description,
        qty: it.qty,
        unit_price: it.unit_price,
        line_total: it.qty && it.unit_price ? it.qty * it.unit_price : 0,
        sort_order: i,
      }));
      const { error: iErr } = await supabase.from('quote_items').insert(items);
      if (iErr) throw iErr;
    }

    const webBaseUrl = process.env.WEB_BASE_URL || 'http://localhost:5173';
    res.json({
      quote_id: quote.id,
      slug,
      edit_url: `${webBaseUrl}/q/${quote.id}?t=${quote.edit_token}`,
    });
  } catch (e: any) {
    console.error('[voice] error', e?.message || e);
    res.status(500).json({ error: e?.message || 'internal_error' });
  }
});
