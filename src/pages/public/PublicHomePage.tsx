import { useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  Fingerprint,
  Gem,
  Landmark,
  Layers3,
  LockKeyhole,
  MapPin,
  ReceiptText,
  ShieldCheck,
  Users,
  Waypoints,
} from "lucide-react";
import { PageMetadata } from "../../components/seo/PageMetadata";
import { BURKINA_FASO_BOUNDARY } from "@/data/artisanalSitesData";
import { FasoHero } from "./FasoHero";
import {
  fasoActors,
  fasoTraceability,
  type FasoActor,
} from "./fasoVitrineContent";
import {
  hasPublishableValue,
  sectorIndicators,
  type SectorIndicator,
} from "./content/sectorIndicators";
import "./faso-vitrine.css";

export function SectorIndicators({
  indicators = sectorIndicators,
}: {
  indicators?: readonly SectorIndicator[];
}) {
  return (
    <section className="fs-sector fs-section" aria-labelledby="sector-title">
      <div className="public-shell">
        <div className="fs-sector__heading">
          <h2 id="sector-title">Le secteur aurifère en repères</h2>
          <span>Burkina Faso · Données nationales</span>
        </div>
        <dl className="fs-sector__numbers">
          {indicators.map((item) => (
            <div key={item.id}>
              <dt>{item.label}</dt>
              <dd>
                <strong>
                  {hasPublishableValue(item)
                    ? new Intl.NumberFormat("fr-FR").format(item.value!)
                    : "—"}
                </strong>
                <span>
                  {hasPublishableValue(item)
                    ? `${item.estimated ? "Estimation · " : ""}${item.date}`
                    : "Donnée non disponible"}
                </span>
              </dd>
            </div>
          ))}
        </dl>
        <details className="fs-sector__sources">
          <summary>Sources, dates et périmètres des indicateurs</summary>
          <p>
            {indicators.some(hasPublishableValue)
              ? "Les chiffres publiés sont associés à leur date, leur source et leur périmètre ci-dessous."
              : "Aucune source nationale validée n’est disponible à ce jour pour ces cinq indicateurs."}{" "}
            Les dossiers enregistrés sur FASO SANAMA ne constituent pas un
            recensement national.
          </p>
          <dl>
            {indicators.map((item) => (
              <div key={item.id}>
                <dt>{item.label}</dt>
                <dd>
                  {item.definition}
                  <span>
                    Source : {item.sourceTitle ?? "non disponible"} · Date de
                    référence : {item.date ?? "non disponible"} · Périmètre :{" "}
                    {item.scope}
                  </span>
                  {item.sourceUrl && (
                    <a href={item.sourceUrl} rel="noreferrer" target="_blank">
                      Consulter la source{" "}
                      <span className="sr-only">(nouvel onglet)</span>
                    </a>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      </div>
    </section>
  );
}

function PlatformSection() {
  return (
    <section
      id="plateforme"
      className="fs-section fs-platform"
      aria-labelledby="platform-title"
    >
      <div className="public-shell">
        <div className="fs-section-intro">
          <h2 id="platform-title">
            Toute la filière. <br />
            <span>Une vision commune.</span>
          </h2>
          <p>
            En organisant les acteurs et l’information, FASO SANAMA vise à
            renforcer la transparence, la performance du secteur minier et la
            mobilisation des ressources au service du développement national.
          </p>
        </div>
        <div className="fs-missions">
          {[
            {
              title: "Fédérer les acteurs",
              text: "Des espaces adaptés aux missions de chaque institution et opérateur.",
              icon: Users,
            },
            {
              title: "Suivre l’or",
              text: "Une continuité d’information, de la production aux échanges.",
              icon: Waypoints,
            },
            {
              title: "Éclairer l’action publique",
              text: "Une lecture structurée de la filière au service du pilotage national.",
              icon: BarChart3,
            },
          ].map(({ title, text, icon: Icon }, index) => (
            <article key={title}>
              <div className="fs-missions__symbol">
                <Icon aria-hidden="true" />
                <span>{String(index + 1).padStart(2, "0")}</span>
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const mapPoints = BURKINA_FASO_BOUNDARY.map(
  ([x, y]) => `${((x + 5.6) * 32).toFixed(1)},${((15.4 - y) * 32).toFixed(1)}`,
).join(" ");

function PortalPreview({ actor }: { actor: FasoActor }) {
  return (
    <div
      className="fs-preview"
      aria-label={`Aperçu illustratif : ${actor.label}`}
    >
      <div className="fs-preview__header">
        <span>
          <Landmark aria-hidden="true" /> FASO SANAMA
        </span>
        <small>Aperçu illustratif</small>
      </div>
      <div className="fs-preview__body">
        <div className="fs-preview__nav" aria-hidden="true">
          <BarChart3 />
          <Layers3 />
          <ReceiptText />
          <ShieldCheck />
        </div>
        {actor.id === "presidence" && (
          <div className="fs-preview__map">
            <span>Vue du territoire</span>
            <svg
              viewBox="0 0 260 200"
              role="img"
              aria-label="Contour du Burkina Faso, sans données de sites"
            >
              <polygon points={mapPoints} />
            </svg>
            <small>Burkina Faso · Vue illustrative</small>
          </div>
        )}
        <div className="fs-preview__modules">
          <p>{actor.role}</p>
          {actor.modules.map(({ title, description, icon: Icon }) => (
            <div className="fs-preview__module" key={title}>
              <Icon aria-hidden="true" />
              <div>
                <h4>{title}</h4>
                <p>{description}</p>
              </div>
              <LockKeyhole aria-label="Accès habilité" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActorsSection() {
  const [selected, setSelected] = useState(0);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const actor = fasoActors[selected];
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next =
      event.key === "ArrowDown" || event.key === "ArrowRight"
        ? (index + 1) % fasoActors.length
        : event.key === "ArrowUp" || event.key === "ArrowLeft"
          ? (index - 1 + fasoActors.length) % fasoActors.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? fasoActors.length - 1
              : null;
    if (next === null) return;
    event.preventDefault();
    setSelected(next);
    tabs.current[next]?.focus();
  }
  return (
    <section
      id="portails"
      className="fs-section fs-actors"
      aria-labelledby="actors-title"
    >
      <span id="acteurs" className="fs-anchor" />
      <div className="public-shell">
        <p className="fs-eyebrow">Des espaces adaptés à chaque mission</p>
        <h2 id="actors-title">
          Votre rôle. <span>Votre espace.</span>
        </h2>
        <div className="fs-actors__layout">
          <div
            className="fs-actors__tabs"
            role="tablist"
            aria-label="Les portails de la plateforme"
          >
            {fasoActors.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  type="button"
                  key={item.id}
                  ref={(node) => {
                    tabs.current[index] = node;
                  }}
                  id={`acteur-${item.id}`}
                  role="tab"
                  aria-selected={selected === index}
                  aria-controls="actor-panel"
                  tabIndex={selected === index ? 0 : -1}
                  onClick={() => setSelected(index)}
                  onKeyDown={(event) => onKeyDown(event, index)}
                >
                  <Icon aria-hidden="true" />
                  <span>{item.label}</span>
                  <ChevronRight aria-hidden="true" />
                </button>
              );
            })}
          </div>
          <div
            id="actor-panel"
            className="fs-actors__panel"
            role="tabpanel"
            aria-labelledby={`acteur-${actor.id}`}
            tabIndex={0}
          >
            <div className="fs-actors__intro">
              <div>
                <h3>{actor.title}</h3>
                <p>{actor.description}</p>
              </div>
              <Link to="/login" className="fs-text-link">
                Découvrir cet espace
                <ArrowRight aria-hidden="true" />
              </Link>
            </div>
            <PortalPreview actor={actor} />
            <p className="fs-actors__outcome">{actor.outcome}</p>
          </div>
        </div>
        <p className="fs-actors__note">
          Avec les administrations compétentes, dont la DGMG, et les acteurs
          techniques du secteur, dont le BUMIGEB. Les accès sont attribués selon
          les responsabilités de chaque organisme.
        </p>
      </div>
    </section>
  );
}

function TraceabilitySection() {
  const [selected, setSelected] = useState(0);
  const step = fasoTraceability[selected];
  return (
    <section
      id="tracabilite"
      className="fs-section fs-trace"
      aria-labelledby="trace-title"
    >
      <span id="processus" className="fs-anchor" />
      <div className="public-shell">
        <h2 id="trace-title">
          L’or circule. <span>Son histoire reste.</span>
        </h2>
        <p className="fs-section-subtitle">
          Comprendre le parcours de l’or et le rôle de chaque intervenant.
        </p>
        <ol className="fs-trace__steps">
          {fasoTraceability.map((item, index) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-pressed={selected === index}
                  aria-controls="trace-detail"
                  onClick={() => setSelected(index)}
                >
                  <span className="fs-trace__number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <Icon aria-hidden="true" />
                  <span>{item.title}</span>
                  <ChevronRight aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ol>
        <div
          id="trace-detail"
          className="fs-trace__detail"
          aria-live="polite"
          aria-atomic="true"
        >
          <figure>
            <picture>
              <source srcSet="/vitrine/origine-or.webp" type="image/webp" />
              <img
                src="/vitrine/origine-or.png"
                alt="Illustration générée : de l’or et les documents associés à son origine."
                width="1672"
                height="941"
                loading="lazy"
              />
            </picture>
            <figcaption>Illustration du suivi de l’or</figcaption>
          </figure>
          <div>
            <p className="fs-eyebrow">
              Étape {String(selected + 1).padStart(2, "0")} · {step.title}
            </p>
            <h3>{step.heading}</h3>
            <ul>
              {step.evidence.map((entry) => (
                <li key={entry}>
                  <Check aria-hidden="true" />
                  {entry}
                </li>
              ))}
            </ul>
          </div>
          <div className="fs-trace__explanation">
            <p>{step.description}</p>
            <span>
              <ShieldCheck aria-hidden="true" />
              Chaque intervenant agit dans son périmètre d’habilitation.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function NationalValueSection() {
  return (
    <section
      id="impact"
      className="fs-section fs-national"
      aria-labelledby="impact-title"
    >
      <span id="apropos" className="fs-anchor" />
      <div className="public-shell fs-national__layout">
        <div>
          <p className="fs-eyebrow">Au service de l’intérêt national</p>
          <h2 id="impact-title">
            La richesse du sous-sol. <br />
            <span>La valeur pour le pays.</span>
          </h2>
        </div>
        <div className="fs-national__benefits">
          {[
            {
              title: "Une filière mieux identifiée",
              text: "Une vision plus claire des acteurs, des flux et des zones de production.",
              icon: MapPin,
            },
            {
              title: "Des recettes mieux suivies",
              text: "Une information consolidée pour mieux suivre la mobilisation des ressources publiques.",
              icon: ReceiptText,
            },
            {
              title: "Des écarts plus visibles",
              text: "Des outils pour repérer les anomalies et renforcer les contrôles.",
              icon: ShieldCheck,
            },
            {
              title: "Une information consolidée",
              text: "Des données structurées pour éclairer les décisions publiques.",
              icon: BarChart3,
            },
          ].map(({ title, text, icon: Icon }) => (
            <article key={title}>
              <Icon aria-hidden="true" />
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function TrustSection() {
  return (
    <section
      id="securite"
      className="fs-section fs-trust"
      aria-labelledby="trust-title"
    >
      <div className="public-shell">
        <div className="fs-trust__heading">
          <h2 id="trust-title">
            Partager l’information. <br />
            <span>Préserver les responsabilités.</span>
          </h2>
          <Link to="/securite" className="fs-text-link">
            Notre cadre de protection
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
        <div className="fs-trust__columns">
          {[
            {
              title: "Accès maîtrisés",
              text: "Des droits adaptés à chaque institution et à son périmètre.",
              icon: Fingerprint,
            },
            {
              title: "Décisions historisées",
              text: "Des opérations et des validations suivies pour faciliter la relecture et la redevabilité.",
              icon: ShieldCheck,
            },
            {
              title: "Documents protégés",
              text: "Des pièces justificatives organisées avec un accès encadré.",
              icon: LockKeyhole,
            },
          ].map(({ title, text, icon: Icon }) => (
            <article key={title}>
              <Icon aria-hidden="true" />
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function InstitutionsSection() {
  return (
    <section className="fs-institutions" aria-labelledby="institutions-title">
      <div className="public-shell">
        <h2 id="institutions-title">
          Une plateforme au service des institutions et acteurs nationaux
        </h2>
        <ul>
          {[
            "Présidence du Faso",
            "Ministère des Finances",
            "Ministère des Mines",
            "SONASP",
            "BUMIGEB",
          ].map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default function PublicHomePage() {
  return (
    <div className="fs-home">
      <PageMetadata
        title="Faso SANAMA | Présidence du Faso"
        description="Plateforme nationale de traçabilité du secteur minier : acteurs, production, échanges et suivi des recettes publiques au Burkina Faso."
        openGraph={{
          type: "website",
          locale: "fr_BF",
          siteName: "Faso SANAMA",
        }}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Faso SANAMA",
          inLanguage: "fr",
          publisher: {
            "@type": "GovernmentOrganization",
            name: "Présidence du Faso",
          },
        }}
      />
      <FasoHero />
      <SectorIndicators />
      <PlatformSection />
      <ActorsSection />
      <TraceabilitySection />
      <NationalValueSection />
      <TrustSection />
      <InstitutionsSection />
      <section className="fs-section fs-final" aria-labelledby="final-title">
        <div className="public-shell fs-final__layout">
          <Gem aria-hidden="true" />
          <div>
            <p className="fs-eyebrow">Votre espace FASO SANAMA</p>
            <h2 id="final-title">
              Participez à une filière <br />
              connectée et responsable.
            </h2>
            <p>Retrouvez les outils et les dossiers de votre organisme.</p>
          </div>
          <div className="fs-final__actions">
            <Link to="/login" className="fs-button fs-button--gold">
              Accéder à mon espace
              <ArrowRight aria-hidden="true" />
            </Link>
            <Link to="/assistance" className="fs-text-link">
              Besoin d’accompagnement ?<ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
