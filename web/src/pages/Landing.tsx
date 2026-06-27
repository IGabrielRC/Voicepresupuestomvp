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
} from 'lucide-react';
import { api } from '../lib/api';
import VoiceRecorder from '../components/VoiceRecorder';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function Landing() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRecorder, setShowRecorder] = useState(false);

  async function tryDemo() {
    setLoading(true);
    setError(null);
    try {
      const result = await api.simulateVoice({ currency: 'USD' });
      window.location.href = `/q/${result.quote_id}`;
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
      <section className="max-w-5xl mx-auto px-6 pt-16 sm:pt-24 pb-16">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium mb-6">
            <Sparkles className="w-3 h-3" />
            Hecho para contratistas
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold text-slate-900 tracking-tight leading-[1.1]">
            Presupuestos por voz,
            <br />
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              listos en 30 segundos.
            </span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto">
            Mandá una nota de voz a tu bot de Telegram. Recibí un link profesional para que tu
            cliente <strong>acepte, pida cambios o rechace</strong> con un click.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={tryDemo}
              disabled={loading}
              size="lg"
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            >
              {loading ? 'Creando demo...' : 'Probar demo ahora'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </Button>
            <Button
              onClick={() => setShowRecorder(true)}
              size="lg"
              variant="outline"
              className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            >
              <Mic className="w-4 h-4" />
              Grabar nota de voz
            </Button>
          </div>
          {error && <p className="mt-4 text-sm text-red-600 max-w-md mx-auto">{error}</p>}
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
      <section className="max-w-5xl mx-auto px-6 py-16 border-t border-slate-200">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
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
              color: 'bg-indigo-50 text-indigo-600',
            },
            {
              icon: Edit3,
              title: '2. Editá',
              desc: 'Ajustá items, cantidades, precios y términos. Se guarda solo cada 5 segundos. Sin apretar nada.',
              color: 'bg-emerald-50 text-emerald-600',
            },
            {
              icon: Share2,
              title: '3. Tu cliente decide',
              desc: 'Compartí el link por WhatsApp. Tu cliente acepta, pide cambios o rechaza con un click. Te llega todo a Telegram.',
              color: 'bg-violet-50 text-violet-600',
            },
          ].map((s, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-slate-200 p-6 hover:border-slate-300 transition-colors"
            >
              <div className={`w-12 h-12 rounded-lg ${s.color} flex items-center justify-center`}>
                <s.icon className="w-6 h-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Por qué */}
      <section className="max-w-5xl mx-auto px-6 py-16 border-t border-slate-200">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight text-center">
            Por qué VoiceQuote
          </h2>
          <p className="mt-3 text-slate-600 text-center">
            Lo que ganás vs. el Excel + WhatsApp de siempre.
          </p>
          <Card className="mt-10 border-slate-200">
            <CardContent className="p-6 sm:p-8">
              <ul className="space-y-4">
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
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex-shrink-0 flex items-center justify-center mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{b.title}</p>
                      <p className="text-sm text-slate-600 mt-0.5">{b.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA final */}
      <section className="max-w-5xl mx-auto px-6 py-16 border-t border-slate-200">
        <Card className="border-slate-200 shadow-md bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
          <CardContent className="p-8 sm:p-12 text-center">
            <Clock className="w-10 h-10 mx-auto mb-4 opacity-80" />
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Probá gratis. Sin registro.
            </h2>
            <p className="mt-3 text-indigo-100 max-w-md mx-auto">
              Mandá una nota de voz ahora y en 30 segundos tenés tu primer presupuesto listo para
              mandarle a un cliente.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={tryDemo}
                disabled={loading}
                size="lg"
                className="bg-white text-indigo-700 hover:bg-slate-50"
              >
                {loading ? 'Creando...' : 'Probar demo ahora'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </Button>
              <Button
                onClick={() => setShowRecorder(true)}
                size="lg"
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10 bg-transparent"
              >
                <Mic className="w-4 h-4" />
                Grabar mi voz
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

      {showRecorder && <VoiceRecorder onClose={() => setShowRecorder(false)} />}
    </div>
  );
}
