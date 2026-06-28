import Landing from './pages/Landing';
import Editor from './pages/Editor';
import PublicQuote from './pages/PublicQuote';
import ProfileEditor from './pages/ProfileEditor';
import History from './pages/History';

export default function App() {
  const path = window.location.pathname;
  if (path === '/' || path === '') return <Landing />;
  if (path === '/q/history') return <History />;
  if (path.startsWith('/q/')) return <Editor quoteId={path.slice(3)} />;
  if (path.startsWith('/s/')) return <PublicQuote slug={path.slice(3)} />;
  if (path.startsWith('/p/')) return <ProfileEditor contractorId={path.slice(3)} />;
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-slate-100/30 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="w-14 h-14 rounded-xl bg-slate-900 mx-auto flex items-center justify-center mb-6">
          <span className="text-white text-xl font-semibold">404</span>
        </div>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-[-0.02em]">
          Página no encontrada
        </h1>
        <p className="mt-2 text-slate-600 leading-relaxed">
          El link que seguiste no existe o el presupuesto fue eliminado.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-2 justify-center">
          <a
            href="/"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            ← Volver al inicio
          </a>
          <a
            href="https://t.me/presupuestomvp_bot"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            Abrir el bot
          </a>
        </div>
      </div>
    </div>
  );
}
