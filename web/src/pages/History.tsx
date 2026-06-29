import { useEffect, useState } from 'react';
import {
  Loader2,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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

type QuoteRow = {
  id: string;
  slug: string;
  client_name: string | null;
  client_contact: string | null;
  status: 'draft' | 'shared' | 'expired';
  client_response: 'pending' | 'accepted' | 'rejected' | 'changes_requested';
  currency: string;
  created_at: string;
  item_count: number;
};

const STATUS_BADGE: Record<
  string,
  { label: string; icon: string; className: string }
> = {
  pending: { label: 'Esperando', icon: '⏳', className: 'bg-amber-50 text-amber-700' },
  accepted: { label: 'Aceptado', icon: '✅', className: 'bg-emerald-50 text-emerald-700' },
  rejected: { label: 'Rechazado', icon: '❌', className: 'bg-red-50 text-red-700' },
  changes_requested: {
    label: 'Cambios',
    icon: '💬',
    className: 'bg-blue-50 text-blue-700',
  },
};

export default function History() {
  const [quotes, setQuotes] = useState<QuoteRow[] | null>(null);
  const [contractorId, setContractorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuoteRow | null>(null);
  const [deletedId, setDeletedId] = useState<string | null>(null);

  useEffect(() => {
    setError('Por seguridad, abrí tus presupuestos desde el bot de Telegram usando /quotes.');
    setLoading(false);
  }, []);

  async function deleteQuote() {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    try {
      setError('Por seguridad, eliminá presupuestos desde el link de edición que te envía el bot.');
      setDeleteTarget(null);
    } catch (e: any) {
      setError(e?.message || 'No se pudo eliminar.');
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-700 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-slate-100/30 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <p className="text-slate-700 leading-relaxed">{error}</p>
          <a href="/" className="text-slate-900 font-medium hover:underline mt-4 inline-block">
            ← Volver al inicio
          </a>
        </div>
      </div>
    );
  }

  const isEmpty = !quotes || quotes.length === 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-indigo-50/30">
      <header className="border-b border-slate-200/60 bg-white/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <a href="/" className="text-sm text-slate-500 hover:text-slate-900">
            ← Inicio
          </a>
          {contractorId && (
            <a
              href={`/p/${contractorId}`}
              className="text-sm text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
            >
              Mi perfil
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 sm:py-12">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Tus presupuestos
          </h1>
              <p className="mt-2 text-slate-600">
            {isEmpty
              ? 'Acá vas a ver los presupuestos que generes con tu bot.'
              : `${quotes.length} presupuesto${quotes.length === 1 ? '' : 's'} generado${quotes.length === 1 ? '' : 's'}. Tocá uno para verlo.`}
          </p>
        </div>

        {isEmpty ? (
          <Card className="border-dashed border-slate-300">
            <CardContent className="py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 mx-auto flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-slate-700" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">Empezá con tu primer audio</h2>
              <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
                Volvé a Telegram y mandale una nota de voz a tu bot. Él te va a responder con un
                link al editor. Después va a aparecer acá.
              </p>
              <div className="mt-6">
                <Button
                  onClick={() =>
                    window.open('https://t.me/presupuestomvp_bot', '_blank', 'noreferrer')
                  }
                  className="bg-sky-500 hover:bg-sky-600 text-white"
                >
                  Abrir el bot en Telegram
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {quotes.map((q) => {
              const status =
                q.client_response !== 'pending'
                  ? STATUS_BADGE[q.client_response]
                  : STATUS_BADGE[q.status] || STATUS_BADGE.pending;
              const dateStr = new Date(q.created_at).toLocaleString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                year: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <div
                  key={q.id}
                  className="group relative flex items-stretch gap-1"
                >
                  <a
                    href={`/s/${q.slug}`}
                    className="flex-1 min-w-0"
                  >
                    <Card className="hover:border-slate-300 hover:shadow-sm transition-all h-full">
                      <CardContent className="p-4 sm:p-5 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-slate-900 truncate">
                              {q.client_name || 'Sin nombre'}
                            </h3>
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
                                status.className
                              )}
                            >
                              {status.icon} {status.label}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-slate-500 truncate">
                            {q.item_count} {q.item_count === 1 ? 'item' : 'items'} · {dateStr}
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-700 transition-colors flex-shrink-0" />
                      </CardContent>
                    </Card>
                  </a>
                  <button
                    onClick={() => setError('Por seguridad, eliminá presupuestos desde el link de edición que te envía el bot.')}
                    className={cn(
                      'px-2.5 rounded-lg border transition-colors',
                      deletedId === q.id
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                        : 'border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50'
                    )}
                    aria-label="Eliminar desde editor seguro"
                    title="Eliminar desde el link de edición seguro"
                  >
                    {deletingId === q.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : deletedId === q.id ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {!isEmpty && (
          <div className="mt-8 text-center">
            <p className="text-sm text-slate-500 mb-3">¿Querés crear otro?</p>
            <p className="text-xs text-slate-400">
              Volvé a Telegram y mandale una nota de voz a tu bot.
            </p>
          </div>
        )}
      </main>

      {/* Delete confirmation modal */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-2">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <AlertDialogTitle className="text-center">¿Eliminar este presupuesto?</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Vas a borrar el presupuesto de <strong>"{deleteTarget?.client_name || 'Sin nombre'}"</strong>.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingId}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteQuote}
              disabled={!!deletingId}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deletingId ? (
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
