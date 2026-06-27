import { useEffect, useRef, useState } from 'react';
import {
  Plus,
  Trash2,
  Save,
  Share2,
  ArrowUp,
  ArrowDown,
  Loader2,
  Check,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Lock,
  MoreVertical,
} from 'lucide-react';
import { api } from '../lib/api';
import type { Quote, QuoteItem, ClientResponse } from '../lib/types';
import { formatCurrency } from '../lib/format';
import ShareModal from '../components/ShareModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const RESPONSE_BADGE: Record<
  Exclude<ClientResponse, 'pending'>,
  { icon: typeof CheckCircle2; label: string; className: string }
> = {
  accepted: {
    icon: CheckCircle2,
    label: 'Tu cliente ACEPTÓ este presupuesto.',
    className: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  },
  rejected: {
    icon: XCircle,
    label: 'Tu cliente RECHAZÓ este presupuesto.',
    className: 'bg-red-50 border-red-200 text-red-800',
  },
  changes_requested: {
    icon: MessageSquare,
    label: 'Tu cliente pidió cambios.',
    className: 'bg-blue-50 border-blue-200 text-blue-800',
  },
};

export default function Editor({ quoteId }: { quoteId: string }) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [autoSavedAt, setAutoSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const lastSavedRef = useRef<string>('');
  const locked = quote?.client_response === 'accepted';

  useEffect(() => {
    api
      .getQuote(quoteId)
      .then(({ quote, items }) => {
        setQuote(quote);
        setItems(items.sort((a, b) => a.sort_order - b.sort_order));
        lastSavedRef.current = JSON.stringify({ q: quote, i: items });
        setLoading(false);
      })
      .catch((e) => {
        setError(e?.message || 'No se pudo cargar el presupuesto.');
        setLoading(false);
      });
  }, [quoteId]);

  // Auto-save: 5s after the last change. Skips locked quotes and unchanged state.
  useEffect(() => {
    if (loading || !quote || locked) return;
    const currentJson = JSON.stringify({ q: quote, i: items });
    if (currentJson === lastSavedRef.current) return;
    const timer = setTimeout(() => {
      save(true);
    }, 5000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote, items, loading, locked]);

  async function save(isAuto = false) {
    if (!quote || locked) return;
    setSaving(true);
    if (!isAuto) setSaved(false);
    setError(null);
    try {
      const { quote: q, items: its } = await api.patchQuote(quote.id, {
        client_name: quote.client_name,
        client_contact: quote.client_contact,
        currency: quote.currency,
        notes: quote.notes,
        terms: quote.terms,
        validity_days: quote.validity_days,
        items: items.map((it, i) => ({ ...it, sort_order: i })),
      });
      setQuote(q);
      setItems(its);
      lastSavedRef.current = JSON.stringify({ q, i: its });
      if (isAuto) {
        setAutoSavedAt(new Date());
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch (e: any) {
      setError(e?.message || 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  }

  function addItem() {
    if (locked) return;
    setItems([
      ...items,
      { description: '', qty: 1, unit_price: 0, line_total: 0, sort_order: items.length },
    ]);
  }
  function removeItem(i: number) {
    if (locked) return;
    setItems(items.filter((_, idx) => idx !== i));
  }
  function moveItem(i: number, dir: -1 | 1) {
    if (locked) return;
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const copy = [...items];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    setItems(copy);
  }
  function updateItem(i: number, patch: Partial<QuoteItem>) {
    if (locked) return;
    setItems(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  async function deleteQuote() {
    if (!quote) return;
    setDeleting(true);
    try {
      await api.deleteQuote(quote.id);
      setDeleteOpen(false);
      setMenuOpen(false);
      setDeleted(true);
    } catch (e: any) {
      setError(e?.message || 'No se pudo eliminar.');
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
      </div>
    );
  }
  if (deleted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-emerald-50/30 flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center border-emerald-200/60 shadow-xl">
          <CardContent className="py-10 px-6">
            <div className="w-16 h-16 rounded-full bg-emerald-100 mx-auto flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Listo, presupuesto eliminado</h2>
            <p className="mt-2 text-sm text-slate-500">
              El presupuesto y todos sus datos fueron borrados.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
              <Button variant="outline" onClick={() => (window.location.href = '/')}>
                Volver al inicio
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (error || !quote) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-red-600">{error || 'Presupuesto no encontrado.'}</p>
          <a href="/" className="text-indigo-600 hover:underline mt-4 inline-block">
            ← Volver
          </a>
        </div>
      </div>
    );
  }

  const total = items.reduce((s, it) => s + (it.line_total || 0), 0);

  const inputBase =
    'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed';

  return (
    <div className="min-h-screen pb-24">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <a href="/" className="text-sm text-slate-500 hover:text-slate-900">
            ← Inicio
          </a>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Compartir</span>
            </button>
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                aria-label="Más opciones"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1">
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setDeleteOpen(true);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 inline-flex items-center gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Eliminar presupuesto
                    </button>
                  </div>
                </>
              )}
            </div>
            {!locked && (
              <div className="flex items-center gap-2">
                {autoSavedAt && !saving && !saved && (
                  <span className="hidden sm:inline text-xs text-slate-400">
                    Autoguardado · {autoSavedAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                <button
                  onClick={() => save(false)}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : saved ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar'}
                </button>
              </div>
            )}
            {locked && (
              <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium">
                <Lock className="w-4 h-4" />
                <span className="hidden sm:inline">Aceptado · solo lectura</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {quote.client_response && quote.client_response !== 'pending' && (
          <div
            className={`rounded-xl border p-4 flex items-center gap-3 ${
              RESPONSE_BADGE[quote.client_response].className
            }`}
          >
            {(() => {
              const Icon = RESPONSE_BADGE[quote.client_response].icon;
              return <Icon className="w-5 h-5 flex-shrink-0" />;
            })()}
            <p className="font-medium">{RESPONSE_BADGE[quote.client_response].label}</p>
          </div>
        )}

        <input
          type="text"
          value={quote.client_name || ''}
          onChange={(e) => setQuote({ ...quote, client_name: e.target.value })}
          placeholder="Nombre del cliente"
          disabled={locked}
          className="w-full text-3xl sm:text-4xl font-bold tracking-tight bg-transparent border-none focus:outline-none focus:ring-0 placeholder:text-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed"
        />

        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Cliente</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nombre</label>
              <input
                type="text"
                value={quote.client_name || ''}
                onChange={(e) => setQuote({ ...quote, client_name: e.target.value })}
                disabled={locked}
                className={inputBase}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Contacto (teléfono, email, dirección)
              </label>
              <input
                type="text"
                value={quote.client_contact || ''}
                onChange={(e) => setQuote({ ...quote, client_contact: e.target.value })}
                disabled={locked}
                className={inputBase}
              />
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900">Items</h2>
            <button
              onClick={addItem}
              disabled={locked}
              className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-indigo-600"
            >
              <Plus className="w-4 h-4" />
              Agregar item
            </button>
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              Sin items. Hacé click en "Agregar item".
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start">
                  <input
                    type="text"
                    value={it.description}
                    onChange={(e) => updateItem(i, { description: e.target.value })}
                    placeholder="Descripción"
                    disabled={locked}
                    className="col-span-12 sm:col-span-6 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                  />
                  <input
                    type="number"
                    value={it.qty ?? ''}
                    onChange={(e) => {
                      const qty = e.target.value === '' ? null : Number(e.target.value);
                      const line_total = qty && it.unit_price ? qty * it.unit_price : 0;
                      updateItem(i, { qty, line_total });
                    }}
                    placeholder="Cant."
                    disabled={locked}
                    className="col-span-3 sm:col-span-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                  />
                  <input
                    type="number"
                    value={it.unit_price ?? ''}
                    onChange={(e) => {
                      const unit_price = e.target.value === '' ? null : Number(e.target.value);
                      const line_total = it.qty && unit_price ? it.qty * unit_price : 0;
                      updateItem(i, { unit_price, line_total });
                    }}
                    placeholder="Precio"
                    disabled={locked}
                    className="col-span-4 sm:col-span-2 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                  />
                  <div className="col-span-3 sm:col-span-2 px-3 py-2 text-sm text-slate-600 flex items-center">
                    {formatCurrency(it.line_total || 0, quote.currency)}
                  </div>
                  <div className="col-span-12 sm:col-span-1 flex items-center gap-1 justify-end">
                    <button
                      onClick={() => moveItem(i, -1)}
                      disabled={locked || i === 0}
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveItem(i, 1)}
                      disabled={locked || i === items.length - 1}
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeItem(i)}
                      disabled={locked}
                      className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 pt-5 border-t border-slate-200 flex justify-end">
            <div className="text-right">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Total</p>
              <p className="text-2xl font-bold text-slate-900">
                {formatCurrency(total, quote.currency)}
              </p>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Configuración</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Moneda</label>
              <select
                value={quote.currency}
                onChange={(e) => setQuote({ ...quote, currency: e.target.value })}
                disabled={locked}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
              >
                <option value="ARS">ARS (pesos)</option>
                <option value="USD">USD (dólares)</option>
                <option value="EUR">EUR (euros)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Validez (días)</label>
              <input
                type="number"
                value={quote.validity_days ?? ''}
                onChange={(e) =>
                  setQuote({
                    ...quote,
                    validity_days: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
                disabled={locked}
                className={inputBase}
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Términos y condiciones
            </label>
            <textarea
              value={quote.terms || ''}
              onChange={(e) => setQuote({ ...quote, terms: e.target.value })}
              rows={3}
              disabled={locked}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
            />
          </div>
          <div className="mt-4">
            <label className="block text-xs font-medium text-slate-600 mb-1">Notas</label>
            <textarea
              value={quote.notes || ''}
              onChange={(e) => setQuote({ ...quote, notes: e.target.value })}
              rows={2}
              disabled={locked}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
            />
          </div>
        </section>

        <div className="text-center text-xs text-slate-400 pt-4">
          <a href={`/p/${quote.contractor_id}`} className="hover:text-slate-600">
            Editar mi perfil de empresa →
          </a>
        </div>
      </main>

      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} quoteId={quote.id} />

      {/* Delete confirmation modal */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-2">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <AlertDialogTitle className="text-center">¿Eliminar este presupuesto?</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Esta acción no se puede deshacer. El presupuesto y todos sus items se borrarán
              permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteQuote}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
