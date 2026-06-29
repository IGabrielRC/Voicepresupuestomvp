import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, X, Loader2, RotateCcw, Send } from 'lucide-react';
import { api } from '../lib/api';

type State = 'idle' | 'recording' | 'recorded' | 'processing';

export default function VoiceRecorder({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<State>('idle');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Pick the best supported mime type
      const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        '',
      ];
      const mimeType = candidates.find((m) => !m || MediaRecorder.isTypeSupported(m)) || '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setState('recorded');
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };

      recorder.start();
      startTimeRef.current = Date.now();
      setDuration(0);
      setState('recording');
      timerRef.current = window.setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 250);
    } catch (e: any) {
      setError(
        'No se pudo acceder al micrófono. Hacé click en el candado de la barra de direcciones y permití el micrófono.'
      );
    }
  }

  function stop() {
    mediaRecorderRef.current?.stop();
  }

  function reset() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setState('idle');
    setError(null);
  }

  async function send() {
    if (!audioBlob) return;
    setState('processing');
    setError(null);
    try {
      const { edit_url, quote_id } = await api.uploadVoice(audioBlob);
      window.location.href = edit_url || `/q/${quote_id}`;
    } catch (e: any) {
      const raw = e?.message || '';
      const friendly = raw.includes('405')
        ? 'El envío de audio no está disponible desde esta página. Probá usando el bot de Telegram.'
        : raw.includes('429') || raw.toLowerCase().includes('too_many_requests')
        ? 'Estamos recibiendo muchos audios. Esperá unos segundos y probá de nuevo.'
        : raw || 'No se pudo procesar el audio. Probá de nuevo.';
      setError(friendly);
      setState('recorded');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold text-slate-900 mb-1">Nota de voz</h2>
        <p className="text-sm text-slate-600 mb-6">
          Contanos qué presupuesto querés hacer. Hablá natural, como le hablarías a un
          compañero.
        </p>

        <div className="flex flex-col items-center py-6 min-h-[200px] justify-center">
          {state === 'idle' && (
            <>
              <button
                onClick={start}
                className="w-24 h-24 rounded-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white flex items-center justify-center shadow-lg transition-all"
                aria-label="Empezar a grabar"
              >
                <Mic className="w-10 h-10" />
              </button>
              <p className="mt-4 text-sm text-slate-500">Tocá para empezar a grabar</p>
            </>
          )}

          {state === 'recording' && (
            <>
              <button
                onClick={stop}
                className="relative w-24 h-24 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 text-white flex items-center justify-center shadow-lg transition-all"
                aria-label="Detener grabación"
              >
                <span className="absolute inset-0 rounded-full bg-red-600 animate-ping opacity-30" />
                <MicOff className="w-10 h-10 relative" />
              </button>
              <p className="mt-4 text-3xl font-mono font-semibold text-slate-900 tabular-nums">
                {formatDuration(duration)}
              </p>
              <p className="mt-1 text-sm text-slate-500">Tocá para detener</p>
            </>
          )}

          {state === 'recorded' && audioUrl && (
            <>
              <audio src={audioUrl} controls className="w-full" />
              <div className="mt-5 flex gap-2 w-full">
                <button
                  onClick={reset}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Re-grabar
                </button>
                <button
                  onClick={send}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
                >
                  <Send className="w-4 h-4" />
                  Enviar
                </button>
              </div>
            </>
          )}

          {state === 'processing' && (
            <>
              <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
              <p className="mt-4 text-sm font-medium text-slate-900">
                Procesando con Gemini...
              </p>
              <p className="mt-1 text-xs text-slate-500">Esto puede tardar unos segundos</p>
            </>
          )}
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-600 text-center bg-red-50 border border-red-100 rounded-lg p-3">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
