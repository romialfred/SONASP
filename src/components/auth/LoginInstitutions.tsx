import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import "./LoginInstitutions.css";

// Présidence / SONASP : positionnement fourni par le propriétaire de la plateforme.
// Définitions techniques : finances.gov.bf, energie-mines.gov.bf et bumigeb.bf.
const institutions = [
  {
    key: "presidency",
    name: "Présidence du Faso",
    image: "/institutional/armoiries-burkina-faso.png",
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
    image: "/institutional/armoiries-burkina-faso.png",
    category: "Finances publiques",
    definition:
      "Administration chargée des politiques économiques et financières de l’État. Elle contribue à la mobilisation des recettes publiques et à la transparence du secteur extractif.",
  },
  {
    key: "mines",
    name: "Ministère des Mines et de l’Énergie",
    image: "/institutional/armoiries-burkina-faso.png",
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
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  const [active, setActive] = useState<number | null>(null);
  const [position, setPosition] = useState({ left: 16, bottom: 140 });

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
      left: Math.max(16, Math.min(window.innerWidth - width - 16,
        bounds.left + bounds.width / 2 - width / 2)),
      bottom: window.innerHeight - (bandRef.current?.getBoundingClientRect().top ?? bounds.top) + 8,
    });
    setActive(index);
  };

  return (
    <section
      ref={bandRef}
      className="login-institutions"
      aria-labelledby="login-institutions-title"
      onMouseEnter={() => clearTimeout(closeTimer.current)}
      onMouseLeave={() => {
        if (!bandRef.current?.contains(document.activeElement))
          closeTimer.current = setTimeout(() => setActive(null), 180);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setActive(null);
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
      </div>
      <div className="login-institutions__viewport">
        {/* Deux groupes identiques : le second prend exactement la place du premier
            à la fin du cycle. La copie visuelle ne double pas la navigation clavier. */}
        <div className="login-institutions__track">
          {[false, true].map((duplicate) => (
            <ul className="login-institutions__group" key={String(duplicate)} aria-hidden={duplicate || undefined}>
              {institutions.map((institution, index) => (
                <li key={institution.key} className={'login-institution login-institution--' + institution.key}>
                  <button
                    type="button"
                    tabIndex={duplicate ? -1 : 0}
                    data-institution={institution.key}
                    aria-label={'À propos de ' + institution.name}
                    aria-describedby={!duplicate && active === index ? "login-institution-definition" : undefined}
                    onMouseDown={(event) => { if (duplicate) event.preventDefault(); }}
                    onMouseEnter={(event) => show(index, event.currentTarget)}
                    onFocus={(event) => show(index, event.currentTarget)}
                    onClick={(event) => show(index, event.currentTarget)}
                  >
                    <img src={institution.image} alt={duplicate ? "" : institution.name}
                      width={institution.key === "sonasp" ? 621 : institution.key === "bumigeb" ? 261 : 500}
                      height={institution.key === "sonasp" ? 211 : institution.key === "bumigeb" ? 165 : 587}
                    />
                    <span>{institution.name}</span>
                    <Info className="login-institution__info" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
      {active !== null && (
        <div id="login-institution-definition" role="tooltip" className="login-institution-popup" style={position}
          onMouseEnter={() => clearTimeout(closeTimer.current)}>
          <span className="login-institution-popup__eyebrow">Institution du secteur minier</span>
          <strong>{institutions[active].name}</strong>
          <span className="login-institution-popup__category">{institutions[active].category}</span>
          <p>{institutions[active].definition}</p>
        </div>
      )}
    </section>
  );
}
