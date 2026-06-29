import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';

export const contractorsRouter = Router();

const MAX_LOGO_URL_LENGTH = 2048;
const MAX_LOGO_BYTES = 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

function isSafeSvg(svgText: string): boolean {
  const lower = svgText.toLowerCase();
  if (lower.includes('<script')) return false;
  if (lower.includes('javascript:')) return false;
  if (/\bon\w+\s*=/i.test(lower)) return false;
  return true;
}

function validateLogoUrl(logoUrl: unknown): string | null {
  if (logoUrl === undefined || logoUrl === null || logoUrl === '') return null;
  if (typeof logoUrl !== 'string') return 'logo_url debe ser string';
  if (logoUrl.length > MAX_LOGO_URL_LENGTH)
    return `logo_url excede ${MAX_LOGO_URL_LENGTH} caracteres`;

  if (/[\x00-\x1f\x7f]/.test(logoUrl)) return 'logo_url contiene caracteres inválidos';

  if (/^https?:\/\//i.test(logoUrl)) return null;

  if (logoUrl.startsWith('data:')) {
    const commaIdx = logoUrl.indexOf(',');
    if (commaIdx === -1) return 'logo_url data URL inválida';
    const meta = logoUrl.slice(5, commaIdx);
    const base64 = logoUrl.slice(commaIdx + 1);
    const parts = meta.split(';');
    const mimeType = parts[0].toLowerCase();
    if (!parts.includes('base64')) return 'logo_url data URL debe ser base64';
    if (!mimeType.startsWith('image/')) return 'logo_url debe ser una imagen';
    if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
      return `logo_url tipo de imagen no permitido: ${mimeType}`;
    }
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
      return 'logo_url base64 inválida';
    }
    const decodedBytes = Buffer.byteLength(base64, 'base64');
    if (decodedBytes > MAX_LOGO_BYTES) {
      return `logo_url excede ${MAX_LOGO_BYTES / 1024 / 1024} MB decodificados`;
    }
    if (mimeType === 'image/svg+xml') {
      try {
        const decoded = Buffer.from(base64, 'base64').toString('utf8');
        if (!isSafeSvg(decoded)) {
          return 'logo_url SVG contiene contenido no seguro';
        }
      } catch {
        return 'logo_url SVG no pudo decodificarse';
      }
    }
    return null;
  }

  return 'logo_url debe ser una URL https/http o una imagen en base64';
}

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
  const logoError = validateLogoUrl(logo_url);
  if (logoError) return res.status(400).json({ error: logoError });
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

// Do not expose quote history by Telegram ID. Telegram IDs are not secrets.
// Quote history is delivered inside Telegram via /quotes, where Telegram provides identity.
contractorsRouter.get('/contractors/by-telegram/:tg_id', async (req: Request, res: Response) => {
  return res.status(410).json({
    error: 'history_disabled',
    message: 'Por seguridad, abrí tus presupuestos desde el bot de Telegram con /quotes.',
  });
});
