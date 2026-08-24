import {
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Building2,
  CalendarClock,
  Check,
  Compass,
  HelpCircle,
  Factory,
  FileKey2,
  FileSignature,
  FlaskConical,
  Gem,
  Globe2,
  Landmark,
  LifeBuoy,
  Pickaxe,
  RefreshCcw,
  ReceiptText,
  RotateCcw,
  Scale,
  ShieldCheck,
  Ship,
  Truck,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageMetadata } from '../../components/seo/PageMetadata';
import {
  AccessibleButton,
  MinePortalPreview,
  PaymentPreview,
  PortalContractPreview,
  PublicIcon,
  ResponsiveImage,
  SectionHeading,
} from './PublicComponents';
import { usePublicLocale } from './PublicLocaleContext';
import { PublicProcessWorkflow } from './PublicProcessWorkflow';
import { loadPublicNews, type PublicNewsItem } from './publicNews';
import './public-site.css';

function HeroSection() {
  const { content, locale } = usePublicLocale();
  const titleLines = locale === 'fr'
    ? ['L’or du Burkina,', 'collecté et valorisé', 'dans un cadre souverain.']
    : ['Burkina Faso’s gold,', 'collected and valued', 'within a sovereign framework.'];

  return (
    <section className="public-hero" aria-labelledby="public-hero-title">
      <ResponsiveImage
        className="public-hero__photo"
        alt={locale === 'fr'
          ? 'Professionnels équipés observant les opérations d’une mine à ciel ouvert en Afrique de l’Ouest.'
          : 'Equipped professionals overlooking an open-pit mining operation in West Africa.'}
        eager
      />
      <div className="public-hero__wash" aria-hidden="true" />
      <div className="public-hero__diagonal" aria-hidden="true" />
      <div className="public-shell public-hero__inner">
        <div className="public-hero__content">
          <div className="public-kicker">{content.hero.eyebrow}</div>
          <h1 id="public-hero-title" aria-label={titleLines.join(' ')}>
            {titleLines.map((line, index) => (
              <span key={line}>{index > 0 ? ` ${line}` : line}</span>
            ))}
          </h1>
          <p>{content.hero.description}</p>
          <div className="public-hero__actions">
            <AccessibleButton to="/portail-mine">
              {content.hero.primary}<ArrowRight aria-hidden="true" />
            </AccessibleButton>
            <a className="public-button public-button--secondary" href="#plateforme">
              <Compass aria-hidden="true" />{content.hero.secondary}
            </a>
          </div>
          <div className="public-hero__trust" aria-label={locale === 'fr' ? 'Engagements de la plateforme' : 'Platform commitments'}>
            <ShieldCheck aria-hidden="true" />
            {content.hero.reassurance.map((item, index) => (
              <span key={item}>
                {index > 0 && <i aria-hidden="true">•</i>}
                {item}
              </span>
            ))}
          </div>
          <div className="public-hero-flow" aria-label={locale === 'fr' ? 'Flux Mine, SONASP, Marché' : 'Mine, SONASP, Market flow'}>
            <div><span><Pickaxe aria-hidden="true" /></span><strong>Mine</strong></div>
            <i aria-hidden="true"><ArrowRight /></i>
            <div><span><Landmark aria-hidden="true" /></span><strong>SONASP</strong></div>
            <i aria-hidden="true"><ArrowRight /></i>
            <div><span><Globe2 aria-hidden="true" /></span><strong>{locale === 'fr' ? 'Marché' : 'Market'}</strong></div>
          </div>
        </div>
        <div className="public-hero__showcase">
          <MinePortalPreview />
        </div>
      </div>
    </section>
  );
}

function ValueChainSection() {
  const { content } = usePublicLocale();
  return (
    <section className="public-section public-value-chain" id="plateforme">
      <div className="public-shell">
        <div className="public-value-chain__heading">
          <h2>{content.valueChain.title}</h2>
          <span aria-hidden="true" />
        </div>
        <div className="public-value-chain__grid">
          {content.valueChain.items.map((item) => (
            <article className="public-capability" key={item.title}>
              <div className="public-capability__icon"><PublicIcon name={item.icon} /></div>
              <div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function MinePortalSection() {
  const { content, locale } = usePublicLocale();
  const familyIcons = [Truck, FileKey2, Banknote, ShieldCheck];
  const familyItemIcons = [
    [CalendarClock, FileSignature, FlaskConical, Ship],
    [FileSignature, CalendarClock, FileKey2, RefreshCcw],
    [Building2, ReceiptText, Banknote, Scale],
    [Building2, ShieldCheck, FileKey2, RefreshCcw],
  ];
  const familyIntroductions = locale === 'fr'
    ? [
        'Prévisions, contrôle et départ de la production.',
        'Contrats et échéances réunis dans un même espace.',
        'Achats, factures et règlements, au même endroit.',
        'Dossiers partagés avec les interlocuteurs autorisés.',
      ]
    : [
        'Prepare, check and ship production.',
        'Mine and SONASP commitments gathered in one place.',
        'A clear view of purchases, invoices and settlements.',
        'Useful records shared with the right contacts.',
      ];
  return (
    <section className="public-section public-portal-section" id="espace-mines">
      <div className="public-shell">
        <div className="public-portal-section__intro">
          <SectionHeading eyebrow={content.portal.eyebrow} title={content.portal.title} description={content.portal.description} />
          <AccessibleButton to="/portail-mine" variant="outline">
            {content.portal.cta}<ArrowRight aria-hidden="true" />
          </AccessibleButton>
        </div>
        <div className="public-portal-section__layout">
          <div className="public-portal-section__preview"><MinePortalPreview compact /></div>
          <div className="public-feature-families">
            {content.portal.families.map((family, index) => {
              const FamilyIcon = familyIcons[index] ?? ShieldCheck;
              const itemIcons = familyItemIcons[index] ?? [];
              return (
              <article className={`public-feature-family public-feature-family--${index + 1}`} key={family.title}>
                <header className="public-feature-family__header">
                  <div className="public-feature-family__icon"><FamilyIcon aria-hidden="true" /></div>
                  <div>
                    <h3>{family.title}</h3>
                    <p>{familyIntroductions[index]}</p>
                  </div>
                </header>
                <div className="public-feature-family__items" role="list">
                  {family.items.map((item, itemIndex) => {
                    const ItemIcon = itemIcons[itemIndex] ?? ArrowRight;
                    return (
                      <div className="public-feature-family__item" role="listitem" key={item}>
                        <span className="public-feature-family__item-icon"><ItemIcon aria-hidden="true" /></span>
                        <span>{item}</span>
                      </div>
                    );
                  })}
                </div>
              </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProcessTimeline() {
  return <PublicProcessWorkflow />;
}

function ContractsSection() {
  const { content, locale } = usePublicLocale();
  const engagementIcons = [FileSignature, Scale, CalendarClock, ShieldCheck, RotateCcw];
  const engagementLabels = locale === 'fr'
    ? ['Cadre', 'Paramètres', 'Calendrier', 'Exceptions', 'Cycle de vie']
    : ['Framework', 'Parameters', 'Schedule', 'Exceptions', 'Lifecycle'];
  return (
    <section className="public-section public-contracts" id="engagements">
      <div className="public-shell">
        <div className="public-contracts__intro">
          <SectionHeading {...content.contracts} />
          <p className="public-contracts__promise">
            {locale === 'fr'
              ? 'Une lecture commune, du document signé jusqu’au rapprochement de chaque expédition.'
              : 'A shared view, from the signed document through to reconciliation of every shipment.'}
          </p>
        </div>

        <div className="public-contracts__layout">
          <div className="public-contracts__capabilities">
            {content.contracts.items.map((item, index) => {
              const Icon = engagementIcons[index] ?? FileSignature;
              return (
                <article key={item}>
                  <span className={`public-contracts__capability-icon public-contracts__capability-icon--${index + 1}`}>
                    <Icon aria-hidden="true" />
                  </span>
                  <div>
                    <small>{engagementLabels[index]}</small>
                    <h3>{item}</h3>
                  </div>
                  <ArrowRight aria-hidden="true" />
                </article>
              );
            })}
          </div>
          <PortalContractPreview locale={locale} />
        </div>
      </div>
    </section>
  );
}

function PaymentsSection() {
  const { content, locale } = usePublicLocale();
  const capabilityIcons = [ReceiptText, Banknote, Landmark, FileKey2, RefreshCcw];
  const capabilityLabels = locale === 'fr'
    ? ['Documents', 'Règlements', 'Coordonnées', 'Justificatifs', 'Audit']
    : ['Records', 'Settlements', 'Accounts', 'Evidence', 'Audit'];

  return (
    <section className="public-section public-payments" id="paiements">
      <div className="public-shell public-payments__layout">
        <PaymentPreview locale={locale} />
        <div className="public-payments__content">
          <SectionHeading {...content.payments} />
          <div className="public-payments__capabilities">
            {content.payments.items.map((item, index) => {
              const Icon = capabilityIcons[index] ?? FileKey2;
              return (
                <article className={`public-payments__capability public-payments__capability--${index + 1}`} key={item}>
                  <span><Icon aria-hidden="true" /></span>
                  <div><small>{capabilityLabels[index]}</small><h3>{item}</h3></div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function SecuritySection() {
  const { content, locale } = usePublicLocale();
  const categories = locale === 'fr'
    ? ['Identités', 'Audit', 'Échanges', 'Résilience']
    : ['Identities', 'Audit', 'Exchanges', 'Resilience'];
  const protectedAreas = locale === 'fr'
    ? ['Utilisateurs et périmètres', 'Décisions et validations', 'Documents et transmissions', 'Services essentiels']
    : ['Users and scopes', 'Decisions and approvals', 'Records and transmissions', 'Essential services'];

  return (
    <section className="public-section public-security" id="securite">
      <div className="public-shell">
        <div className="public-security__heading">
          <SectionHeading {...content.security} />
          <div className="public-security__statement">
            <ShieldCheck aria-hidden="true" />
            <div>
              <strong>{locale === 'fr' ? 'Un socle commun de confiance' : 'A shared trust foundation'}</strong>
              <p>{locale === 'fr'
                ? 'Les contrôles couvrent l’accès, l’action, le document et la continuité de service.'
                : 'Controls cover access, action, records and service continuity.'}</p>
            </div>
          </div>
        </div>
        <div className="public-security__grid">
          {content.security.items.map((item, index) => (
            <article className={`public-security-card public-security-card--${index + 1}`} key={item.title}>
              <div className="public-security-card__top">
                <span><PublicIcon name={item.icon} /></span>
                <small>{categories[index]}</small>
              </div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <div className="public-security-card__scope">
                <ShieldCheck aria-hidden="true" />
                <span><small>{locale === 'fr' ? 'Protège' : 'Protects'}</small><strong>{protectedAreas[index]}</strong></span>
              </div>
            </article>
          ))}
        </div>
        <aside id="security-guarantees-note" className="public-security__note" aria-label={locale === 'fr' ? 'Précision sur les garanties' : 'Safeguards clarification'}>
          <span><FileKey2 aria-hidden="true" /></span>
          <div>
            <strong>{locale === 'fr' ? 'À propos de ces garanties' : 'About these safeguards'}</strong>
            <p>{locale === 'fr'
              ? 'Les garanties présentées décrivent les contrôles prévus par la plateforme. Elles ne constituent ni une certification, ni une promesse de conformité à un référentiel qui n’aurait pas été officiellement audité.'
              : 'The safeguards shown describe planned platform controls. They do not constitute a certification or a compliance claim against a framework that has not been formally audited.'}</p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function BenefitsSection() {
  const { content, locale } = usePublicLocale();
  const panels = [
    { title: content.benefits.minesTitle, description: content.benefits.minesDescription, items: content.benefits.minesItems, label: locale === 'fr' ? 'Pour les mines' : 'For mining companies', icon: Factory },
    { title: content.benefits.stateTitle, description: content.benefits.stateDescription, items: content.benefits.stateItems, label: locale === 'fr' ? 'Pour l’État' : 'For public institutions', icon: Landmark },
  ];
  return (
    <section className="public-benefits" id="apropos">
      <div className="public-shell public-benefits__grid">
        {panels.map(({ title, description, items, label, icon: Icon }, index) => (
          <article className={index === 1 ? 'public-benefit public-benefit--state' : 'public-benefit'} key={title}>
            <div className="public-benefit__label"><Icon aria-hidden="true" />{label}</div>
            <h2>{title}</h2>
            <p>{description}</p>
            <ul>{items.map((item) => <li key={item}><Check aria-hidden="true" />{item}</li>)}</ul>
          </article>
        ))}
      </div>
    </section>
  );
}

function StakeholdersSection() {
  const { content, locale } = usePublicLocale();
  const [activeActorId, setActiveActorId] = useState('sonasp');
  const producers = [
    {
      id: 'industrial',
      title: content.ecosystem.actors[0],
      role: locale === 'fr' ? 'Volumes, déclarations et engagements industriels.' : 'Industrial volumes, declarations and commitments.',
      movement: locale === 'fr' ? 'Vers la SONASP' : 'To SONASP',
      icon: Factory,
    },
    {
      id: 'semi-mechanized',
      title: content.ecosystem.actors[1],
      role: locale === 'fr' ? 'Production encadrée et expéditions planifiées.' : 'Structured production and scheduled shipments.',
      movement: locale === 'fr' ? 'Vers la SONASP' : 'To SONASP',
      icon: Building2,
    },
    {
      id: 'artisanal',
      title: content.ecosystem.actors[2],
      role: locale === 'fr' ? 'Production artisanale intégrée au circuit national.' : 'Artisanal production connected to the national channel.',
      movement: locale === 'fr' ? 'Vers la SONASP' : 'To SONASP',
      icon: Gem,
    },
  ];
  const supportActors = [
    {
      id: 'laboratories',
      title: content.ecosystem.actors[3],
      role: locale === 'fr' ? 'Analyses, teneur et conformité de la matière.' : 'Assays, grade and material conformity.',
      movement: locale === 'fr' ? 'Contrôle technique' : 'Technical control',
      icon: FlaskConical,
    },
    {
      id: 'logistics',
      title: content.ecosystem.actors[4],
      role: locale === 'fr' ? 'Transport sécurisé et continuité de la chaîne de garde.' : 'Secure transport and custody-chain continuity.',
      movement: locale === 'fr' ? 'Chaîne de garde' : 'Custody chain',
      icon: Truck,
    },
    {
      id: 'customs',
      title: content.ecosystem.actors[5],
      role: locale === 'fr' ? 'Contrôles documentaires et formalités de sortie.' : 'Document controls and outbound formalities.',
      movement: locale === 'fr' ? 'Contrôle de sortie' : 'Outbound control',
      icon: Scale,
    },
    {
      id: 'finance',
      title: content.ecosystem.actors[7],
      role: locale === 'fr' ? 'Règlements, preuves et rapprochement financier.' : 'Settlements, evidence and financial reconciliation.',
      movement: locale === 'fr' ? 'Flux financiers' : 'Financial flows',
      icon: Banknote,
    },
    {
      id: 'institutions',
      title: content.ecosystem.actors[8],
      role: locale === 'fr' ? 'Supervision publique et vision consolidée.' : 'Public oversight and consolidated insight.',
      movement: locale === 'fr' ? 'Supervision nationale' : 'National oversight',
      icon: Landmark,
    },
  ];
  const sonaspActor = {
    id: 'sonasp',
    title: 'SONASP',
    role: locale === 'fr'
      ? 'Centralise les flux autorisés, sécurise les contrôles et organise l’accès de la production nationale aux débouchés internationaux.'
      : 'Centralizes authorized flows, secures controls and organizes access from national production to international outlets.',
    movement: locale === 'fr' ? 'Pivot national' : 'National hub',
    icon: ShieldCheck,
  };
  const internationalActor = {
    id: 'international',
    title: locale === 'fr' ? 'Marchés internationaux' : 'International markets',
    role: locale === 'fr'
      ? 'Raffineries et débouchés internationaux reçoivent des flux contrôlés et documentés.'
      : 'Refineries and international outlets receive controlled, documented flows.',
    movement: locale === 'fr' ? 'Depuis la SONASP' : 'From SONASP',
    icon: Globe2,
  };
  const actors = [sonaspActor, ...producers, ...supportActors, internationalActor];
  const activeActor = actors.find((actor) => actor.id === activeActorId) ?? sonaspActor;
  const ActiveActorIcon = activeActor.icon;
  const activateActor = (actorId: string) => setActiveActorId(actorId);

  return (
    <section className="public-section public-ecosystem" id="ecosysteme">
      <div className="public-shell">
        <div className="public-ecosystem__heading">
          <SectionHeading {...content.ecosystem} />
          <div className="public-ecosystem__heading-note">
            <Globe2 aria-hidden="true" />
            <p>{locale === 'fr'
              ? 'Une continuité institutionnelle, de la première déclaration jusqu’à la sortie vers l’international.'
              : 'Institutional continuity from the first declaration through to international market access.'}</p>
          </div>
        </div>

        <div className="public-ecosystem__gateway" aria-label={locale === 'fr' ? 'Parcours de la production nationale vers les marchés internationaux' : 'National production journey to international markets'}>
          <div className="public-ecosystem__main-flow">
            <section className="public-ecosystem__origin" aria-labelledby="public-ecosystem-origin-title">
              <header>
                <span>{locale === 'fr' ? 'Origine' : 'Origin'}</span>
                <h3 id="public-ecosystem-origin-title">{locale === 'fr' ? 'Production nationale' : 'National production'}</h3>
                <p>{locale === 'fr' ? 'Les flux miniers entrent dans un cadre commun.' : 'Mining flows enter a shared framework.'}</p>
              </header>
              <div className="public-ecosystem__producer-list">
                {producers.map(({ id, title, role, icon: Icon }) => (
                  <button
                    type="button"
                    className={activeActorId === id ? 'is-active' : ''}
                    key={id}
                    onMouseEnter={() => activateActor(id)}
                    onFocus={() => activateActor(id)}
                    onClick={() => activateActor(id)}
                    aria-pressed={activeActorId === id}
                  >
                    <span><Icon aria-hidden="true" /></span>
                    <span><strong>{title}</strong><small>{role}</small></span>
                    <ArrowRight aria-hidden="true" />
                  </button>
                ))}
              </div>
            </section>

            <div className="public-ecosystem__connector public-ecosystem__connector--inbound" aria-hidden="true">
              <span /><ArrowRight />
            </div>

            <article className="public-ecosystem__hub" aria-label={locale === 'fr' ? 'SONASP, pivot national' : 'SONASP, national hub'}>
              <div className="public-ecosystem__hub-orbit" aria-hidden="true"><i /><i /><i /></div>
              <div className="public-ecosystem__hub-badge"><ShieldCheck aria-hidden="true" />{locale === 'fr' ? 'Mandat central' : 'Central mandate'}</div>
              <img src="/SONASP v2.png" alt="SONASP" width="621" height="211" loading="lazy" />
              <h3>{locale === 'fr' ? 'Pivot de la chaîne nationale' : 'National value-chain hub'}</h3>
              <p>{locale === 'fr'
                ? 'La SONASP consolide, contrôle et oriente les flux avant leur accès aux débouchés internationaux.'
                : 'SONASP consolidates, controls and directs flows before they reach international outlets.'}</p>
              <div className="public-ecosystem__hub-roles">
                <span><Building2 aria-hidden="true" />{locale === 'fr' ? 'Consolider' : 'Consolidate'}</span>
                <span><ShieldCheck aria-hidden="true" />{locale === 'fr' ? 'Sécuriser' : 'Secure'}</span>
                <span><Globe2 aria-hidden="true" />{locale === 'fr' ? 'Ouvrir l’accès' : 'Open access'}</span>
              </div>
              <button
                type="button"
                className={activeActorId === 'sonasp' ? 'is-active' : ''}
                onMouseEnter={() => activateActor('sonasp')}
                onFocus={() => activateActor('sonasp')}
                onClick={() => activateActor('sonasp')}
                aria-pressed={activeActorId === 'sonasp'}
              >
                <Globe2 aria-hidden="true" />
                {locale === 'fr' ? 'Porte institutionnelle vers l’international' : 'Institutional gateway to international markets'}
                <ArrowUpRight aria-hidden="true" />
              </button>
            </article>

            <div className="public-ecosystem__connector public-ecosystem__connector--outbound" aria-hidden="true">
              <span /><ArrowRight />
            </div>

            <button
              type="button"
              className={`public-ecosystem__destination${activeActorId === 'international' ? ' is-active' : ''}`}
              onMouseEnter={() => activateActor('international')}
              onFocus={() => activateActor('international')}
              onClick={() => activateActor('international')}
              aria-pressed={activeActorId === 'international'}
            >
              <span className="public-ecosystem__destination-kicker">{locale === 'fr' ? 'Porte de sortie' : 'Outbound gateway'}</span>
              <span className="public-ecosystem__destination-icon"><Ship aria-hidden="true" /></span>
              <strong>{locale === 'fr' ? 'Marchés internationaux' : 'International markets'}</strong>
              <small>{locale === 'fr' ? 'Raffineries et débouchés internationaux' : 'Refineries and international outlets'}</small>
              <span className="public-ecosystem__destination-status"><ArrowUpRight aria-hidden="true" />{locale === 'fr' ? 'Flux validés par la SONASP' : 'Flows validated by SONASP'}</span>
            </button>
          </div>

          <section className="public-ecosystem__support" aria-labelledby="public-ecosystem-support-title">
            <div className="public-ecosystem__support-heading">
              <span>{locale === 'fr' ? 'Couche d’appui' : 'Support layer'}</span>
              <h3 id="public-ecosystem-support-title">{locale === 'fr' ? 'Les fonctions qui sécurisent le passage' : 'Functions that secure the journey'}</h3>
            </div>
            <div className="public-ecosystem__support-grid">
              {supportActors.map(({ id, title, movement, icon: Icon }) => (
                <button
                  type="button"
                  className={activeActorId === id ? 'is-active' : ''}
                  key={id}
                  onMouseEnter={() => activateActor(id)}
                  onFocus={() => activateActor(id)}
                  onClick={() => activateActor(id)}
                  aria-pressed={activeActorId === id}
                >
                  <span><Icon aria-hidden="true" /></span>
                  <span><strong>{title}</strong><small>{movement}</small></span>
                </button>
              ))}
            </div>
          </section>

          <div className="public-ecosystem__active-link" aria-live="polite">
            <span className="public-ecosystem__active-link-icon"><ActiveActorIcon aria-hidden="true" /></span>
            <div>
              <small>{locale === 'fr' ? 'Liaison sélectionnée' : 'Selected connection'}</small>
              <strong>{activeActor.title}</strong>
              <p>{activeActor.role}</p>
            </div>
            <span className="public-ecosystem__active-link-route">{activeActor.movement}<ArrowRight aria-hidden="true" /></span>
          </div>
        </div>
      </div>
    </section>
  );
}

function NewsSection() {
  const { content, locale } = usePublicLocale();
  const [items, setItems] = useState<PublicNewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    loadPublicNews(controller.signal)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  return (
    <section className="public-section public-news" id="actualites">
      <div className="public-shell">
        <div className="public-news__heading">
          <SectionHeading {...content.news} />
          <Link className="public-text-link" to="/actualites">{content.news.all}<ArrowRight aria-hidden="true" /></Link>
        </div>
        {loading ? (
          <p className="public-empty-state" role="status">{content.news.loading}</p>
        ) : items.length === 0 ? (
          <p className="public-empty-state">{content.news.empty}</p>
        ) : (
          <div className="public-news__grid">
            {items.slice(0, 3).map((item) => (
              <article className="public-news-card" key={item.id}>
                <span>{item.category}</span>
                <time dateTime={item.published_at}>{new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(item.published_at))}</time>
                <h3><Link to={`/actualites/${item.slug}`}>{item.title}</Link></h3>
                <p>{item.summary}</p>
                <Link to={`/actualites/${item.slug}`}>Lire la publication<ArrowRight aria-hidden="true" /></Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function AssistanceSection() {
  const { content } = usePublicLocale();
  const items = [
    { title: content.assistance.help, to: '/assistance', icon: HelpCircle },
    { title: content.assistance.password, to: '/recuperer-acces', icon: RefreshCcw },
    { title: content.assistance.incident, to: '/assistance#incident', icon: LifeBuoy },
  ];
  return (
    <section className="public-section public-assistance" id="assistance">
      <div className="public-shell public-assistance__grid">
        <SectionHeading {...content.assistance} />
        <div className="public-assistance__links">
          {items.map(({ title, to, icon: Icon }) => (
            <Link key={title} to={to}><Icon aria-hidden="true" /><span>{title}</span><ArrowRight aria-hidden="true" /></Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCallToAction() {
  const { content } = usePublicLocale();
  return (
    <section className="public-final-cta">
      <div className="public-shell public-final-cta__inner">
        <div><span>Portail Mine</span><h2>{content.finalCta.title}</h2><p>{content.finalCta.description}</p></div>
        <div className="public-final-cta__actions">
          <AccessibleButton to="/portail-mine">{content.finalCta.portal}<ArrowRight aria-hidden="true" /></AccessibleButton>
          <AccessibleButton to="/assistance" variant="secondary">{content.finalCta.assistance}</AccessibleButton>
        </div>
      </div>
    </section>
  );
}

export default function PublicHomePage() {
  return (
    <>
      <PageMetadata
        title="Plateforme nationale de collecte et de vente de l’or | SONASP"
        description="La plateforme sécurisée de la SONASP dédiée à la collecte, aux achats, aux ventes et au suivi des opérations aurifères au Burkina Faso."
        openGraph={{ type: 'website', locale: 'fr_BF', siteName: 'SONASP' }}
        twitter={{ card: 'summary_large_image' }}
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Société Nationale des Substances Précieuses',
          alternateName: 'SONASP',
          areaServed: { '@type': 'Country', name: 'Burkina Faso' },
        }}
      />
      <HeroSection />
      <ValueChainSection />
      <MinePortalSection />
      <ProcessTimeline />
      <ContractsSection />
      <PaymentsSection />
      <SecuritySection />
      <BenefitsSection />
      <StakeholdersSection />
      <NewsSection />
      <AssistanceSection />
      <FinalCallToAction />
    </>
  );
}
