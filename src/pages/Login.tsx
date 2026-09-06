import { FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Globe,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  INTERFACE_LANGUAGES,
  INTERFACE_LANGUAGE_STORAGE_KEY,
  isInterfaceLanguageEnabled,
} from '@/i18n/interfaceLanguages';
import { usePageMetadata } from '@/components/seo/PageMetadata';
import { LoginInstitutions } from '@/components/auth/LoginInstitutions';
import './Login.css';

/**
 * Présentation Faso SANAMA. La soumission reste celle d’AuthContext ;
 * PublicRoute et MandatoryMfaGate conservent les redirections et la sécurité.
 * Le champ « Nom d’utilisateur » correspond toujours à l’e-mail côté GoTrue.
 */

/**
 * Bouclier au cadenas.
 *
 * La maquette pose cet emblème au sommet de la carte. La bibliothèque d'icônes
 * n'a que le bouclier à la coche — un autre signe, qui dit « vérifié » là où
 * celui-ci dit « fermé ». On le compose donc, au même gabarit et à la même
 * épaisseur de trait que le reste, pour qu'il ne détonne pas.
 */
function BouclierCadenas(proprietes: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...proprietes}
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <rect x="9.4" y="11.3" width="5.2" height="4.4" rx="0.8" />
      <path d="M10.6 11.3v-1.35a1.4 1.4 0 0 1 2.8 0v1.35" />
    </svg>
  );
}

type LoginErrors = Partial<Record<'username' | 'password' | 'general', string>>;

/**
 * GoTrue répond en anglais, et « Invalid login credentials » s'affichait tel
 * quel à un agent de la SONASP. On rend une phrase professionnelle connue et
 * on masque tout message technique non reconnu derrière le message de secours.
 */
export function messageConnexion(brut: string, secours: string): string {
  const texte = brut.toLowerCase();
  if (texte.includes('invalid login credentials')) {
    return 'Nom d’utilisateur ou mot de passe incorrect.';
  }
  if (texte.includes('email not confirmed')) {
    return 'Ce compte n’a pas encore été confirmé. Contactez l’administrateur.';
  }
  if (texte.includes('too many requests') || texte.includes('rate limit')) {
    return 'Trop de tentatives. Patientez quelques instants avant de réessayer.';
  }
  if (
    texte.includes('user is banned')
    || texte.includes('user not found')
    || texte.includes('account_not_authorized')
  ) {
    return 'Votre compte n’est pas autorisé à accéder à la plateforme.';
  }
  if (texte.includes('failed to fetch') || texte.includes('network')) {
    return 'La connexion est momentanément indisponible. Veuillez réessayer.';
  }
  return secours;
}

export function Login() {
  const { t, i18n } = useTranslation();
  const { signIn } = useAuth();
  usePageMetadata({
    title: t('login.pageTitle', 'Connexion | Faso SANAMA'),
    description: t('login.pageDescription', 'Espace professionnel sécurisé de la Plateforme Nationale de Traçabilité du Secteur Minier, sous l’égide de la Présidence du Faso.'),
    openGraph: { siteName: 'Faso SANAMA', image: '/login-faso/faso-sanama.png', imageAlt: 'Faso SANAMA' },
  });
  const submissionRef = useRef(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [langOpen, setLangOpen] = useState(false);
  const [brandUnavailable, setBrandUnavailable] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const langTriggerRef = useRef<HTMLButtonElement>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const closeLanguageMenu = (event: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setLangOpen(false);
      }
    };

    document.addEventListener('mousedown', closeLanguageMenu);
    return () => document.removeEventListener('mousedown', closeLanguageMenu);
  }, []);

  useEffect(() => {
    const language = i18n.resolvedLanguage || i18n.language;
    document.documentElement.lang = language.startsWith('en') ? 'en' : 'fr-BF';
  }, [i18n.language, i18n.resolvedLanguage]);

  const changeLanguage = (language: string) => {
    if (!isInterfaceLanguageEnabled(language)) return;
    void i18n.changeLanguage(language);
    window.localStorage.setItem(INTERFACE_LANGUAGE_STORAGE_KEY, language);
    setLangOpen(false);
    langTriggerRef.current?.focus();
  };

  const validateForm = () => {
    const nextErrors: LoginErrors = {};
    if (!username.trim()) {
      nextErrors.username = t(
        'login.usernameRequired',
        'Veuillez renseigner votre nom d’utilisateur.',
      );
    }
    if (!password) {
      nextErrors.password = t('login.passwordRequired', 'Veuillez renseigner votre mot de passe.');
    }
    setErrors(nextErrors);

    if (nextErrors.username) usernameInputRef.current?.focus();
    else if (nextErrors.password) passwordInputRef.current?.focus();

    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submissionRef.current) return;
    if (!validateForm()) return;

    submissionRef.current = true;
    setLoading(true);
    setErrors({});
    const secours = t(
      'login.unavailable',
      'La connexion est momentanément indisponible. Veuillez réessayer.',
    );
    try {
      const result = await signIn(username, password);
      if (result.error) setErrors({ general: messageConnexion(result.error, secours) });
    } catch (error: unknown) {
      const brut = error instanceof Error ? error.message : '';
      setErrors({ general: messageConnexion(brut, secours) });
    } finally {
      submissionRef.current = false;
      setLoading(false);
    }
  };

  const currentLanguage = 'Français';

  return (
    <div className="faso-login">
      <div className="login-national-line" aria-hidden="true"><span /></div>
      <div className="login-scene">
        <div className="login-landscape" aria-hidden="true" />
        <div className="login-contours login-contours--left" aria-hidden="true" />
        <div className="login-contours login-contours--right" aria-hidden="true" />
        <header className="login-header">
          {brandUnavailable ? (
            <p className="login-brand login-brand--text">Faso SANAMA</p>
          ) : (
            <img
              className="login-brand"
              src="/login-faso/faso-sanama.png"
              alt="Faso SANAMA"
              width={1536}
              height={1024}
              onError={() => setBrandUnavailable(true)}
            />
          )}
          <nav className="login-navigation" aria-label={t('login.navigation', 'Navigation de connexion')}>
            <Link className="login-return" to="/">
              <ArrowLeft aria-hidden="true" />
              <span>{t('login.backToShowcase', 'Retour à la vitrine')}</span>
            </Link>
            <div
              ref={langRef}
              className="login-language"
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setLangOpen(false);
                  langTriggerRef.current?.focus();
                }
              }}
            >
              <button
                ref={langTriggerRef}
                type="button"
                className="login-language__trigger"
                aria-haspopup="menu"
                aria-expanded={langOpen}
                aria-controls="login-language-menu"
                aria-label={`${t('header.currentLanguage', { language: currentLanguage })}. ${t('login.changeLanguage', 'Changer de langue')}`}
                onClick={() => setLangOpen((open) => !open)}
              >
                <Globe aria-hidden="true" />
                <span>{currentLanguage}</span>
                <ChevronDown className={langOpen ? 'is-open' : ''} aria-hidden="true" />
              </button>

              {langOpen && (
                <div id="login-language-menu" className="login-language__menu" role="menu">
                  {INTERFACE_LANGUAGES.map((language) => (
                    <button
                      key={language.code}
                      type="button"
                      role="menuitemradio"
                      disabled={!language.enabled}
                      aria-disabled={!language.enabled}
                      aria-checked={language.code === 'fr'}
                      title={language.enabled ? undefined : 'Disponible dans une prochaine version'}
                      onClick={() => changeLanguage(language.code)}
                    >
                      <span>{language.label}</span>
                      {language.code === 'fr' && (
                        <Check aria-hidden="true" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </nav>
        </header>

        <main className="login-shell">
          <section className="login-presentation" aria-labelledby="login-hero-title">
            <h1 id="login-hero-title" className="login-presentation__title">
              <span>{t('login.heroTitleLine1', 'Plateforme Nationale')}</span>
              <span>{t('login.heroTitleLine2', 'de Traçabilité du')}</span>
              <span className="login-presentation__gold">{t('login.heroTitleLine3', 'Secteur Minier')}</span>
            </h1>
            <p className="login-presentation__lead">
              <span>{t('login.heroSubtitleLine1', 'Production, collecte et vente')}</span>
              <span>{t('login.heroSubtitleLine2', 'Impôts et taxes · Artisans miniers')}</span>
            </p>
            <span className="login-presentation__rule" aria-hidden="true" />
            <p className="login-presentation__slogan">{t('login.slogan', 'La performance minière au service du citoyen')}</p>
          </section>
          <div className="login-panel">
            <form
              id="login-form"
              className="login-card"
              onSubmit={handleSubmit}
              noValidate
              aria-labelledby="login-card-title"
              aria-busy={loading}
            >
              <span className="login-card__emblem" aria-hidden="true">
                <BouclierCadenas />
              </span>

              <p className="login-card__eyebrow">
                {t('login.securedSpace', 'ESPACE PROFESSIONNEL SÉCURISÉ')}
              </p>
              <h2 id="login-card-title" className="login-card__title">{t('auth.login')}</h2>
              <p className="login-card__subtitle">
                {t('login.cardSubtitle', 'Accédez à votre espace Faso SANAMA')}
              </p>

              <div className="login-feedback" data-error={Object.values(errors).some(Boolean)}>
                {Object.values(errors).some(Boolean) && (
                  <div className="login-card__alert" role="alert">
                    {errors.general && <p>{errors.general}</p>}
                    {errors.username && <p id="login-username-error">{errors.username}</p>}
                    {errors.password && <p id="login-password-error">{errors.password}</p>}
                  </div>
                )}
              </div>

              <div className="login-field">
                <label htmlFor="login-username">{t('login.usernameLabel')}</label>
                <div className="login-field__control">
                  <UserRound aria-hidden="true" />
                  <input
                    ref={usernameInputRef}
                    id="login-username"
                    name="username"
                    type="text"
                    inputMode="email"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    disabled={loading}
                    value={username}
                    onChange={(event) => {
                      setUsername(event.target.value);
                      if (errors.username) setErrors((current) => ({ ...current, username: undefined }));
                    }}
                    placeholder={t('login.usernamePlaceholder')}
                    aria-invalid={Boolean(errors.username)}
                    aria-describedby={errors.username ? 'login-username-error' : undefined}
                  />
                </div>
              </div>

              <div className="login-field">
                <label htmlFor="login-password">{t('auth.password')}</label>
                <div className="login-field__control">
                  <LockKeyhole aria-hidden="true" />
                  <input
                    ref={passwordInputRef}
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    disabled={loading}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (errors.password) setErrors((current) => ({ ...current, password: undefined }));
                    }}
                    placeholder={t('login.passwordPlaceholder')}
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? 'login-password-error' : undefined}
                  />
                  <button
                    type="button"
                    className="login-field__toggle"
                    disabled={loading}
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <div className="login-options">
                <Link className="login-options__forgot" to="/recuperer-acces">
                  {t('login.forgotPassword')}
                </Link>
              </div>

              <button className="login-submit" type="submit" disabled={loading} aria-live="polite">
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

              <p className="login-card__assurance">
                <ShieldCheck aria-hidden="true" />
                {t('login.encrypted', 'Connexion chiffrée et accès protégé')}
              </p>

              <p className="login-card__help">
                {t('login.needHelp')}{' '}
                <Link to="/assistance#incident">{t('login.contactAdmin')}</Link>
              </p>
            </form>
          </div>
        </main>
      </div>

      <LoginInstitutions />
      <footer className="login-footer">
        <p>{t('login.copyright', { year: 2026 })}</p>
        <nav aria-label={t('login.footerNavigation', 'Informations et assistance')}>
          <Link to="/confidentialite">{t('login.privacy', 'Confidentialité')}</Link>
          <span aria-hidden="true">·</span>
          <Link to="/assistance">{t('login.assistance', 'Assistance')}</Link>
        </nav>
      </footer>
    </div>
  );
}
