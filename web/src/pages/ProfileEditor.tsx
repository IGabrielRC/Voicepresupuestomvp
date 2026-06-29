import { useEffect, useRef, useState } from 'react';
import { Save, Loader2, Check, Sparkles, Upload, X } from 'lucide-react';
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
  const welcome = new URLSearchParams(window.location.search).get('welcome') === '1';
  const editToken = new URLSearchParams(window.location.search).get('t');
  const canEdit = !!editToken;
  const hasProfile = !!profile.business_name;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [lastEditUrl, setLastEditUrl] = useState<string | null>(null);
  const [urlCheck, setUrlCheck] = useState<{
    status: 'idle' | 'checking' | 'valid' | 'invalid';
    error: string | null;
  }>({ status: 'idle', error: null });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_LOGO_BYTES = 1024 * 1024;
  const MAX_LOGO_URL_LENGTH = 2048;
  const ALLOWED_IMAGE_MIME_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/svg+xml',
  ]);

  function isSafeSvg(svgText: string): boolean {
    const lower = svgText.toLowerCase();
    if (lower.includes('<script')) return false;
    if (lower.includes('javascript:')) return false;
    if (/\bon\w+\s*=/i.test(lower)) return false;
    return true;
  }

  function isValidEditUrl(url: string | null): url is string {
    if (!url) return false;
    if (!url.startsWith('/q/')) return false;
    // Reject any scheme/protocol indicator anywhere in the URL.
    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return false;
    if (url.includes('://')) return false;
    return true;
  }

  function validateLogoUrl(value: string): string | null {
    if (!value) return null;
    if (/^https?:\/\//i.test(value)) {
      if (value.length > MAX_LOGO_URL_LENGTH)
        return `El enlace supera ${MAX_LOGO_URL_LENGTH} caracteres.`;
      return null;
    }
    if (value.startsWith('data:')) {
      const commaIdx = value.indexOf(',');
      if (commaIdx === -1) return 'URL de datos inválida.';
      const meta = value.slice(5, commaIdx);
      const base64 = value.slice(commaIdx + 1);
      const parts = meta.split(';');
      const mimeType = parts[0].toLowerCase();
      if (!parts.includes('base64')) return 'La URL de datos debe ser base64.';
      if (!mimeType.startsWith('image/')) return 'El archivo debe ser una imagen.';
      if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) return 'Formato de imagen no permitido.';
      try {
        const decoded = atob(base64);
        if (decoded.length > MAX_LOGO_BYTES) return 'La imagen no puede superar 1 MB.';
        if (mimeType === 'image/svg+xml' && !isSafeSvg(decoded)) {
          return 'El SVG contiene contenido no seguro.';
        }
      } catch {
        return 'Base64 inválido.';
      }
      return null;
    }
    if (value.length > MAX_LOGO_URL_LENGTH)
      return `El enlace supera ${MAX_LOGO_URL_LENGTH} caracteres.`;
    return 'El enlace debe ser http, https o una imagen en base64.';
  }

  function validateRemoteImageUrl(value: string): Promise<string | null> {
    return new Promise((resolve) => {
      const img = new Image();
      const timer = setTimeout(() => {
        img.src = '';
        resolve('El enlace no respondió como imagen (timeout).');
      }, 8000);

      img.onload = () => {
        clearTimeout(timer);
        resolve(null);
      };

      img.onerror = () => {
        clearTimeout(timer);
        resolve(
          'No se pudo cargar la imagen. Revisá que el enlace sea público y sea una imagen.'
        );
      };

      img.src = value;
    });
  }

  function setLogoUrl(value: string) {
    setLogoError(validateLogoUrl(value));
    setProfile((p) => ({ ...p, logo_url: value }));
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setLogoError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLogoError('El archivo debe ser una imagen (JPG, PNG, WEBP, etc).');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError('La imagen no puede superar 1 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setLogoUrl(result);
    };
    reader.onerror = () => setLogoError('No se pudo leer la imagen.');
    reader.readAsDataURL(file);
  }

  function clearLogo() {
    setLogoError(null);
    setUrlCheck({ status: 'idle', error: null });
    setProfile((p) => ({ ...p, logo_url: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  useEffect(() => {
    const value = profile.logo_url || '';
    if (!value || !/^https?:\/\//i.test(value)) {
      setUrlCheck({ status: 'idle', error: null });
      return;
    }
    setUrlCheck({ status: 'checking', error: null });
    let cancelled = false;
    let img: HTMLImageElement | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const debounce = setTimeout(() => {
      if (cancelled) return;
      img = new Image();
      timer = setTimeout(() => {
        if (cancelled || !img) return;
        cancelled = true;
        img.src = '';
        img = null;
        setUrlCheck({
          status: 'invalid',
          error: 'El enlace no respondió como imagen (timeout).',
        });
      }, 8000);
      img.onload = () => {
        if (cancelled) return;
        if (timer) clearTimeout(timer);
        cancelled = true;
        img = null;
        setUrlCheck({ status: 'valid', error: null });
      };
      img.onerror = () => {
        if (cancelled) return;
        if (timer) clearTimeout(timer);
        cancelled = true;
        img = null;
        setUrlCheck({
          status: 'invalid',
          error:
            'No se pudo cargar la imagen. Revisá que el enlace sea público y sea una imagen.',
        });
      };
      img.src = value;
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(debounce);
      if (timer) clearTimeout(timer);
      if (img) {
        img.src = '';
        img = null;
      }
    };
  }, [profile.logo_url]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`voicequote:last-edit-url:${contractorId}`);
      setLastEditUrl(isValidEditUrl(raw) ? raw : null);
    } catch {
      setLastEditUrl(null);
    }
  }, [contractorId]);

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
    if (!editToken) {
      setError('No se puede guardar: falta el token de edición. Abrí el perfil desde el enlace de un presupuesto.');
      return;
    }
    const value = profile.logo_url || '';
    const logoErr = validateLogoUrl(value);
    if (logoErr) {
      setLogoError(logoErr);
      return;
    }
    if (/^https?:\/\//i.test(value)) {
      if (urlCheck.status !== 'valid') {
        setLogoError('Verificando imagen...');
        setUrlCheck({ status: 'checking', error: null });
        const remoteLogoError = await validateRemoteImageUrl(value);
        if (remoteLogoError) {
          setUrlCheck({ status: 'invalid', error: remoteLogoError });
          setLogoError(remoteLogoError);
          return;
        }
        setUrlCheck({ status: 'valid', error: null });
        if (profile.logo_url !== value) {
          setLogoError('El logo cambió mientras se verificaba. Volvé a guardar.');
          return;
        }
      }
    }
    setLogoError(null);
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await api.patchProfile(contractorId, profile, editToken);
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
        <label htmlFor={key} className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
        <input
          id={key}
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
          <a
            href={lastEditUrl || '/'}
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            {lastEditUrl ? '← Volver al presupuesto' : '← Inicio'}
          </a>
          <button
            onClick={save}
            disabled={saving || !canEdit}
            title={canEdit ? 'Guardar cambios' : 'Abrí el perfil desde el enlace de un presupuesto para poder editar'}
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

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {welcome && !hasProfile && (
          <div className="mb-8 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">¡Bienvenido a VoiceQuote!</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Configurá tu perfil con los datos de tu empresa. Después cada
                  presupuesto que generes se va a ver profesional con tu nombre,
                  logo y contacto.
                </p>
              </div>
            </div>
          </div>
        )}
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-1">
          Mi perfil
        </h1>
        <p className="text-sm text-slate-600 mb-8">
          Aparece en cada presupuesto que compartís con tus clientes.
        </p>

        {!canEdit && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Este perfil se abrió en modo solo lectura. Para editarlo, usá el enlace
            “Editar mi perfil de empresa” desde un presupuesto o desde el bot de Telegram.
          </div>
        )}

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          {field('business_name', 'Nombre de tu empresa')}

          <div>
            <label htmlFor="logo-url" className="block text-xs font-medium text-slate-600 mb-2">
              Logo de la empresa
            </label>
            <div className="flex items-center gap-4">
              {profile.logo_url ? (
                <div className="relative group">
                  <img
                    src={profile.logo_url}
                    alt="Vista previa del logo"
                    className="w-16 h-16 rounded-xl object-cover ring-1 ring-slate-200 bg-white"
                  />
                  <button
                    type="button"
                    onClick={clearLogo}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center shadow-sm hover:bg-slate-700"
                    aria-label="Quitar logo"
                    title="Quitar logo"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 text-xs text-center px-2">
                  Sin logo
                </div>
              )}
              <div className="flex-1 space-y-2">
                <input
                  id="logo-url"
                  type="text"
                  value={profile.logo_url || ''}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://ejemplo.com/logo.png"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="logo-upload"
                  />
                  <label
                    htmlFor="logo-upload"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Subir imagen
                  </label>
                  <span className="text-xs text-slate-400">Máx. 1 MB</span>
                </div>
                {(logoError || urlCheck.error) && (
                  <p className="text-xs text-red-600">{logoError || urlCheck.error}</p>
                )}
              </div>
            </div>
          </div>

          {field('contact_phone', 'Teléfono')}
          {field('contact_email', 'Email', 'email')}
          {field('address', 'Dirección')}
          <div>
            <label htmlFor="default-currency" className="block text-xs font-medium text-slate-600 mb-1">
              Moneda por defecto
            </label>
            <select
              id="default-currency"
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
            <label htmlFor="terms" className="block text-xs font-medium text-slate-600 mb-1">
              Términos por defecto
            </label>
            <textarea
              id="terms"
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
