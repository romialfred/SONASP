import { FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  LockKeyhole,
  Route,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import loginReferenceUrl from '../../docs/ui-reference/sonasp-login-reference.png';
import './Login.css';

type LoginErrors = Partial<Record<'username' | 'password' | 'general', string>>;

const languages = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
] as const;

export function Login() {
  const { t, i18n } = useTranslation();
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeLanguageMenu = (event: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setLangOpen(false);
      }
    };

    document.addEventListener('mousedown', closeLanguageMenu);
    return () => document.removeEventListener('mousedown', closeLanguageMenu);
  }, []);

  const changeLanguage = (language: string) => {
    void i18n.changeLanguage(language);
    setLangOpen(false);
  };

  const validateForm = () => {
    const nextErrors: LoginErrors = {};
    if (!username.trim()) nextErrors.username = t('validation.required', 'Ce champ est requis');
    if (!password) nextErrors.password = t('validation.required', 'Ce champ est requis');
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setErrors({});
    try {
      const result = await signIn(username, password);
      if (result.error) setErrors({ general: result.error });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('errors.generic', "Une erreur inattendue s'est produite");
      setErrors({ general: message });
    } finally {
      setLoading(false);
    }
  };

  const isEnglish = (i18n.resolvedLanguage || i18n.language).startsWith('en');
  const currentLanguage = isEnglish ? 'English' : 'Français';
  const benefits = [
    { Icon: ShieldCheck, title: t('login.benefit1Title'), description: t('login.benefit1Desc') },
    { Icon: Route, title: t('login.benefit2Title'), description: t('login.benefit2Desc') },
    { Icon: BarChart3, title: t('login.benefit3Title'), description: t('login.benefit3Desc') },
  ];

  return (
    <div className="sonasp-login">
      <div className="login-desktop-art" aria-hidden="true">
        <img src={loginReferenceUrl} alt="" className="login-reference-layer" />
        <div className="login-left-mask" />
        <div className="login-right-wash" />
      </div>

      <aside className="login-brand-panel" aria-label="Présentation de SONASP">
        <div className="login-logo-crop">
          <img src="/logo_transparent_sonasp.png" alt="SONASP" />
        </div>

        <h1 className="login-brand-title">
          {isEnglish ? (
            t('login.brandTitle')
          ) : (
            <>
              Système National de Collecte
              <br />
              et de la Traçabilité des
              <br />
              Substances Précieuses
            </>
          )}
        </h1>

        <p className="login-brand-subtitle">{t('login.brandSubtitle')}</p>

        <div className="login-benefits">
          {benefits.map(({ Icon, title, description }) => (
            <div className="login-benefit" key={title}>
              <span className="login-benefit-icon" aria-hidden="true">
                <Icon />
              </span>
              <div>
                <h2>{title}</h2>
                <p>{description}</p>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <div className="login-official-band">
        <span className="login-official-icon" aria-hidden="true">
          <LockKeyhole />
        </span>
        <div>
          <strong>{t('login.officialPlatform')}</strong>
          <span>{t('login.officialTagline')}</span>
        </div>
      </div>

      <main className="login-main">
        <div
          ref={langRef}
          className="login-language"
          onKeyDown={(event) => {
            if (event.key === 'Escape') setLangOpen(false);
          }}
        >
          <button
            type="button"
            className="login-language-trigger"
            aria-haspopup="menu"
            aria-expanded={langOpen}
            aria-label={`${t('header.currentLanguage', { language: currentLanguage })}. Changer de langue`}
            onClick={() => setLangOpen((open) => !open)}
          >
            <Globe aria-hidden="true" />
            <span>{currentLanguage}</span>
            <ChevronDown className={langOpen ? 'is-open' : ''} aria-hidden="true" />
          </button>

          {langOpen && (
            <div className="login-language-menu" role="menu">
              {languages.map((language) => (
                <button
                  key={language.code}
                  type="button"
                  role="menuitemradio"
                  aria-checked={(i18n.resolvedLanguage || i18n.language).startsWith(language.code)}
                  onClick={() => changeLanguage(language.code)}
                >
                  <span>{language.label}</span>
                  {(i18n.resolvedLanguage || i18n.language).startsWith(language.code) && <Check aria-hidden="true" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="login-mobile-logo">
          <div className="login-logo-crop">
            <img src="/logo_transparent_sonasp.png" alt="SONASP" />
          </div>
        </div>

        <div className="login-card-shell">
          <form className="login-card" onSubmit={handleSubmit} noValidate>
            <header className="login-card-header">
              <span className="login-user-emblem" aria-hidden="true">
                <UserRound />
              </span>
              <h2>{t('auth.login')}</h2>
              <p>{t('login.subtitle')}</p>
            </header>

            {errors.general && (
              <div className="login-general-error" role="alert">
                {errors.general}
              </div>
            )}

            <div className="login-fields">
              <div className="login-field">
                <label htmlFor="login-username">{t('login.usernameLabel')}</label>
                <div className="login-input-wrap">
                  <UserRound aria-hidden="true" />
                  <input
                    id="login-username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder={t('login.usernamePlaceholder')}
                    aria-invalid={Boolean(errors.username)}
                    aria-describedby={errors.username ? 'login-username-error' : undefined}
                  />
                </div>
                {errors.username && (
                  <p id="login-username-error" className="login-field-error" role="alert">
                    {errors.username}
                  </p>
                )}
              </div>

              <div className="login-field">
                <label htmlFor="login-password">{t('auth.password')}</label>
                <div className="login-input-wrap">
                  <LockKeyhole aria-hidden="true" />
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={t('login.passwordPlaceholder')}
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? 'login-password-error' : undefined}
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </button>
                </div>
                {errors.password && (
                  <p id="login-password-error" className="login-field-error" role="alert">
                    {errors.password}
                  </p>
                )}
              </div>
            </div>

            <div className="login-remember">
              <input
                id="login-remember"
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />
              <label htmlFor="login-remember">{t('auth.rememberMe')}</label>
            </div>

            <button className="login-submit" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="login-spinner" aria-hidden="true" />
                  {t('auth.loggingIn')}
                </>
              ) : (
                <>
                  <LockKeyhole aria-hidden="true" />
                  {t('auth.loginButton')}
                </>
              )}
            </button>

            <div className="login-separator" aria-hidden="true">
              <span />
              <small>{t('login.or')}</small>
              <span />
            </div>

            <div className="login-forgot">
              <a href="mailto:admin@sonasp.ml?subject=R%C3%A9initialisation%20du%20mot%20de%20passe%20SONASP">
                <KeyRound aria-hidden="true" />
                {t('login.forgotPassword')}
              </a>
            </div>

            <p className="login-help">
              {t('login.needHelp')}{' '}
              <a href="mailto:admin@sonasp.ml">{t('login.contactAdmin')}</a>
            </p>
          </form>

          <footer className="login-footer">
            <p>
              <ShieldCheck aria-hidden="true" />
              {t('login.copyright', { year: 2026 })}
            </p>
            <span>{t('login.compliance')}</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
