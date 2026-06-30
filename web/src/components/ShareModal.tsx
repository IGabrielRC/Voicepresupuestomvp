import { useState } from 'react';
import { X, Copy, Check, Loader2, Share2, MessageCircle } from 'lucide-react';
import { api } from '../lib/api';
import { buildWhatsAppShareUrl } from '../lib/share';

export default function ShareModal({
  open,
  onClose,
  quoteId,
  token,
  mode,
  onBeforeShare,
}: {
  open: boolean;
  onClose: () => void;
  quoteId: string;
  token: string;
  mode?: 'reissue_changes' | 'reissue_rejected' | 'share_accepted';
  onBeforeShare?: () => Promise<boolean>;
}) {
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    if (onBeforeShare) {
      const canProceed = await onBeforeShare();
      if (!canProceed) return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.shareQuote(quoteId, token, mode);
      setUrl(result.public_url);
    } catch (e: any) {
      setError(e?.message || 'No se pudo generar el link.');
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Share2 className="w-5 h-5 text-indigo-600" />
            Compartir presupuesto
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!url && !loading && (
          <div className="text-center py-4">
            <p className="text-sm text-slate-600 mb-4">
              Al compartir, el presupuesto pasa a estado "compartido" y se genera un link
              público que podés mandarle a tu cliente.
            </p>
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Generar link público
            </button>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </div>
        )}

        {loading && (
          <div className="text-center py-8">
            <Loader2 className="w-5 h-5 text-indigo-600 animate-spin inline" />
          </div>
        )}

        {url && (
          <div>
            <p className="text-sm text-slate-600 mb-2">
              Tu cliente puede abrir este link para ver el presupuesto:
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={url}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm bg-slate-50 focus:outline-none"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-medium text-slate-700 transition-colors"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-sm text-indigo-600 hover:underline"
            >
              Abrir en una pestaña nueva →
            </a>
            <a
              href={buildWhatsAppShareUrl(url)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-[#25D366] text-white text-sm font-medium hover:bg-[#128C7E] transition-colors"
            >
              <MessageCircle className="w-5 h-5 fill-white" />
              Compartir por WhatsApp
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
