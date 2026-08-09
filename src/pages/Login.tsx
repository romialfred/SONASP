import { useState, useRef, useEffect, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Globe,
  ChevronDown,
  ShieldCheck,
  Waypoints,
  BarChart3,
  UserRound,
  LockKeyhole,
  Eye,
  EyeOff,
  KeyRound,
  Check,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function Login() {
  const { t, i18n } = useTranslation();
  const { signIn } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    setLangOpen(false);
  };

  const currentLangLabel = i18n.language === 'en' ? 'English' : 'Français';

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!username.trim()) newErrors.username = t('validation.required', 'Ce champ est requis');
    if (!password) newErrors.password = t('validation.required', 'Ce champ est requis');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setErrors({});
    try {
      const result = await signIn(username, password);
      if (result.error) {
        setErrors({ general: result.error });
      }
    } catch (error: any) {
      setErrors({ general: error?.message || t('errors.generic', "Une erreur inattendue s'est produite") });
    } finally {
      setLoading(false);
    }
  };

  const benefits = [
    { Icon: ShieldCheck, title: t('login.benefit1Title'), desc: t('login.benefit1Desc') },
    { Icon: Waypoints, title: t('login.benefit2Title'), desc: t('login.benefit2Desc') },
    { Icon: BarChart3, title: t('login.benefit3Title'), desc: t('login.benefit3Desc') },
  ];

  const languageSelector = (
    <div ref={langRef} className="relative">
      <button
        type="button"
        onClick={() => setLangOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={langOpen}
        className="flex h-[46px] items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-4 shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition-colors hover:border-emerald-200"
      >
        <Globe className="h-[18px] w-[18px] text-emerald-600" />
        <span className="text-sm font-medium text-slate-700">{currentLangLabel}</span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${langOpen ? 'rotate-180' : ''}`} />
      </button>
      {langOpen && (
        <ul
          role="listbox"
          className="absolute right-0 z-30 mt-2 w-40 overflow-hidden rounded-xl border border-[#E2E8F0] bg-white py-1 shadow-lg"
        >
          {[
            { code: 'fr', label: 'Français' },
            { code: 'en', label: 'English' },
          ].map((l) => (
            <li key={l.code}>
              <button
                type="button"
                role="option"
                aria-selected={i18n.language === l.code}
                onClick={() => changeLanguage(l.code)}
                className="flex w-full items-center justify-between px-4 py-2 text-sm text-slate-700 hover:bg-emerald-50"
              >
                {l.label}
                {i18n.language === l.code && <Check className="h-4 w-4 text-emerald-600" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#F8FAF9]">
      {/* ===== Desktop background: gold photo + light overlay ===== */}
      <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden="true">
        {/* NOTE: pour une photo réelle, remplacer /login-gold.svg par /login-gold.jpg */}
        <img
          src="/login-gold.svg"
          alt=""
          className="absolute inset-y-0 left-[30%] right-0 h-full w-[70%] object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#F8FAF9]/45 to-[#F8FAF9]" />
      </div>

      {/* ===== Desktop organic green curve + mint panel ===== */}
      <svg
        className="absolute inset-y-0 left-0 z-[5] hidden h-full w-[43%] lg:block"
        viewBox="0 0 420 1000"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="mintPanel" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f4f9f5" />
            <stop offset="1" stopColor="#e9f3ec" />
          </linearGradient>
          <linearGradient id="curveGreen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#006B3C" />
            <stop offset="1" stopColor="#008A4B" />
          </linearGradient>
        </defs>
        <path d="M0,0 L352,0 C 476,268 300,632 400,1000 L0,1000 Z" fill="url(#mintPanel)" />
        <path
          d="M352,0 C 476,268 300,632 400,1000 L454,1000 C 354,632 530,268 406,0 Z"
          fill="url(#curveGreen)"
        />
      </svg>

      {/* ===== Content ===== */}
      <div className="relative z-20 flex min-h-screen flex-col lg:flex-row">
        {/* ---------- LEFT PANEL (desktop) ---------- */}
        <aside className="relative hidden lg:flex lg:w-[40%] lg:flex-col">
          <div className="flex flex-1 flex-col justify-center px-[60px] pr-[120px]">
            <img
              src="/logo_transparent_sonasp.png"
              alt="SONASP"
              className="h-auto w-[210px] object-contain"
            />

            <h1 className="mt-8 text-[32px] font-bold leading-[1.3] text-[#1a6b3d]">
              {t('login.brandTitle')}
            </h1>

            <p className="mt-4 max-w-[440px] text-[17px] leading-[1.55] text-slate-600">
              {t('login.brandSubtitle')}
            </p>

            <div className="mt-8 space-y-5">
              {benefits.map(({ Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-4">
                  <div className="flex h-[46px] w-[46px] flex-shrink-0 items-center justify-center rounded-full bg-[#e7f3ec] shadow-[0_1px_2px_rgba(0,107,60,0.08)]">
                    <Icon className="h-[22px] w-[22px] text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-bold text-slate-800">{title}</h3>
                    <p className="mt-1 max-w-[320px] text-[14px] leading-[1.5] text-slate-500">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom green band */}
          <div className="relative" style={{ background: 'linear-gradient(90deg,#006B3C,#03935a)' }}>
            <div className="flex items-center gap-3 px-[60px] py-5 pr-[130px]">
              <div className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full bg-white/15">
                <LockKeyhole className="h-[18px] w-[18px] text-white" />
              </div>
              <div className="leading-tight text-white">
                <p className="text-[14px] font-bold">{t('login.officialPlatform')}</p>
                <p className="text-[12.5px] text-white/85">{t('login.officialTagline')}</p>
              </div>
            </div>
          </div>
        </aside>

        {/* ---------- RIGHT PANEL ---------- */}
        <main className="relative flex flex-1 flex-col px-5 py-4 sm:px-8 lg:px-0">
          {/* Language selector */}
          <div className="flex justify-end lg:pr-8 lg:pt-4">{languageSelector}</div>

          {/* Mobile logo */}
          <div className="mt-6 flex justify-center lg:hidden">
            <img src="/logo_transparent_sonasp.png" alt="SONASP" className="h-auto w-[190px] object-contain" />
          </div>

          {/* Card wrapper */}
          <div className="flex flex-1 items-center justify-center py-3 lg:pr-16">
            <div className="w-full" style={{ maxWidth: 'min(608px, calc(100vw - 40px))' }}>
              <form
                onSubmit={handleSubmit}
                noValidate
                className="rounded-2xl border border-[#EDF1F2] bg-white/[0.97] px-[34px] pb-[28px] pt-8 shadow-[0_14px_40px_rgba(15,23,42,0.11)]"
              >
                {/* Header */}
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#e7f3ec]">
                    <UserRound className="h-8 w-8 text-emerald-600" />
                  </div>
                  <h2 className="mt-5 text-[34px] font-bold leading-none text-[#1E293B]">
                    {t('auth.login')}
                  </h2>
                  <p className="mt-3 text-[15px] font-semibold text-emerald-600">
                    {t('login.subtitle')}
                  </p>
                </div>

                {/* General error */}
                {errors.general && (
                  <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-sm text-red-700">{errors.general}</p>
                  </div>
                )}

                {/* Username */}
                <div className="mt-6">
                  <label htmlFor="login-username" className="mb-1.5 block text-[14px] font-semibold text-slate-700">
                    {t('login.usernameLabel')}
                  </label>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                    <input
                      id="login-username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={t('login.usernamePlaceholder')}
                      aria-invalid={!!errors.username}
                      className={`h-[46px] w-full rounded-lg border bg-white pl-10 pr-3 text-[14px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-[3px] focus:ring-emerald-500/10 ${
                        errors.username ? 'border-red-400 focus:border-red-500' : 'border-[#D8DEE5] focus:border-emerald-600'
                      }`}
                    />
                  </div>
                  {errors.username && <p className="mt-1 text-[12px] text-red-600">{errors.username}</p>}
                </div>

                {/* Password */}
                <div className="mt-5">
                  <label htmlFor="login-password" className="mb-1.5 block text-[14px] font-semibold text-slate-700">
                    {t('auth.password')}
                  </label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t('login.passwordPlaceholder')}
                      aria-invalid={!!errors.password}
                      className={`h-[46px] w-full rounded-lg border bg-white pl-10 pr-11 text-[14px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-[3px] focus:ring-emerald-500/10 ${
                        errors.password ? 'border-red-400 focus:border-red-500' : 'border-[#D8DEE5] focus:border-emerald-600'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                    </button>
                  </div>
                  {errors.password && <p className="mt-1 text-[12px] text-red-600">{errors.password}</p>}
                </div>

                {/* Remember me */}
                <label className="mt-3 flex cursor-pointer select-none items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 accent-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-[14px] text-slate-600">{t('auth.rememberMe')}</span>
                </label>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-4 flex h-[48px] w-full items-center justify-center gap-2 rounded-lg font-bold text-white shadow-[0_6px_16px_rgba(0,138,75,0.25)] transition-transform active:translate-y-px disabled:opacity-70"
                  style={{ background: 'linear-gradient(90deg,#008A4B,#006F3D)' }}
                >
                  {loading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      {t('auth.loggingIn')}
                    </>
                  ) : (
                    <>
                      <LockKeyhole className="h-[18px] w-[18px]" />
                      {t('auth.loginButton')}
                    </>
                  )}
                </button>

                {/* Separator */}
                <div className="my-4 flex items-center gap-3">
                  <span className="h-px flex-1 bg-[#E2E8F0]" />
                  <span className="text-[12px] text-slate-500">{t('login.or')}</span>
                  <span className="h-px flex-1 bg-[#E2E8F0]" />
                </div>

                {/* Forgot password */}
                <div className="text-center">
                  <a
                    href="mailto:admin@sonasp.ml?subject=R%C3%A9initialisation%20du%20mot%20de%20passe%20SONASP"
                    className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-emerald-600 hover:underline"
                  >
                    <KeyRound className="h-4 w-4" />
                    {t('login.forgotPassword')}
                  </a>
                </div>

                {/* Support */}
                <p className="mt-3 text-center text-[13px] text-slate-500">
                  {t('login.needHelp')}{' '}
                  <a href="mailto:admin@sonasp.ml" className="font-semibold text-emerald-600 hover:underline">
                    {t('login.contactAdmin')}
                  </a>
                </p>
              </form>

              {/* Footer */}
              <div className="mt-5 text-center">
                <p className="flex items-center justify-center gap-1.5 text-[13px] text-slate-500">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  {t('login.copyright', { year: new Date().getFullYear() })}
                </p>
                <p className="mt-1 text-[12.5px] text-slate-400">{t('login.compliance')}</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
