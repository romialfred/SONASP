import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Info, Pause, Play } from "lucide-react";
import "./LoginInstitutions.css";

// Présidence / SONASP : positionnement fourni par le propriétaire de la plateforme.
// Définitions techniques : finances.gov.bf, energie-mines.gov.bf et bumigeb.bf.
const institutions = [
  {
    key: "presidency",
    name: "Présidence du Faso",
    image: "/login-faso/armoiries.png",
    category: "Pilotage institutionnel",
    definition:
      "Institution de rattachement de Faso SANAMA. La plateforme accompagne le pilotage national et la transparence du secteur minier au service du citoyen.",
  },
  {
    key: "sonasp",
    name: "SONASP",
    image: "/sonasp_logo.png",
    category: "Société Nationale des Substances Précieuses",
    definition:
      "Acteur de l’achat, de la consolidation et de la commercialisation de l’or du Burkina Faso. Ses achats auprès des mines industrielles s’inscrivent dans des accords contractuels.",
  },
  {
    key: "finance",
    name: "Ministère des Finances",
    image: "/login-faso/armoiries.png",
    category: "Finances publiques",
    definition:
      "Administration chargée des politiques économiques et financières de l’État. Elle contribue à la mobilisation des recettes publiques et à la transparence du secteur extractif.",
  },
  {
    key: "mines",
    name: "Ministère des Mines et de l’Énergie",
    image: "/login-faso/armoiries.png",
    category: "Politique minière et énergétique",
    definition:
      "Département ministériel chargé du secteur des mines et de l’énergie. Il assure notamment le suivi et le contrôle des activités minières et accompagne leur développement.",
  },
  {
    key: "bumigeb",
    name: "BUMIGEB",
    image: "/login-faso/bumigeb.png",
    category: "Bureau des Mines et de la Géologie du Burkina",
    definition:
      "Service géologique national. Il développe la connaissance géologique et minière du Burkina Faso et apporte son expertise géoscientifique au secteur minier.",
  },
] as const;

export function LoginInstitutions() {
  const bandRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  const [active, setActive] = useState<number | null>(null);
  const [position, setPosition] = useState({ left: 16, bottom: 140 });
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const move = useCallback(
    (direction: number) => {
      const track = trackRef.current;
      if (!track) return;
      setActive(null);
      const step =
        (track.firstElementChild?.getBoundingClientRect().width ?? 200) + 12;
      const end = track.scrollWidth - track.clientWidth;
      const next =
        direction > 0 && track.scrollLeft >= end - 2
          ? 0
          : direction < 0 && track.scrollLeft <= 2
            ? end
            : track.scrollLeft + direction * step;
      track.scrollTo({
        left: Math.max(0, Math.min(end, next)),
        behavior: reducedMotion ? "instant" : "smooth",
      });
    },
    [reducedMotion],
  );

  useEffect(() => {
    if (paused || hovered || focused || reducedMotion) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "hidden") move(1);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [paused, hovered, focused, reducedMotion, move]);

  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (!bandRef.current?.contains(event.target as Node)) setActive(null);
    };
    const resize = () => setActive(null);
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("resize", resize);
      clearTimeout(closeTimer.current);
    };
  }, []);

  const show = (index: number, element: HTMLButtonElement) => {
    clearTimeout(closeTimer.current);
    const bounds = element.getBoundingClientRect();
    const width = Math.min(350, window.innerWidth - 32);
    setPosition({
      left: Math.max(
        16,
        Math.min(
          window.innerWidth - width - 16,
          bounds.left + bounds.width / 2 - width / 2,
        ),
      ),
      bottom:
        window.innerHeight -
        (bandRef.current?.getBoundingClientRect().top ?? bounds.top) +
        8,
    });
    setActive(index);
  };

  return (
    <section
      ref={bandRef}
      className="login-institutions"
      aria-labelledby="login-institutions-title"
      onMouseEnter={() => {
        clearTimeout(closeTimer.current);
        setHovered(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
        if (!focused)
          closeTimer.current = setTimeout(() => setActive(null), 180);
      }}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocused(false);
          setActive(null);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setActive(null);
          event.stopPropagation();
        }
      }}
    >
      <div className="login-institutions__heading">
        <h2 id="login-institutions-title">Institutions du secteur minier</h2>
        <div
          className="login-institutions__controls"
          aria-label="Défilement des institutions"
        >
          <button
            type="button"
            onClick={() => move(-1)}
            aria-label="Institutions précédentes"
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          {!reducedMotion && (
            <button
              type="button"
              onClick={() => setPaused((value) => !value)}
              aria-label={
                paused
                  ? "Reprendre le défilement"
                  : "Mettre le défilement en pause"
              }
              aria-pressed={paused}
            >
              {paused ? (
                <Play aria-hidden="true" />
              ) : (
                <Pause aria-hidden="true" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => move(1)}
            aria-label="Institutions suivantes"
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>
      <ul
        ref={trackRef}
        className="login-institutions__track"
        onScroll={() => {
          // La tabulation peut amener un logo hors champ dans la zone visible.
          // Sa fiche doit rester ouverte après ce défilement natif.
          const button = document.activeElement;
          if (button instanceof HTMLButtonElement && trackRef.current?.contains(button)) {
            const index = institutions.findIndex((institution) => button.dataset.institution === institution.key);
            if (index >= 0) show(index, button);
          } else setActive(null);
        }}
      >
        {institutions.map((institution, index) => (
          <li
            key={institution.key}
            className={`login-institution login-institution--${institution.key}`}
          >
            <button
              type="button"
              data-institution={institution.key}
              aria-label={`À propos de ${institution.name}`}
              aria-describedby={
                active === index ? "login-institution-definition" : undefined
              }
              onMouseEnter={(event) => show(index, event.currentTarget)}
              onFocus={(event) => show(index, event.currentTarget)}
              onClick={(event) => show(index, event.currentTarget)}
            >
              <img
                src={institution.image}
                alt={institution.name}
                width={institution.key === "sonasp" ? 621 : 200}
                height={institution.key === "sonasp" ? 211 : 200}
              />
              <span>{institution.name}</span>
              <Info className="login-institution__info" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      {active !== null && (
        <div
          id="login-institution-definition"
          role="tooltip"
          className="login-institution-popup"
          style={position}
        >
          <span className="login-institution-popup__eyebrow">
            Institution du secteur minier
          </span>
          <strong>{institutions[active].name}</strong>
          <span className="login-institution-popup__category">
            {institutions[active].category}
          </span>
          <p>{institutions[active].definition}</p>
        </div>
      )}
    </section>
  );
}
