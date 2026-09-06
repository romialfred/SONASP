import { useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown, ArrowRight, ArrowUpRight, BarChart3, Check, Fingerprint,
  Gem, Landmark, Layers3, LockKeyhole, MapPin, ShieldCheck, Waypoints,
} from 'lucide-react';
import { PageMetadata } from '../../components/seo/PageMetadata';
import { PortalAccessButton } from './PortalAccessButton';
import { fasoActors, fasoTraceability } from './fasoVitrineContent';
import './faso-vitrine.css';

function HeroSection() {
  return (
    <section className="fs-hero" aria-labelledby="fs-hero-title">
      <div className="public-shell fs-hero__grid">
        <div className="fs-hero__copy">
          <p className="fs-eyebrow"><span /> Une plateforme de la Présidence du Faso</p>
          <h1 id="fs-hero-title">Une filière connectée.<br />Une richesse <em>mieux maîtrisée.</em></h1>
          <p className="fs-hero__description">Faso SANAMA réunit les acteurs du secteur minier pour tracer la production, suivre les échanges et éclairer la décision publique.</p>
          <div className="fs-actions"><PortalAccessButton label="Accéder à mon espace" /><a className="fs-text-link" href="#acteurs">Découvrir les portails <ArrowDown aria-hidden="true" /></a></div>
          <p className="fs-hero__slogan">La performance minière au service du citoyen.</p>
        </div>
        <div className="fs-hero__visual">
          <picture>
            <source srcSet="/login-faso/mine-sunrise.avif" type="image/avif" />
            <img src="/login-faso/mine-sunrise.webp" alt="Paysage minier à ciel ouvert et pépites d’or à la lumière du soleil." width="1536" height="1024" {...{ fetchpriority: 'high' }} />
          </picture>
          <div className="fs-hero__visual-top"><span><MapPin aria-hidden="true" /> Burkina Faso</span><span>FASO SANAMA</span></div>
          <div className="fs-hero__visual-caption"><span>Du terrain à la décision</span><strong>La traçabilité comme<br />patrimoine commun.</strong></div>
          <div className="fs-connection"><div className="fs-connection__seal"><Landmark aria-hidden="true" /></div><div><small>Pilotage national</small><strong>Présidence du Faso</strong></div><div className="fs-connection__tags"><span>Acteurs</span><span>Opérations</span><span>Recettes</span></div></div>
        </div>
      </div>
      <div className="public-shell fs-hero__signature"><span>PLATEFORME NATIONALE DE TRAÇABILITÉ DU SECTEUR MINIER</span><span>Production <i /> Collecte et vente <i /> Impôts et taxes</span></div>
    </section>
  );
}

function PlatformSection() {
  return (
    <section className="fs-section fs-platform public-shell" id="plateforme" aria-labelledby="fs-platform-title">
      <div className="fs-section-heading"><div><p className="fs-eyebrow">Une ambition nationale</p><h2 id="fs-platform-title">Une même chaîne.<br /><em>Des responsabilités claires.</em></h2></div><p>Du site minier aux institutions publiques, Faso SANAMA relie les dossiers, les opérations et leurs justificatifs. Chaque acteur conserve son métier et intervient dans son périmètre.</p></div>
      <div className="fs-pillars">
        {[
          { number: '01', title: 'Tracer', icon: Waypoints, text: 'Retrouver l’origine, les mouvements et les transformations de la matière.' },
          { number: '02', title: 'Contrôler', icon: ShieldCheck, text: 'Rapprocher les quantités, les documents, les paiements et les obligations fiscales.' },
          { number: '03', title: 'Décider', icon: BarChart3, text: 'Consolider l’information pour orienter la supervision et le pilotage national.' },
        ].map(({ number, title, icon: Icon, text }) => <article key={title}><div><span>{number}</span><Icon aria-hidden="true" /></div><h3>{title}</h3><p>{text}</p></article>)}
      </div>
    </section>
  );
}

function ActorsSection() {
  const [selected, setSelected] = useState(0);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const actor = fasoActors[selected];
  const ActorIcon = actor.icon;
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? (index + 1) % fasoActors.length
      : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? (index - 1 + fasoActors.length) % fasoActors.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? fasoActors.length - 1 : null;
    if (next === null) return;
    event.preventDefault(); setSelected(next); tabs.current[next]?.focus();
  };
  return (
    <section className="fs-actors fs-section" id="acteurs" aria-labelledby="fs-actors-title">
      <div className="public-shell">
        <div className="fs-section-heading"><div><p className="fs-eyebrow">Les acteurs de Faso SANAMA</p><h2 id="fs-actors-title">Un espace pour chacun.<br /><em>Une continuité pour tous.</em></h2></div><p>Sélectionnez un acteur pour découvrir ses outils, ses responsabilités et sa contribution à la filière.</p></div>
        <div className="fs-actors__layout">
          <div className="fs-actor-tabs" role="tablist" aria-label="Acteurs de la plateforme" aria-orientation="vertical">
            {fasoActors.map((item, index) => { const Icon = item.icon; return <button key={item.id} ref={(element) => { tabs.current[index] = element; }} id={`acteur-${item.id}`} role="tab" type="button" aria-selected={selected === index} aria-controls="actor-panel" tabIndex={selected === index ? 0 : -1} onClick={() => setSelected(index)} onKeyDown={(event) => onKeyDown(event, index)}><Icon aria-hidden="true" /><span><strong>{item.label}</strong><small>{item.role}</small></span><ArrowUpRight aria-hidden="true" /></button>; })}
          </div>
          <div className="fs-actor-panel" role="tabpanel" id="actor-panel" aria-labelledby={`acteur-${actor.id}`} tabIndex={0}>
            <div className="fs-actor-panel__top"><span><ActorIcon aria-hidden="true" />{actor.role}</span><small>ESPACE MÉTIER</small></div>
            <h3>{actor.title}</h3><p>{actor.description}</p>
            <div className="fs-actor-modules">{actor.modules.map(({ title, description, icon: Icon }) => <article key={title}><span><Icon aria-hidden="true" /></span><div><h4>{title}</h4><p>{description}</p></div></article>)}</div>
            <div className="fs-actor-panel__outcome"><ShieldCheck aria-hidden="true" /><p>{actor.outcome}</p></div>
            <Link className="fs-text-link" to="/login">Rejoindre mon espace sécurisé <ArrowRight aria-hidden="true" /></Link>
          </div>
        </div>
        <p className="fs-access-note"><LockKeyhole aria-hidden="true" />Une connexion commune. Un accès déterminé par votre compte et vos habilitations.</p>
      </div>
    </section>
  );
}

function TraceabilitySection() {
  const [selected, setSelected] = useState(0);
  const step = fasoTraceability[selected];
  const Icon = step.icon;
  return (
    <section className="fs-section fs-trace public-shell" id="processus" aria-labelledby="fs-trace-title">
      <div className="fs-section-heading"><div><p className="fs-eyebrow">La chaîne de traçabilité</p><h2 id="fs-trace-title">L’or circule.<br /><em>Son histoire reste.</em></h2></div><p>Chaque étape apporte une pièce au dossier. Explorez la chaîne pour comprendre ce qui relie la matière, les acteurs et les transactions.</p></div>
      <ol className="fs-trace__steps">{fasoTraceability.map((item, index) => { const StepIcon = item.icon; return <li key={item.id}><button type="button" aria-pressed={selected === index} aria-controls="trace-detail" onClick={() => setSelected(index)}><span>{String(index + 1).padStart(2, '0')}<StepIcon aria-hidden="true" /></span><strong>{item.title}</strong></button></li>; })}</ol>
      <div className="fs-trace__detail" id="trace-detail" aria-live="polite"><div className="fs-trace__emblem"><Icon aria-hidden="true" /></div><div><p className="fs-eyebrow">{String(selected + 1).padStart(2, '0')} / {step.title}</p><h3>{step.heading}</h3><p>{step.description}</p></div><ul>{step.evidence.map((item) => <li key={item}><Check aria-hidden="true" />{item}</li>)}</ul></div>
      <p className="fs-trace__note">Les circuits industriel et artisanal suivent leurs propres règles. Leurs références et leurs justificatifs permettent une lecture nationale cohérente.</p>
    </section>
  );
}

function NationalValueSection() {
  return (
    <section className="fs-national" id="apropos" aria-labelledby="fs-national-title"><div className="public-shell fs-national__grid">
      <div><p className="fs-eyebrow">Au service de l’intérêt national</p><h2 id="fs-national-title">La richesse du sous-sol.<br /><em>La valeur pour le pays.</em></h2><p>La digitalisation rapproche l’activité minière de ses enjeux publics : formalisation, transparence, recettes et souveraineté de l’information.</p><a className="fs-text-link" href="#acteurs">Explorer les espaces métiers <ArrowRight aria-hidden="true" /></a></div>
      <div className="fs-national__benefits">{[
        { title: 'Une filière mieux identifiée', text: 'Des sites, des professionnels et des autorisations réunis dans des registres structurés.', icon: Fingerprint },
        { title: 'Des recettes mieux suivies', text: 'Un lien entre les transactions documentées, les obligations fiscales et leur recouvrement.', icon: BarChart3 },
        { title: 'Des écarts plus visibles', text: 'Le rapprochement des flux aide à repérer les incohérences et à orienter les contrôles.', icon: ShieldCheck },
        { title: 'Une information consolidée', text: 'Une lecture nationale accessible aux institutions selon leurs responsabilités.', icon: Landmark },
      ].map(({ title, text, icon: Icon }) => <article key={title}><Icon aria-hidden="true" /><div><h3>{title}</h3><p>{text}</p></div></article>)}</div>
    </div></section>
  );
}

function TrustSection() {
  return (
    <section className="fs-section public-shell fs-trust" id="securite" aria-labelledby="fs-trust-title"><div className="fs-section-heading"><div><p className="fs-eyebrow">Un cadre de confiance</p><h2 id="fs-trust-title">Partager l’information.<br /><em>Préserver les responsabilités.</em></h2></div><Link className="fs-text-link" to="/securite">Comprendre les protections <ArrowUpRight aria-hidden="true" /></Link></div>
      <div className="fs-trust__grid">{[
        { title: 'Accès maîtrisés', text: 'Authentification renforcée et droits adaptés à l’utilisateur, à son organisme et à son périmètre.', icon: LockKeyhole },
        { title: 'Décisions historisées', text: 'Des opérations et validations documentées pour faciliter le suivi et la relecture des dossiers.', icon: Layers3 },
        { title: 'Documents protégés', text: 'Des pièces justificatives consultables par les utilisateurs habilités, dans le contexte de leur dossier.', icon: ShieldCheck },
      ].map(({ title, text, icon: Icon }) => <article key={title}><Icon aria-hidden="true" /><h3>{title}</h3><p>{text}</p></article>)}</div>
    </section>
  );
}

function InstitutionsSection() {
  return <section className="fs-institutions public-shell" aria-label="Institutions du secteur minier"><p className="fs-eyebrow">Une filière, des institutions complémentaires</p><div>{[
    { name: 'Présidence du Faso', src: '/institutional/armoiries-burkina-faso.png' },
    { name: 'Ministère des Finances', src: '/institutional/armoiries-burkina-faso.png' },
    { name: 'Ministère chargé des Mines', src: '/institutional/armoiries-burkina-faso.png' },
    { name: 'SONASP', src: '/sonasp_logo.png' },
    { name: 'BUMIGEB', src: '/login-faso/bumigeb.png' },
  ].map(({ name, src }) => <figure key={name}><img src={src} alt="" loading="lazy" width="140" height="90" /><figcaption>{name}</figcaption></figure>)}</div></section>;
}

export default function PublicHomePage() {
  return <div className="fs-home">
    <PageMetadata title="Faso SANAMA | Présidence du Faso · Traçabilité du secteur minier" description="La plateforme de la Présidence du Faso qui relie sociétés minières, artisans, comptoirs, collecteurs, DGMG et DGI : production, traçabilité et suivi des recettes publiques." openGraph={{ type: 'website', locale: 'fr_BF', siteName: 'Faso SANAMA' }} structuredData={{ '@context': 'https://schema.org', '@type': 'WebSite', name: 'Faso SANAMA', inLanguage: 'fr', publisher: { '@type': 'GovernmentOrganization', name: 'Présidence du Faso' } }} />
    <HeroSection /><PlatformSection /><ActorsSection /><TraceabilitySection /><NationalValueSection /><TrustSection /><InstitutionsSection />
    <section className="fs-final"><div className="public-shell"><div><Gem aria-hidden="true" /><p className="fs-eyebrow">Votre espace Faso SANAMA</p><h2>Participez à une filière<br />connectée et responsable.</h2><p>Retrouvez les outils et les dossiers de votre organisme.</p></div><div className="fs-actions"><PortalAccessButton label="Accéder à mon espace" /><Link className="fs-text-link" to="/assistance">Besoin d’accompagnement ? <ArrowUpRight aria-hidden="true" /></Link></div></div></section>
  </div>;
}
