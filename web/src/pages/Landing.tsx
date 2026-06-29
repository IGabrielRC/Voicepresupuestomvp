import { useState } from 'react';
import {
  Mic,
  Edit3,
  Share2,
  CheckCircle2,
  Clock,
  MessageSquare,
  Sparkles,
  ArrowRight,
  AlertCircle,
  Send,
} from 'lucide-react';
import { api } from '../lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function Landing() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function tryDemo() {
    setLoading(true);
    setError(null);
    try {
      const result = await api.simulateVoice({ currency: 'USD' });
      window.location.href = result.edit_url;
    } catch (e: any) {
      setError(
        'No se pudo conectar con el backend. ¿Está corriendo en http://localhost:3001? ' +
          `(${e?.message || 'error desconocido'})`
      );
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-indigo-50/30">
      {/* Top bar */}
      <header className="border-b border-slate-200/60 bg-white/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm">
              <Mic className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-slate-900">VoiceQuote</span>
          </div>
          <span className="text-xs text-slate-500 inline-flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> MVP
          </span>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-20 sm:pt-28 pb-20">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium mb-8 ring-1 ring-slate-200/60">
            <Sparkles className="w-3 h-3" />
            Hecho para contratistas
          </div>
          <h1 className="text-4xl sm:text-6xl font-semibold text-slate-900 tracking-[-0.03em] leading-[1.05]">
            Presupuestos por voz,
            <br />
            <span className="text-indigo-600">listos en 30 segundos.</span>
          </h1>
          <p className="mt-7 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Mandá una nota de voz a tu bot de Telegram. Recibí un presupuesto
            editable para compartir con tu cliente.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={tryDemo}
              disabled={loading}
              size="lg"
              className="bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-all"
            >
              {loading ? 'Creando demo...' : 'Probar demo ahora'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </Button>
            <Button
              onClick={() => window.open('https://t.me/presupuestomvp_bot', '_blank', 'noreferrer')}
              size="lg"
              variant="outline"
              className="border-sky-200 text-sky-600 hover:bg-sky-50 hover:text-sky-700 transition-all"
            >
              <Send className="w-4 h-4" />
              Abrir el bot en Telegram
            </Button>
          </div>
          {error && (
            <div className="mt-4 mx-auto max-w-md flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-left">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 leading-relaxed">{error}</p>
            </div>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Sin registro. Sin tarjeta. Probá ahora.
          </p>
        </div>

        {/* Demo flow visual */}
        <div className="mt-16 max-w-3xl mx-auto">
          <Card className="overflow-hidden border-slate-200 shadow-md">
            <CardContent className="p-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
                {[
                  { icon: Mic, label: 'Voz', desc: '"Para Juan Pérez, dos metros de durlock a 50 dólares..."' },
                  { icon: Edit3, label: 'Editor', desc: 'Revisás items, precios, términos' },
                  { icon: CheckCircle2, label: 'Cliente acepta', desc: 'Con un click desde el celular' },
                ].map((s, i) => (
                  <div key={i} className="p-5 sm:p-6 text-center">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 mx-auto flex items-center justify-center mb-3">
                      <s.icon className="w-5 h-5 text-indigo-600" />
                    </div>
                    <p className="font-semibold text-slate-900 text-sm">{s.label}</p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{s.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="max-w-5xl mx-auto px-6 py-20 border-t border-slate-200/60">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900 tracking-[-0.02em]">
            Cómo funciona
          </h2>
          <p className="mt-3 text-slate-600">Tres pasos. Sin aprender software nuevo.</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            {
              icon: Mic,
              title: '1. Hablá',
              desc: 'Grabá una nota de voz contándonos qué querés presupuestar. Hablá natural, como le hablarías a un compañero.',
              color: 'bg-slate-100 text-slate-700',
            },
            {
              icon: Edit3,
              title: '2. Editá',
              desc: 'Ajustá items, cantidades, precios y términos. Se guarda solo cada 5 segundos. Sin apretar nada.',
              color: 'bg-slate-100 text-slate-700',
            },
            {
              icon: Share2,
              title: '3. Tu cliente decide',
              desc: 'Compartí el link por WhatsApp. Tu cliente acepta, pide cambios o rechaza con un click. Te llega todo a Telegram.',
              color: 'bg-slate-100 text-slate-700',
            },
          ].map((s, i) => (
            <div
              key={i}
              className="group bg-white rounded-xl border border-slate-200/60 p-6 hover:border-slate-300 hover:shadow-sm transition-all"
            >
              <div className={`w-10 h-10 rounded-lg ${s.color} flex items-center justify-center`}>
                <s.icon className="w-5 h-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Por qué */}
      <section className="max-w-5xl mx-auto px-6 py-20 border-t border-slate-200/60">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900 tracking-[-0.02em] text-center">
            Por qué VoiceQuote
          </h2>
          <p className="mt-3 text-slate-600 text-center">
            Lo que ganás vs. el Excel + WhatsApp de siempre.
          </p>
          <Card className="mt-10 border-slate-200/60 shadow-none">
            <CardContent className="p-6 sm:p-8">
              <ul className="space-y-5">
                {[
                  {
                    title: 'Ahorrás 2-4 horas por presupuesto',
                    desc: 'De tipear items en Excel, calcular totales, mandar por WhatsApp. Lo hacés hablando, en 30 segundos.',
                  },
                  {
                    title: 'Tu cliente recibe algo profesional',
                    desc: 'Un link con tu logo, items bien formateados, total grande. No más capturas de Excel.',
                  },
                  {
                    title: 'Sin fricción para el cliente',
                    desc: 'Aceptar, rechazar o pedir cambios con un click desde el celular. Te llega todo a Telegram.',
                  },
                  {
                    title: 'Funciona desde Telegram, que ya usás',
                    desc: 'No hay app nueva, no hay login, no hay onboarding. Ya sabés mandar notas de voz.',
                  },
                ].map((b, i) => (
                  <li key={i} className="flex gap-3">
                    <div className="w-5 h-5 rounded-full bg-slate-900 flex-shrink-0 flex items-center justify-center mt-1">
                      <CheckCircle2 className="w-3 h-3 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{b.title}</p>
                      <p className="text-sm text-slate-600 mt-1 leading-relaxed">{b.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA final */}
      <section className="max-w-5xl mx-auto px-6 py-20 border-t border-slate-200/60">
        <Card className="border-slate-900 bg-slate-900 text-white shadow-xl">
          <CardContent className="p-8 sm:p-12 text-center">
            <Clock className="w-10 h-10 mx-auto mb-4 opacity-70" />
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
              Probá gratis. Sin registro.
            </h2>
            <p className="mt-3 text-slate-300 max-w-md mx-auto leading-relaxed">
              Mandá una nota de voz ahora y en 30 segundos tenés tu primer presupuesto listo
              para mandarle a un cliente.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={tryDemo}
                disabled={loading}
                size="lg"
                className="bg-white text-slate-900 hover:bg-slate-100"
              >
                {loading ? 'Creando...' : 'Probar demo ahora'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </Button>
              <Button
                onClick={() => window.open('https://t.me/presupuestomvp_bot', '_blank', 'noreferrer')}
                size="lg"
                variant="outline"
                className="border-slate-700 text-white hover:bg-slate-800 bg-transparent"
              >
                <Send className="w-4 h-4" />
                Usar el bot en Telegram
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 mt-8">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center">
              <Mic className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-medium text-slate-700">VoiceQuote</span>
          </div>
          <p className="text-xs text-slate-500 inline-flex items-center gap-1.5">
            <MessageSquare className="w-3 h-3" />
            MVP · hecho para validar
          </p>
        </div>
      </footer>

    </div>
  );
}
