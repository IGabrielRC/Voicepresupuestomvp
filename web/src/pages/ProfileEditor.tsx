import { useEffect, useState } from 'react';
import { Save, Loader2, Check } from 'lucide-react';
import { api } from '../lib/api';
import type { ContractorProfile } from '../lib/types';

export default function ProfileEditor({ contractorId }: { contractorId: string }) {
  const [profile, setProfile] = useState<Partial<ContractorProfile>>({
    business_name: '',
    logo_url: '',
    contact_phone: '',
    contact_email: '',
    address: '',
    terms: '',
    default_currency: 'USD',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getProfile(contractorId)
      .then(({ profile }) => {
        if (profile) setProfile({ ...profile });
        setLoading(false);
      })
      .catch((e) => {
        setError(e?.message || 'No se pudo cargar el perfil.');
        setLoading(false);
      });
  }, [contractorId]);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await api.patchProfile(contractorId, profile);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e?.message || 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
      </div>
    );
  }

  function field(
    key: keyof ContractorProfile,
    label: string,
    type: string = 'text'
  ) {
    return (
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
        <input
          type={type}
          value={(profile[key] as string) || ''}
          onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <a href="/" className="text-sm text-slate-500 hover:text-slate-900">
            ← Inicio
          </a>
          <button
            onClick={save}
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
      </div>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Mi perfil</h1>
        <p className="text-sm text-slate-600 mb-6">
          Aparece en cada presupuesto que compartís con tus clientes.
        </p>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          {field('business_name', 'Nombre de tu empresa')}
          {field('logo_url', 'URL del logo (opcional)')}
          {field('contact_phone', 'Teléfono')}
          {field('contact_email', 'Email', 'email')}
          {field('address', 'Dirección')}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Moneda por defecto
            </label>
            <select
              value={profile.default_currency || 'USD'}
              onChange={(e) => setProfile({ ...profile, default_currency: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="USD">USD (dólares)</option>
              <option value="VES">VES (bolívares)</option>
              <option value="ARS">ARS (pesos argentinos)</option>
              <option value="EUR">EUR (euros)</option>
              <option value="MXN">MXN (pesos mexicanos)</option>
              <option value="COP">COP (pesos colombianos)</option>
              <option value="BRL">BRL (reales)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Términos por defecto
            </label>
            <textarea
              value={profile.terms || ''}
              onChange={(e) => setProfile({ ...profile, terms: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </section>
      </main>
    </div>
  );
}
