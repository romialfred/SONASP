import { FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
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

const languages = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
] as const;

/**
 * GoTrue répond en anglais, et « Invalid login credentials » s'affichait tel
 * quel à un agent de la SONASP. On rend la phrase française correspondante, et
 * l'on garde le message d'origine quand il n'est pas reconnu : mieux vaut une
 * phrase anglaise qu'une erreur inventée.
 */
export function messageConnexion(brut: string, secours: string): string {
  const texte = brut.toLowerCase();
  if (texte.includes('invalid login credentials')) {
    return 'Identifiant ou mot de passe incorrect.';
  }
  if (texte.includes('email not confirmed')) {
    return 'Ce compte n’a pas encore été confirmé. Contactez l’administrateur.';
  }
  if (texte.includes('too many requests') || texte.includes('rate limit')) {
    return 'Trop de tentatives. Patientez quelques instants avant de réessayer.';
  }
  if (texte.includes('user is banned') || texte.includes('user not found')) {
    return 'Ce compte n’est plus actif. Contactez l’administrateur.';
  }
  if (texte.includes('failed to fetch') || texte.includes('network')) {
    return 'La plateforme est injoignable. Vérifiez votre connexion réseau.';
  }
  return brut || secours;
}

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
    const secours = t('errors.generic', "Une erreur inattendue s'est produite");
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

  const currentLanguage = (i18n.resolvedLanguage || i18n.language).startsWith('en')
    ? 'English'
    : 'Français';

  const piliers = [
    { Icon: ShieldCheck, label: t('login.pillar1', 'Transactions sécurisées') },
    { Icon: ClipboardList, label: t('login.pillar2', 'Suivi des opérations') },
    { Icon: BarChart3, label: t('login.pillar3', 'Données fiables') },
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
            src="/sonasp-logo-clair.png"
            alt="SONASP"
            width={620}
            height={237}
          />

          <p className="login-presentation__eyebrow">
            <span aria-hidden="true" />
            {t('login.officialPlatform')}
          </p>

          <h1 className="login-presentation__title">
            {t('login.heroTitle', 'Collecte et vente des substances précieuses')}
          </h1>

          <span className="login-presentation__rule" aria-hidden="true" />

          <p className="login-presentation__lead">
            {t(
              'login.heroSubtitle',
              'Une plateforme sécurisée pour gérer les opérations, les transactions et les données du secteur.',
            )}
          </p>

          <ul className="login-pillars">
            {piliers.map(({ Icon, label }) => (
              <li key={label}>
                <span aria-hidden="true"><Icon /></span>
                {label}
              </li>
            ))}
          </ul>
        </section>

        <main className="login-panel">
          <div
            ref={langRef}
            className="login-language"
            onKeyDown={(event) => {
              if (event.key === 'Escape') setLangOpen(false);
            }}
          >
            <button
              type="button"
              className="login-language__trigger"
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
              <div className="login-language__menu" role="menu">
                {languages.map((language) => (
                  <button
                    key={language.code}
                    type="button"
                    role="menuitemradio"
                    aria-checked={(i18n.resolvedLanguage || i18n.language).startsWith(language.code)}
                    onClick={() => changeLanguage(language.code)}
                  >
                    <span>{language.label}</span>
                    {(i18n.resolvedLanguage || i18n.language).startsWith(language.code) && (
                      <Check aria-hidden="true" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="login-column">
            <form className="login-card" onSubmit={handleSubmit} noValidate>
              <span className="login-card__emblem" aria-hidden="true">
                <BouclierCadenas />
              </span>

              <p className="login-card__eyebrow">
                {t('login.securedSpace', 'Espace professionnel sécurisé')}
              </p>
              <h2 className="login-card__title">{t('auth.login')}</h2>
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
                    className="login-field__toggle"
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
                <label className="login-options__remember">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                  />
                  <span>{t('auth.rememberMe')}</span>
                </label>
                <a
                  className="login-options__forgot"
                  href="mailto:admin@sonasp.ml?subject=R%C3%A9initialisation%20du%20mot%20de%20passe%20SONASP"
                >
                  {t('login.forgotPassword')}
                </a>
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

              <p className="login-card__assurance">
                <ShieldCheck aria-hidden="true" />
                {t('login.encrypted', 'Connexion chiffrée et accès protégé')}
              </p>

              <p className="login-card__help">
                {t('login.needHelp')}{' '}
                <a href="mailto:admin@sonasp.ml">{t('login.contactAdmin')}</a>
              </p>
            </form>

            <p className="login-copyright">{t('login.copyright', { year: 2026 })}</p>
          </div>
        </main>
      </div>
    </div>
  );
}
