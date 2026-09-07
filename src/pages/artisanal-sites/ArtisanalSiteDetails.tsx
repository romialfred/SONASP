import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, CheckCircle2, FileCheck2, MapPin, Pencil, Pickaxe, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useArtisanalSiteData } from '@/hooks/useArtisanalSiteData';
import { canManageMiningRegistry } from '@/lib/miningRegistryAccess';
import { aeaExpiryDate, FORMALIZATION_LABELS, siteAeaState } from '@/lib/siteFormalization';
import { buildSiteInsights, explainSiteCompliance } from '@/services/artisanalSiteInsights';
import { siteAeaDocumentService } from '@/services/siteAeaDocumentService';
import { SitePhotoPreview } from '@/components/artisanal-sites/SitePhotoPreview';
import './artisanal-site-details.css';

const dateLabel = (value: string | null | undefined) => value && Number.isFinite(Date.parse(value))
  ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(value)) : 'Non renseignée';
const decimal = (value: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value);
const STATUS = { active: 'Actif', planned: 'Planifié', suspended: 'Suspendu' };
const TABS = [{ id: 'overview', label: 'Vue d’ensemble' }, { id: 'aea', label: 'AEA et documents' }, { id: 'compliance', label: 'Conformité' }] as const;

export default function ArtisanalSiteDetails() {
  const { siteId } = useParams();
  const { user } = useAuth();
  const contextKey = JSON.stringify([siteId, user?.id, user?.organization_id, user?.mining_company_id, user?.access_role_id, user?.role, user?.organization_type, user?.is_active, user?.access_portal_id, user?.access_portal_code, user?.actor_category_code, [...(user?.capabilities || [])].sort(), [...(user?.module_codes || [])].sort(), [...(user?.site_ids || [])].sort(), [...(user?.responsibilities || [])].sort(), [...(user?.module_domains || [])].sort(), user && 'account_type' in user ? user.account_type : undefined]);
  return <ArtisanalSiteDetailsContent key={contextKey} photoContext={contextKey} />;
}

function ArtisanalSiteDetailsContent({ photoContext }: { photoContext: string }) {
  const { siteId } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const { sites, productions, loading, error, refresh } = useArtisanalSiteData();
  const [tab, setTab] = useState<string>('overview');
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState(false);
  const site = !loading && !error ? sites.find(item => item.id === siteId) : undefined;
  const reference = useMemo(() => new Date(), [sites, productions]);
  const insight = useMemo(() => site ? buildSiteInsights([site], productions, reference)[0] : null, [site, productions, reference]);

  useEffect(() => { setTab('overview'); }, [siteId]);
  useEffect(() => {
    let current = true;
    setDocumentUrl(null); setDocumentError(false);
    if (site?.aea?.documentPath) siteAeaDocumentService.url(site.aea.documentPath)
      .then(url => { if (current) setDocumentUrl(url); }).catch(() => { if (current) setDocumentError(true); });
    return () => { current = false; };
  }, [site]);

  if (!site || !insight) return <NationalDashboardLayout><div className="site-detail">
    <Link to="/artisan-sites" className="site-detail-back"><ArrowLeft size={16} /> Retour aux sites</Link>
    <div className="site-detail-empty" role={error ? 'alert' : 'status'}>{loading ? 'Chargement de la fiche…' : error || 'Ce site est introuvable ou inaccessible.'}</div>
    {error && <button className="site-detail-button" onClick={refresh}>Réessayer</button>}
  </div></NationalDashboardLayout>;

  const explanation = explainSiteCompliance(site, insight.lastDeclaration, reference);
  const aeaState = siteAeaState(site);
  const score = explanation.score;
  const scoreTone = score === null ? 'pending' : score >= 80 ? 'good' : score >= 70 ? 'warning' : 'bad';

  return <NationalDashboardLayout><div className="site-detail">
    <Link to="/artisan-sites" className="site-detail-back"><ArrowLeft size={16} aria-hidden="true" /> Tous les sites artisanaux</Link>
    {Boolean(location.state?.saved) && <p className="site-detail-success" role="status"><CheckCircle2 size={18} aria-hidden="true" /> Le site et ses responsables ont été enregistrés.</p>}
    <header className="site-detail-header">
      <span className="site-detail-icon"><Pickaxe aria-hidden="true" /></span>
      <div className="site-detail-heading"><p className="site-detail-eyebrow">Référentiel des sites artisanaux · {site.code}</p><h1>{site.name}</h1>
        <p><MapPin size={15} aria-hidden="true" /> {site.locality} · {site.province} · {site.region}</p></div>
      <div className="site-detail-actions"><button className="site-detail-button" onClick={refresh} disabled={loading}><RefreshCw size={16} aria-hidden="true" /> Actualiser</button>
        {canManageMiningRegistry(user) && <Link className="site-detail-button is-primary" to={`/artisan-sites/${site.id}/modifier`}><Pencil size={16} aria-hidden="true" /> Modifier la fiche</Link>}</div>
    </header>
    <div className="site-detail-metrics">
      <article><small>Catégorie du site</small><strong>{FORMALIZATION_LABELS[site.formalization || 'unknown']}</strong><span className={`site-detail-badge is-${aeaState.tone}`}>{aeaState.label}</span></article>
      <article><small>Situation administrative</small><strong>{STATUS[site.status]}</strong><span>Type d’exploitation : artisanal</span></article>
      <article><small>Artisans / capacité</small><strong>{site.activeMiners} <em>/ {site.authorizedMiners}</em></strong><span>Effectif déclaré dans la fiche</span></article>
      <article><small>Indice opérationnel</small><strong>{score === null ? 'Non évalué' : `${score} / 100`}</strong><span>{score === null ? 'Site planifié' : score < 80 ? 'À surveiller' : 'Suivi satisfaisant'}</span></article>
    </div>
    <div className="site-detail-tabs" role="tablist" aria-label="Détails du site" onKeyDown={event => {
      const current = TABS.findIndex(item => item.id === tab);
      const index = event.key === 'ArrowRight' ? (current + 1) % TABS.length : event.key === 'ArrowLeft' ? (current + TABS.length - 1) % TABS.length : event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : -1;
      if (index >= 0) { event.preventDefault(); setTab(TABS[index].id); document.getElementById(`site-tab-${TABS[index].id}`)?.focus(); }
    }}>{TABS.map(item => <button key={item.id} id={`site-tab-${item.id}`} role="tab" aria-selected={tab === item.id} aria-controls={`site-panel-${item.id}`} tabIndex={tab === item.id ? 0 : -1} onClick={() => setTab(item.id)}>{item.label}</button>)}</div>

    <section role="tabpanel" id="site-panel-overview" aria-labelledby="site-tab-overview" hidden={tab !== 'overview'}>
      <div className="site-detail-grid">
        <article className="site-detail-card"><h2><MapPin size={20} aria-hidden="true" /> Localisation et exploitation</h2>
          <dl className="site-detail-data"><div><dt>Superficie</dt><dd>{decimal(site.areaHectares)} hectares</dd></div><div><dt>Coordonnées GPS</dt><dd>{site.latitude}, {site.longitude}</dd></div><div><dt>Profondeur moyenne</dt><dd>{decimal(site.averageHoleDepthMeters)} m</dd></div><div><dt>Produits autorisés</dt><dd>{site.authorizedChemicals.join(', ') || 'Non renseignés'}</dd></div><div><dt>Ventes d’or rattachées</dt><dd>{decimal(insight.productionKg)} kg</dd></div><div><dt>Dernière déclaration</dt><dd>{insight.lastDeclaration ? dateLabel(insight.lastDeclaration) : 'Aucune déclaration'}</dd></div></dl>
        </article>
        <article className="site-detail-card"><h2><Users size={20} aria-hidden="true" /> Responsables du site</h2>{[site.manager, site.collectionOfficer].map(contact => <div className="site-detail-contact" key={contact.role}><small>{contact.role === 'site_manager' ? 'Responsable du site' : 'Chargé de la collecte'}</small><strong>{contact.fullName || 'Non renseigné'}</strong><span>{contact.phone || 'Téléphone non renseigné'}</span>{contact.email && <span>{contact.email}</span>}</div>)}</article>
      </div>
      {site.photos.length > 0 && <article className="site-detail-card"><h2>Photos du site</h2><div className="site-detail-photos">{site.photos.map((reference, index) => <SitePhotoPreview key={`${reference}:${index}`} reference={reference} label={`Photo ${index + 1} du site ${site.name}`} contextKey={photoContext} height={190} />)}</div></article>}
      {site.notes && <article className="site-detail-card"><h2>Observations</h2><p className="site-detail-notes">{site.notes}</p></article>}
      <p className="site-detail-footnote">Créé le {dateLabel(site.createdAt)} · Mis à jour le {dateLabel(site.updatedAt)}</p>
    </section>

    <section role="tabpanel" id="site-panel-aea" aria-labelledby="site-tab-aea" hidden={tab !== 'aea'}>
      <article className="site-detail-card"><h2><FileCheck2 size={21} aria-hidden="true" /> Attestation d’exploitation artisanale</h2>
        <span className={`site-detail-badge is-${aeaState.tone}`}>{aeaState.label}</span>
        {site.formalization === 'formalized' && site.aea ? <>
          <dl className="site-detail-data"><div><dt>Numéro de l’AEA</dt><dd>{site.aea.number}</dd></div><div><dt>Date d’émission</dt><dd>{dateLabel(site.aea.issuedOn)}</dd></div><div><dt>Durée de validité</dt><dd>{site.aea.durationMonths} mois</dd></div><div><dt>Date d’expiration</dt><dd>{dateLabel(aeaExpiryDate(site.aea.issuedOn, site.aea.durationMonths))}</dd></div></dl>
          <div className="site-detail-document"><FileCheck2 aria-hidden="true" /><div><strong>{site.aea.documentName || 'Justificatif AEA'}</strong><small>Document privé du dossier</small></div>{documentUrl && <a href={documentUrl} target="_blank" rel="noreferrer" className="site-detail-button">Consulter <ArrowUpRight size={16} aria-hidden="true" /></a>}</div>
          {documentError && <p role="alert">Le document est momentanément indisponible. Utilisez « Actualiser » pour réessayer.</p>}
        </> : <p className="site-detail-empty">{site.formalization === 'non_formalized' ? 'Ce site est enregistré comme non formalisé. Aucun justificatif AEA n’est associé à sa fiche.' : 'La catégorie et les références AEA doivent être renseignées dans la fiche du site.'}</p>}
        <p className="site-detail-footnote">La validité affichée est calculée à partir des dates saisies. Elle ne constitue pas une décision de validation du document.</p>
      </article>
    </section>

    <section role="tabpanel" id="site-panel-compliance" aria-labelledby="site-tab-compliance" hidden={tab !== 'compliance'}>
      <div className="site-compliance-layout"><aside className={`site-compliance-summary is-${scoreTone}`}><ShieldCheck size={28} aria-hidden="true" /><p>Indice de suivi opérationnel</p><strong>{score === null ? '—' : score}<small>{score === null ? 'Non évalué' : '/ 100'}</small></strong>
        <span>{score === null ? 'Le site est planifié' : score < 80 ? 'Site à surveiller' : 'Suivi satisfaisant'}</span>
        <p>{score === null ? 'L’évaluation démarre à la mise en activité du site. Les règles sont présentées ci-contre, sans application des pénalités.' : `100 − ${decimal(explanation.totalDeduction)} = ${score} points après arrondi et limitation entre 0 et 100.`}</p>
        <small>Calcul du {dateLabel(reference.toISOString())}</small></aside>
        <article className="site-detail-card site-compliance-rules"><h2>Comprendre le calcul</h2><p>Chaque règle utilise les données actuelles du site et sa dernière déclaration connue, indépendamment du filtre de période du tableau de bord.</p>
          <div className="site-rule-list">{explanation.rules.map((rule, index) => <div className="site-rule" key={rule.key}><span className="site-rule-number">0{index + 1}</span><div><h3>{rule.label}</h3><p>{rule.rule}</p><small>{rule.observed}</small></div><span className={`site-rule-points ${score !== null && rule.deduction > 0 ? 'is-deducted' : ''}`}>{score === null ? 'Non appliqué' : rule.deduction ? `−${decimal(rule.deduction)} pts` : '0 pt'}</span></div>)}</div>
          <div className="site-compliance-note"><ShieldCheck size={20} aria-hidden="true" /><p><strong>Seuil de surveillance : moins de 80 points.</strong><br />Cet indicateur décrit l’activité du site. La catégorie de formalisation et la validité de l’AEA sont consultables dans l’onglet « AEA et documents » et n’ajoutent aucune pénalité à cette formule.</p></div>
        </article>
      </div>
      <article className="site-detail-card"><h2>Compléter le suivi du site</h2>
        <ol className="site-compliance-steps"><li>La DGMG ou l’administrateur complète la catégorie, la localisation et les responsables dans « Modifier la fiche ». Pour un site formalisé, les références et le justificatif AEA sont obligatoires.</li><li>Lorsque l’exploitation démarre réellement, le statut administratif du site passe à « Actif » dans la fiche.</li><li>Les artisans sont rattachés au site dans leur fiche. Leurs ventes d’or déclarées alimentent la production et la date de dernière déclaration.</li><li>L’indice est recalculé automatiquement à partir de ces données. Il ne nécessite aucune saisie manuelle de pourcentage.</li></ol>
      </article>
    </section>
  </div></NationalDashboardLayout>;
}
