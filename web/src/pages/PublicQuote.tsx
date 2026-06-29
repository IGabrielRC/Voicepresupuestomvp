import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  XCircle,
  MessageSquare,
  Loader2,
  Phone,
  Mail,
  MapPin,
  Printer,
  Share2,
} from 'lucide-react';
import { api } from '../lib/api';
import type { Quote, QuoteItem, ContractorProfile, ClientResponse } from '../lib/types';
import { formatCurrency, formatDate, isExpired } from '../lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const RESPONSE_LABELS: Record<
  ClientResponse,
  { label: string; emoji: string; color: string; bg: string }
> = {
  pending: { label: 'Esperando respuesta', emoji: '⏳', color: 'text-amber-700', bg: 'bg-amber-50' },
  accepted: { label: 'Aceptado', emoji: '✅', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  rejected: { label: 'Rechazado', emoji: '❌', color: 'text-red-700', bg: 'bg-red-50' },
  changes_requested: {
    label: 'Cambios pedidos',
    emoji: '💬',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
  },
};

export default function PublicQuote({ slug }: { slug: string }) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [profile, setProfile] = useState<ContractorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<ClientResponse>('pending');
  const [responding, setResponding] = useState<Exclude<ClientResponse, 'pending'> | null>(null);

  useEffect(() => {
    api
      .getQuoteBySlug(slug)
      .then(async ({ quote, items }) => {
        if (quote.status === 'draft') {
          setError('Este presupuesto todavía no fue compartido por el contratista.');
          setLoading(false);
          return;
        }
        setQuote(quote);
        setItems(items.sort((a, b) => a.sort_order - b.sort_order));
        setResponse(quote.client_response || 'pending');
        try {
          const { profile } = await api.getProfile(quote.contractor_id);
          setProfile(profile);
        } catch {
          /* profile is optional */
        }
        setLoading(false);
      })
      .catch((e) => {
        setError(e?.message || 'Presupuesto no encontrado.');
        setLoading(false);
      });
  }, [slug]);

  // Open Graph / document title for nice WhatsApp previews
  useEffect(() => {
    if (!quote) return;
    const calculatedTotal = items.reduce((s, it) => s + (it.line_total || 0), 0);
    const effectiveTotal = quote.total_override != null ? quote.total_override : calculatedTotal;
    const totalStr = formatCurrency(effectiveTotal, quote.currency);
    const business = profile?.business_name || 'VoiceQuote';
    document.title = `Presupuesto para ${quote.client_name || 'cliente'} — ${totalStr} | ${business}`;

    function setMeta(property: string, content: string) {
      let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('property', property);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    }
    setMeta('og:title', `Presupuesto para ${quote.client_name || 'cliente'}`);
    setMeta(
      'og:description',
      `Total: ${totalStr} — Válido hasta ${formatDate(quote.expires_at)}`
    );
    setMeta('og:type', 'website');
    if (profile?.logo_url) setMeta('og:image', profile.logo_url);
  }, [quote, items, profile]);

  async function respond(r: Exclude<ClientResponse, 'pending'>) {
    if (responding) return;
    setResponding(r);
    try {
      await api.respondToQuote(slug, r);
      setResponse(r);
    } catch (e: any) {
      setResponding(null);
      alert('No se pudo registrar la respuesta. Intentá de nuevo.');
    } finally {
      setResponding(null);
    }
  }

  function shareWhatsapp() {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(
      `Mirá este presupuesto de ${businessName} — Total: ${totalStr}`
    );
    window.open(`https://wa.me/?text=${text}%20${url}`, '_blank');
  }

  function printPage() {
    window.print();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-indigo-50/30">
        <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-indigo-50/30 p-8">
        <div className="text-center max-w-md">
          <p className="text-slate-700">{error || 'Presupuesto no encontrado.'}</p>
        </div>
      </div>
    );
  }

  const calculatedTotal = items.reduce((s, it) => s + (it.line_total || 0), 0);
  const effectiveTotal = quote.total_override != null ? quote.total_override : calculatedTotal;
  const totalStr = formatCurrency(effectiveTotal, quote.currency);
  const totalAdjusted = quote.total_override != null && quote.total_override !== calculatedTotal;
  const expired = isExpired(quote.expires_at);
  const businessName = profile?.business_name || 'Tu empresa';
  const quoteNumber = quote.id.slice(0, 8).toUpperCase();
  const responseInfo = RESPONSE_LABELS[response];
  const canRespond = quote.status === 'shared' && response === 'pending' && !expired;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-indigo-50/30 py-8 px-4 sm:px-6 pb-[calc(12rem+env(safe-area-inset-bottom))]">
      <div className="max-w-3xl mx-auto">
        {/* Status pill */}
        <div className="flex justify-end mb-4">
          {response === 'accepted' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium ring-1 ring-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Aceptado
            </span>
          ) : response === 'rejected' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-700 text-xs font-medium ring-1 ring-red-200">
              <XCircle className="w-3.5 h-3.5" />
              Rechazado
            </span>
          ) : response === 'changes_requested' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium ring-1 ring-blue-200">
              <MessageSquare className="w-3.5 h-3.5" />
              Cambios pedidos
            </span>
          ) : expired ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium ring-1 ring-amber-200">
              <Clock className="w-3.5 h-3.5" />
              Expirado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium ring-1 ring-emerald-200">
              <Clock className="w-3.5 h-3.5" />
              Vigente
            </span>
          )}
        </div>

        {/* Main card */}
        <Card className="shadow-xl border-slate-200/60 overflow-hidden">
          {/* Header */}
          <CardHeader className="px-6 sm:px-10 py-8 border-b border-slate-200 bg-gradient-to-br from-slate-50 via-white to-indigo-50/50 space-y-0">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                {profile?.logo_url ? (
                  <img
                    src={profile.logo_url}
                    alt=""
                    className="w-16 h-16 rounded-xl object-cover ring-1 ring-slate-200"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-2xl shadow-sm">
                    {businessName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <CardTitle className="text-2xl sm:text-3xl text-slate-900">
                    {businessName}
                  </CardTitle>
                  <div className="text-sm text-slate-600 mt-1.5 space-y-0.5">
                    {profile?.contact_phone && (
                      <p className="inline-flex items-center gap-1.5 mr-3">
                        <Phone className="w-3.5 h-3.5" />
                        {profile.contact_phone}
                      </p>
                    )}
                    {profile?.contact_email && (
                      <p className="inline-flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" />
                        {profile.contact_email}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">
                  Presupuesto
                </p>
                <p className="text-xl font-semibold text-slate-900 mt-0.5">#{quoteNumber}</p>
              </div>
            </div>
          </CardHeader>

          {/* Share / print bar */}
          <div className="px-6 sm:px-10 py-3 border-b border-slate-200 bg-slate-50/30 flex items-center justify-end gap-2 no-print">
            <Button variant="ghost" size="sm" onClick={shareWhatsapp} className="text-slate-600">
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Compartir WhatsApp</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={printPage} className="text-slate-600">
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir / PDF</span>
            </Button>
          </div>

          {/* Client + dates */}
          <CardContent className="px-6 sm:px-10 py-7 border-b border-slate-200">
            <div className="grid sm:grid-cols-3 gap-6">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-1.5">
                  Cliente
                </p>
                <p className="text-base font-semibold text-slate-900">
                  {quote.client_name || '—'}
                </p>
                {quote.client_contact && (
                  <p className="text-sm text-slate-600 mt-0.5">{quote.client_contact}</p>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-1.5">
                  Fecha
                </p>
                <p className="text-base text-slate-900">{formatDate(quote.created_at)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-1.5">
                  Válido hasta
                </p>
                <p className="text-base text-slate-900">{formatDate(quote.expires_at)}</p>
              </div>
            </div>
          </CardContent>

          {/* Items table (desktop) */}
          <CardContent className="px-6 sm:px-10 py-7 border-b border-slate-200">
            <p className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-4">
              Detalle
            </p>
            <div className="hidden sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <th className="pb-3 font-semibold">Descripción</th>
                    <th className="pb-3 font-semibold text-right tabular-nums">Cant.</th>
                    <th className="pb-3 font-semibold text-right tabular-nums">Precio unit.</th>
                    <th className="pb-3 font-semibold text-right tabular-nums">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr
                      key={i}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="py-4 text-slate-900">{it.description || '—'}</td>
                      <td className="py-4 text-slate-600 text-right tabular-nums">
                        {it.qty ?? '—'}
                      </td>
                      <td className="py-4 text-slate-600 text-right tabular-nums">
                        {formatCurrency(it.unit_price || 0, quote.currency)}
                      </td>
                      <td className="py-4 text-slate-900 font-semibold text-right tabular-nums">
                        {formatCurrency(it.line_total || 0, quote.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="sm:hidden space-y-3">
              {items.map((it, i) => (
                <div key={i} className="border border-slate-200 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium text-slate-900">{it.description || '—'}</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-slate-500">Cant.</p>
                      <p className="font-medium text-slate-900 tabular-nums">{it.qty ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Precio unit.</p>
                      <p className="font-medium text-slate-900 tabular-nums">
                        {formatCurrency(it.unit_price || 0, quote.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Total</p>
                      <p className="font-semibold text-slate-900 tabular-nums">
                        {formatCurrency(it.line_total || 0, quote.currency)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>

          {/* Total */}
          <CardContent className="px-6 sm:px-10 py-7 border-b border-slate-200 bg-slate-50/50">
            <div className="flex justify-end">
              <div className="text-right">
                <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">
                  Total
                </p>
                <p className="text-4xl font-bold text-slate-900 mt-2 tracking-tight tabular-nums">
                  {totalStr}
                </p>
                {totalAdjusted && (
                  <p className="text-xs text-slate-400 mt-1">Total ajustado manualmente</p>
                )}
              </div>
            </div>
          </CardContent>

          {/* Notes / Terms */}
          {(quote.notes || quote.terms || profile?.terms) && (
            <CardContent className="px-6 sm:px-10 py-7 space-y-5">
              {quote.notes && (
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                  <p className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-1.5">
                    Notas
                  </p>
                  <p className="text-sm text-slate-700 whitespace-pre-line">{quote.notes}</p>
                </div>
              )}
              {(quote.terms || profile?.terms) && (
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                  <p className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-1.5">
                    Términos y condiciones
                  </p>
                  <p className="text-sm text-slate-700 whitespace-pre-line">
                    {quote.terms || profile?.terms}
                  </p>
                </div>
              )}
            </CardContent>
          )}

          {/* Footer */}
          <div className="px-6 sm:px-10 py-7 bg-slate-900 text-slate-300 text-sm text-center">
            <p className="font-semibold text-white text-base tracking-tight">Gracias por su confianza.</p>
            {profile?.address && (
              <p className="mt-2 text-slate-400 inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {profile.address}
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Sticky response buttons — premium mobile UX */}
      {canRespond && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-5 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-2">
            {/* Primary action: Accept. Big, gradient, shadow. */}
            <Button
              onClick={() => respond('accepted')}
              disabled={!!responding}
              className="w-full h-14 bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-600 hover:from-emerald-600 hover:via-emerald-700 hover:to-emerald-700 text-white shadow-lg shadow-emerald-600/25 hover:shadow-xl hover:shadow-emerald-600/30 text-base font-semibold tracking-tight transition-all"
            >
              {responding === 'accepted' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
              Aceptar presupuesto
            </Button>

            {/* Secondary actions: side by side, smaller */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => respond('changes_requested')}
                disabled={!!responding}
                variant="outline"
                className="h-11 border-slate-200 hover:bg-slate-50 text-slate-700"
              >
                {responding === 'changes_requested' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MessageSquare className="w-4 h-4" />
                )}
                Pedir cambios
              </Button>
              <Button
                onClick={() => respond('rejected')}
                disabled={!!responding}
                variant="ghost"
                className="h-11 text-slate-400 hover:text-red-600 hover:bg-red-50"
              >
                {responding === 'rejected' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                Rechazar
              </Button>
            </div>

            <p className="text-center text-xs text-slate-400 pt-1">
              Tu respuesta le llega al contratista por Telegram
            </p>
          </div>
        </div>
      )}

      {/* Thank you state — premium empty/positive feedback */}
      {response !== 'pending' && quote.status === 'shared' && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-[calc(2rem+env(safe-area-inset-bottom))] text-center">
            <div className="text-5xl mb-3">{responseInfo.emoji}</div>
            <p className={cn('text-lg font-semibold', responseInfo.color)}>
              {response === 'accepted' && '¡Gracias por aceptar!'}
              {response === 'rejected' && 'Respuesta registrada.'}
              {response === 'changes_requested' && 'Pedido de cambios enviado.'}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {response === 'accepted' && 'Avisamos al contratista por Telegram.'}
              {response === 'rejected' && 'El contratista fue notificado por Telegram.'}
              {response === 'changes_requested' && 'El contratista se va a poner en contacto.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
