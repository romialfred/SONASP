import { FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  Check,
  ChevronDown,
  ClipboardList,
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
import './Login.css';

/**
 * Page de connexion.
 *
 * ══ CE QUI A CHANGÉ ══
 *
 * La version précédente peignait une capture d'écran de 1,4 Mo sur toute la
 * fenêtre (`object-fit: fill`), masquait des morceaux avec des dégradés, puis
 * posait les vrais champs par-dessus à des décalages en pixels — `top: 58px`,
 * `left: 42px`. La mise en page n'était donc juste qu'aux quelques largeurs
 * pour lesquelles ces décalages avaient été réglés, et chaque visiteur
 * téléchargeait l'image avant même de pouvoir se connecter.
 *
 * Tout est désormais dessiné en CSS. Le panneau de gauche est un vrai bloc de
 * texte, la diagonale un `clip-path`, et la carte se centre d'elle-même.
 *
 * ══ LE CHAMP D'IDENTIFICATION ══
 *
 * Il est intitulé « Nom d'utilisateur », comme la maquette. Ce que la
 * plateforme envoie à GoTrue est pourtant l'adresse de courriel : voir
 * `AuthContext.signIn`. Le libellé n'a pas été changé ici — ce serait décider
 * seul d'un point qui engage tous les comptes — mais l'écart est signalé dans
 * le registre des anomalies.
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
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [langOpen, setLangOpen] = useState(false);
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
    if (loading) return;
    if (!validateForm()) return;

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
      setLoading(false);
    }
  };

  const currentLanguage = 'Français';

  const piliers = [
    {
      Icon: ShieldCheck,
      lines: [t('login.pillar1Line1', 'Transactions'), t('login.pillar1Line2', 'sécurisées')],
    },
    {
      Icon: ClipboardList,
      lines: [t('login.pillar2Line1', 'Suivi des'), t('login.pillar2Line2', 'opérations')],
    },
    {
      Icon: BarChart3,
      lines: [t('login.pillar3Line1', 'Données'), t('login.pillar3Line2', 'fiables')],
    },
  ];

  return (
    <div className="sonasp-login">
      {/* Décor : le panneau vert, sa photographie et le liseré doré de la
          diagonale. Trois couches distinctes pour que le liseré passe au-dessus
          du panneau sans être rogné par son propre `clip-path`. */}
      <div className="login-hero" aria-hidden="true">
        <div className="login-hero__image" />
        <div className="login-hero__veil" />
      </div>
      <div className="login-hero__edge" aria-hidden="true" />

      <div className="login-shell">
        <section className="login-presentation" aria-label={t('login.officialPlatform')}>
          <img
            className="login-presentation__logo"
            src="/sonasp_logo.png"
            alt="SONASP"
            width={621}
            height={211}
          />

          <p className="login-presentation__eyebrow">
            <span aria-hidden="true" />
            {t('login.officialPlatform')}
          </p>

          <h1 className="login-presentation__title">
            <span>{t('login.heroTitleLine1', 'Collecte et vente des')}</span>
            <span>{t('login.heroTitleLine2', 'substances précieuses')}</span>
          </h1>

          <span className="login-presentation__rule" aria-hidden="true" />

          <p className="login-presentation__lead">
            <span>{t('login.heroSubtitleLine1', 'Une plateforme sécurisée pour gérer les opérations,')}</span>
            <span>{t('login.heroSubtitleLine2', 'les transactions et les données du secteur.')}</span>
          </p>

          <ul className="login-pillars">
            {piliers.map(({ Icon, lines }) => (
              <li key={lines.join(' ')}>
                <span className="login-pillars__icon" aria-hidden="true"><Icon /></span>
                <span className="login-pillars__label">
                  <span>{lines[0]}</span>
                  <span>{lines[1]}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <main className="login-panel">
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

          <div className="login-column">
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
                {t('login.securedSpace', 'Espace professionnel sécurisé')}
              </p>
              <h2 id="login-card-title" className="login-card__title">{t('auth.login')}</h2>
              <p className="login-card__subtitle">
                {t('login.cardSubtitle', 'Accédez à votre espace SONASP')}
              </p>

              {errors.general && (
                <p className="login-card__alert" role="alert">
                  {errors.general}
                </p>
              )}

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
                {errors.username && (
                  <p id="login-username-error" className="login-field__error" role="alert">
                    {errors.username}
                  </p>
                )}
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
                {errors.password && (
                  <p id="login-password-error" className="login-field__error" role="alert">
                    {errors.password}
                  </p>
                )}
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

            <p className="login-copyright">{t('login.copyright', { year: 2026 })}</p>
          </div>
        </main>
      </div>
    </div>
  );
}
