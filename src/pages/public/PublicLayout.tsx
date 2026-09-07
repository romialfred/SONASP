import { ArrowRight, Globe2, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { PublicLocaleProvider } from "./PublicLocaleContext";
import "./public-site.css";
import "./faso-vitrine.css";

const publicLinks = [
  { label: "La plateforme", id: "plateforme" },
  { label: "Les portails", id: "portails" },
  { label: "La traçabilité", id: "tracabilite" },
  { label: "Impact national", id: "impact" },
];

function PublicLayoutInner() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const menuButton = useRef<HTMLButtonElement>(null);
  const mobileNav = useRef<HTMLElement>(null);

  useEffect(() => {
    setMenuOpen(false);
    if (!location.hash) {
      setActiveSection("");
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [location.pathname, location.hash, location.key]);

  useEffect(() => {
    if (
      location.pathname !== "/" ||
      typeof IntersectionObserver === "undefined"
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) setActiveSection(visible.target.id);
      },
      { rootMargin: "-90px 0px -60% 0px" },
    );
    publicLinks.forEach(({ id }) => {
      const node = document.getElementById(id);
      if (node) observer.observe(node);
    });
    return () => observer.disconnect();
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    mobileNav.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
      if (event.key === "Tab") {
        const links = Array.from(
          mobileNav.current?.querySelectorAll<HTMLAnchorElement>("a") ?? [],
        );
        const first = links[0],
          last = links[links.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          menuButton.current?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          menuButton.current?.focus();
        } else if (document.activeElement === menuButton.current) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        }
      }
    };
    const onResize = () => {
      if (window.innerWidth > 1100) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [menuOpen]);

  function navigate(id: string) {
    setActiveSection(id);
    setMenuOpen(false);
  }

  return (
    <div className="public-site faso-public">
      <a className="public-site__skip-link" href="#contenu-principal">
        Aller au contenu
      </a>
      <div className="fs-institutional">
        <div className="public-shell">
          <div className="fs-institutional__identity">
            <span className="fs-flag" aria-hidden="true">
              ★
            </span>
            <strong>
              BURKINA FASO <span>/</span> PRÉSIDENCE DU FASO
            </strong>
          </div>
          <span className="fs-language" aria-label="Langue : français">
            <Globe2 aria-hidden="true" /> Français
          </span>
        </div>
      </div>
      <header className="fs-header">
        <div className="public-shell fs-header__inner">
          <Link className="fs-brand" to="/" aria-label="Faso SANAMA — Accueil">
            <img
              src="/login-faso/faso-sanama.png"
              alt="Faso SANAMA"
              width="1536"
              height="1024"
            />
          </Link>
          <nav className="fs-nav" aria-label="Navigation principale">
            {publicLinks.map(({ label, id }) => (
              <a
                key={id}
                href={`/#${id}`}
                aria-current={
                  location.pathname === "/" && activeSection === id
                    ? "location"
                    : undefined
                }
                onClick={() => navigate(id)}
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="fs-header__actions">
            <Link className="fs-header__assistance" to="/assistance">
              Assistance
            </Link>
            <Link
              to="/login"
              className="fs-button fs-button--gold fs-header__access"
            >
              <span className="fs-header__full-label">
                Accéder à mon espace
              </span>
              <span className="fs-header__short-label">Mon espace</span>
              <ArrowRight aria-hidden="true" />
            </Link>
            <button
              ref={menuButton}
              className="fs-menu-button"
              type="button"
              aria-expanded={menuOpen}
              aria-controls="navigation-mobile"
              aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? (
                <X aria-hidden="true" />
              ) : (
                <Menu aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
        {menuOpen && (
          <>
            <button
              className="fs-menu-overlay"
              type="button"
              tabIndex={-1}
              aria-label="Fermer la navigation"
              onClick={() => {
                setMenuOpen(false);
                menuButton.current?.focus();
              }}
            />
            <nav
              id="navigation-mobile"
              ref={mobileNav}
              className="fs-mobile-nav"
              aria-label="Navigation mobile"
            >
              {publicLinks.map(({ label, id }) => (
                <a key={id} href={`/#${id}`} onClick={() => navigate(id)}>
                  {label}
                  <ArrowRight aria-hidden="true" />
                </a>
              ))}
              <Link to="/assistance" onClick={() => setMenuOpen(false)}>
                Assistance
                <ArrowRight aria-hidden="true" />
              </Link>
              <Link to="/login" onClick={() => setMenuOpen(false)}>
                Accéder à mon espace
                <ArrowRight aria-hidden="true" />
              </Link>
            </nav>
          </>
        )}
      </header>
      <main id="contenu-principal" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="fs-footer">
        <div className="public-shell fs-footer__grid">
          <div className="fs-footer__brand">
            <Link to="/" aria-label="Faso SANAMA — Accueil">
              <img
                src="/login-faso/faso-sanama.png"
                alt="Faso SANAMA"
                width="1536"
                height="1024"
                loading="lazy"
              />
            </Link>
            <p>
              Une plateforme de la Présidence du Faso au service de la
              traçabilité du secteur minier.
            </p>
          </div>
          <div>
            <h2>La plateforme</h2>
            <a href="/#plateforme">À propos</a>
            <a href="/#tracabilite">Traçabilité</a>
          </div>
          <div>
            <h2>Les portails</h2>
            <a href="/#portails">Présidence du Faso</a>
            <a href="/#portails">Acteurs du secteur</a>
          </div>
          <div>
            <h2>Informations utiles</h2>
            <Link to="/assistance">Assistance</Link>
            <Link to="/mentions-legales">Mentions légales</Link>
            <Link to="/confidentialite">Politique de confidentialité</Link>
            <Link to="/conditions-utilisation">Conditions d’utilisation</Link>
          </div>
        </div>
        <div className="public-shell fs-footer__bottom">
          <span>
            © {new Date().getFullYear()} Présidence du Burkina Faso. Tous
            droits réservés.
          </span>
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
