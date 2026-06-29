import { Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function History() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-indigo-50/30">
      <header className="border-b border-slate-200/60 bg-white/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <a href="/" className="text-sm text-slate-500 hover:text-slate-900">
            ← Inicio
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 sm:py-12">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Tus presupuestos
          </h1>
          <p className="mt-2 text-slate-600">
            Acá vas a ver los presupuestos que generes con tu bot.
          </p>
        </div>

        <Card className="border-dashed border-slate-300">
          <CardContent className="py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 mx-auto flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-slate-700" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Abrí tus presupuestos desde Telegram</h2>
            <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
              Por seguridad, esta página se accede desde el bot. Usá el comando{' '}
              <span className="font-mono text-slate-800 bg-slate-100 px-1 rounded">/quotes</span>{' '}
              en Telegram y te mostramos tu lista actualizada.
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
      </main>
    </div>
  );
}
