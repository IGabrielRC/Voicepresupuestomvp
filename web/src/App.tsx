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
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">404</h1>
        <p className="text-slate-600">Página no encontrada.</p>
        <a href="/" className="text-indigo-600 hover:underline mt-4 inline-block">
          ← Volver al inicio
        </a>
      </div>
    </div>
  );
}
