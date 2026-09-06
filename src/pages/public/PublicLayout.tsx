import { ChevronDown, Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useCoursOr } from '@/hooks/useCoursOr';
import { PublicLocaleProvider, usePublicLocale } from './PublicLocaleContext';
import { PortalAccessButton } from './PortalAccessButton';
import type { PublicLocale } from './publicContent';
import { INTERFACE_LANGUAGES } from '@/i18n/interfaceLanguages';
import './public-site.css';
import './faso-vitrine.css';

const publicLinks = [
  { key: 'platform', href: '/#plateforme' },
  { key: 'mines', href: '/#acteurs' },
  { key: 'process', href: '/#processus' },
  { key: 'security', href: '/#securite' },
] as const;

type PublicSectionKey = (typeof publicLinks)[number]['key'];

function PublicLayoutInner() {
  const { content, locale, setLocale } = usePublicLocale();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [condensed, setCondensed] = useState(false);
  const [activeSection, setActiveSection] = useState<PublicSectionKey>('platform');
  const [scrollProgress, setScrollProgress] = useState(0);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileNavRef = useRef<HTMLElement>(null);
  const { cours, prixGrammeFcfa, derniereMaj, chargement: coursEnChargement } = useCoursOr({
    actualisationAutomatique: false,
  });

  useEffect(() => {
    setMenuOpen(false);
    if (!location.hash) {
      setActiveSection('platform');
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [location.pathname, location.hash, location.key]);

  useEffect(() => {
    let animationFrame = 0;
    const updateScrollState = () => {
      const availableScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      setCondensed(window.scrollY > 24);
      if (window.scrollY <= 24) setActiveSection('platform');
      setScrollProgress(Math.min(100, Math.max(0, (window.scrollY / availableScroll) * 100)));
    };
    const onScroll = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(updateScrollState);
    };
    const onResize = () => {
      if (window.innerWidth > 920) setMenuOpen(false);
      updateScrollState();
    };
    updateScrollState();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  useEffect(() => {
    if (location.pathname !== '/') return undefined;
    const hashSection = publicLinks.find(({ href }) => href.endsWith(location.hash));
    if (hashSection) setActiveSection(hashSection.key);

    const sectionMap = new Map<Element, PublicSectionKey>();
    publicLinks.forEach(({ key, href }) => {
      const section = document.getElementById(href.split('#')[1]);
      if (section) sectionMap.set(section, key);
    });
    if (sectionMap.size === 0 || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      const section = visible ? sectionMap.get(visible.target) : undefined;
      if (section) setActiveSection(section);
    }, { rootMargin: '-18% 0px -58% 0px', threshold: [0.05, 0.18, 0.35] });

    sectionMap.forEach((_key, section) => observer.observe(section));
    return () => observer.disconnect();
  }, [location.hash, location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    const firstLink = mobileNavRef.current?.querySelector<HTMLElement>('a');
    firstLink?.focus();
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const navigationLabel = locale === 'fr' ? 'Navigation principale' : 'Main navigation';
  const valeurCours = prixGrammeFcfa ?? cours?.price ?? null;
  const coursFormate = valeurCours === null
    ? '—'
    : new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
      minimumFractionDigits: prixGrammeFcfa === null ? 2 : 0,
      maximumFractionDigits: prixGrammeFcfa === null ? 2 : 0,
    }).format(valeurCours);
  const uniteCours = prixGrammeFcfa === null && cours ? `${cours.currency} / oz` : 'FCFA / g';
  const variation = cours?.changePercent24h;
  const heureCours = derniereMaj?.toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="public-site faso-public">
      <a className="public-site__skip-link" href="#contenu-principal">
        {locale === 'fr' ? 'Aller au contenu' : 'Skip to content'}
      </a>

      <div className="institutional-bar">
        <div className="public-shell institutional-bar__inner">
          <div className="institutional-bar__identity">
            <img src="/institutional/armoiries-burkina-faso.png" alt="" aria-hidden="true" />
            <span className="institutional-bar__copy">
              <strong>BURKINA FASO</strong>
              <small>PRÉSIDENCE DU FASO</small>
            </span>
          </div>
          <div className="institutional-bar__ticker" aria-label={locale === 'fr' ? 'Cours indicatif de l’or 24 carats' : 'Indicative 24-carat gold price'}>
            <svg className="institutional-bar__gold" viewBox="0 0 44 32" aria-hidden="true">
              <path d="M8 10 24 3l12 7-7 14H3L8 10Z" fill="currentColor" />
              <path d="m8 10 21 14M24 3l5 21M8 10h28" fill="none" stroke="rgba(255,255,255,.38)" strokeWidth="1.25" />
            </svg>
            <strong>{locale === 'fr' ? 'Cours de l’or' : 'Gold price'} <span>• 24K</span></strong>
            <data value={valeurCours ?? undefined} className={valeurCours === null ? 'is-unavailable' : undefined}>
              {coursFormate} <small>{uniteCours}</small>
            </data>
            {typeof variation === 'number' && (
              <span className={`institutional-bar__change${variation < 0 ? ' is-negative' : ''}`}>
                <i aria-hidden="true" />
                {variation >= 0 ? '+' : ''}{variation.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} %
              </span>
            )}
            <small className="institutional-bar__updated">
              {coursEnChargement
                ? (locale === 'fr' ? 'Actualisation…' : 'Updating…')
                : valeurCours !== null && heureCours
                  ? `${locale === 'fr' ? 'Mis à jour à' : 'Updated at'} ${heureCours}`
                  : (locale === 'fr' ? 'Cours indisponible' : 'Price unavailable')}
            </small>
          </div>
          <div className="institutional-bar__actions">
            <a href="/#apropos">{content.navigation.about}</a>
            <Link to="/assistance">{content.navigation.assistance}</Link>
            <label className="institutional-bar__language">
              <span className="sr-only">{locale === 'fr' ? 'Langue' : 'Language'}</span>
              <select
                value={locale}
                onChange={(event) => setLocale(event.target.value as PublicLocale)}
                aria-label={locale === 'fr' ? 'Choisir la langue' : 'Choose language'}
              >
                {INTERFACE_LANGUAGES.map((option) => (
                  <option key={option.code} value={option.code} disabled={!option.enabled}>
                    {option.code.toUpperCase()}{option.enabled ? '' : ' — bientôt disponible'}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" />
            </label>
          </div>
        </div>
      </div>

      <header className={`public-header${condensed ? ' public-header--condensed' : ''}`}>
        <div className="public-shell public-header__inner">
          <Link className="public-brand" to="/" aria-label="Faso SANAMA — Accueil">
            <img className="fs-brand__arms" src="/institutional/armoiries-burkina-faso.png" alt="Armoiries du Burkina Faso" width="500" height="587" />
            <span className="fs-brand__divider" aria-hidden="true" />
            <img src="/login-faso/faso-sanama.png" alt="Faso SANAMA" width="1536" height="1024" />
          </Link>

          <nav className="public-nav" aria-label={navigationLabel}>
            {publicLinks.map(({ key, href }) => (
              href.startsWith('/#') ? (
                <a
                  className={activeSection === key ? 'is-active' : undefined}
                  href={href}
                  key={key}
                  aria-current={location.pathname === '/' && activeSection === key ? 'location' : undefined}
                  onClick={() => setActiveSection(key)}
                >
                  {content.navigation[key]}
                </a>
              ) : (
                <Link to={href} key={key}>{content.navigation[key]}</Link>
              )
            ))}
          </nav>

          <div className="public-header__actions">
            <PortalAccessButton label={content.navigation.portal} compact />
            <button
              ref={menuButtonRef}
              className="public-menu-button"
              type="button"
              aria-expanded={menuOpen}
              aria-controls="navigation-mobile"
              aria-label={menuOpen
                ? (locale === 'fr' ? 'Fermer le menu' : 'Close menu')
                : (locale === 'fr' ? 'Ouvrir le menu' : 'Open menu')}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>
          </div>
        </div>

        <div className="public-header__scroll-progress" aria-hidden="true">
          <span style={{ width: `${scrollProgress}%` }} />
        </div>

        {menuOpen && (
          <>
            <button
              className="public-mobile-overlay"
              type="button"
              aria-label={locale === 'fr' ? 'Fermer le menu' : 'Close menu'}
              onClick={() => {
                setMenuOpen(false);
                menuButtonRef.current?.focus();
              }}
            />
            <nav ref={mobileNavRef} id="navigation-mobile" className="public-mobile-nav" aria-label={navigationLabel}>
              {publicLinks.map(({ key, href }) => (
                <a
                  className={activeSection === key ? 'is-active' : undefined}
                  href={href}
                  key={key}
                  aria-current={location.pathname === '/' && activeSection === key ? 'location' : undefined}
                  onClick={() => setActiveSection(key)}
                >
                  {content.navigation[key]}
                </a>
              ))}
              <PortalAccessButton label={content.navigation.portal} />
            </nav>
          </>
        )}
      </header>

      <main id="contenu-principal" tabIndex={-1}>
        <Outlet />
      </main>

      <footer className="public-footer">
        <div className="public-shell public-footer__grid">
          <div className="public-footer__brand">
            <img src="/login-faso/faso-sanama.png" alt="Faso SANAMA" width="1536" height="1024" loading="lazy" />
            <p>{content.footer.description}</p>
          </div>
          <div>
            <h2>{content.footer.institution}</h2>
            <a href="/#apropos">{content.navigation.about}</a>

            <Link to="/assistance">{content.navigation.assistance}</Link>
          </div>
          <div>
            <h2>{content.footer.platform}</h2>
            <a href="/#plateforme">{content.navigation.platform}</a>
            <a href="/#processus">{content.navigation.process}</a>
            <a href="/#acteurs">Les acteurs et leurs portails</a>
            <Link to="/login">Connexion sécurisée</Link>
          </div>
          <div>
            <h2>{content.footer.legal}</h2>
            <Link to="/mentions-legales">Mentions légales</Link>
            <Link to="/confidentialite">Politique de confidentialité</Link>
            <Link to="/conditions-utilisation">Conditions d’utilisation</Link>
            <Link to="/securite">Sécurité</Link>
          </div>
        </div>
        <div className="public-shell public-footer__bottom">
          <span>© {new Date().getFullYear()} Présidence du Burkina Faso. {content.footer.rights}</span>
          <span>Conception &amp; support : Quantix Solutions Burkina Faso</span>
        </div>
      </footer>
    </div>
  );
}

export default function PublicLayout() {
  return (
    <PublicLocaleProvider>
      <PublicLayoutInner />
    </PublicLocaleProvider>
  );
}
