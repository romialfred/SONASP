import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Banknote, CalendarDays, Check, CheckCircle2, ChevronDown, CircleDollarSign, Clock3, Download, FileText, FlaskConical, History, Info, Landmark, LockKeyhole, RefreshCw, Search, ShieldCheck, Truck, UserRound, Wallet, XCircle, type LucideIcon } from 'lucide-react';
import { Badge, Breadcrumb } from '@/components/ui/sn';
import { LIBELLES_ETAPES, ETAPES_DOSSIER, type DocumentDossier, type EvenementDossier } from '@/services/dossierService';
import { paymentDocumentLocation, paymentDocuments, type InternationalPaymentDetail } from '@/services/internationalPaymentDetailService';
import { currentPaymentProof, detailDate, detailStatus, paymentFinance, paymentHistory, paymentOverviewTimeline, paymentReference } from './internationalPaymentDetail';
import { paymentAmount, paymentMoney } from './internationalPaymentsList';
import './international-payment-detail.css';

interface Props {
  detail: InternationalPaymentDetail;
  refreshing?: boolean;
  onRefresh: () => void;
  onDownload: (document: DocumentDossier) => Promise<void>;
}
type Tab = 'overview' | 'details' | 'reconciliation' | 'documents' | 'history';
const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Aperçu', icon: CircleDollarSign }, { id: 'details', label: 'Détails du paiement', icon: FileText },
  { id: 'reconciliation', label: 'Réconciliation', icon: RefreshCw }, { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'history', label: 'Historique', icon: History },
];
function Panel({ title, icon: Icon, children, action, className = '' }: { title: string; icon: LucideIcon; children: ReactNode; action?: ReactNode; className?: string }) {
  return <section className={`ipd-panel ${className}`} aria-label={title}><header><span className="ipd-panel__icon"><Icon aria-hidden="true" /></span><h2>{title}</h2>{action}</header><div className="ipd-panel__body">{children}</div></section>;
}
function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return <dl className="ipd-facts">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value === null || value === undefined || value === '' ? 'Non renseigné' : value}</dd></div>)}</dl>;
}
const scalar = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : 'Non renseigné';
const conciliationStatus: Record<string, string> = { brouillon: 'Brouillon', en_attente: 'En attente', analyse_recue: 'Analyse reçue', soumise: 'Soumise', validee: 'Validée', rejetee: 'Rejetée', facture_definitive_generee: 'Facture définitive générée', cloturee: 'Clôturée' };
function Empty({ children }: { children: ReactNode }) { return <p className="ipd-empty">{children}</p>; }
function Timeline({ events, compact = false }: { events: EvenementDossier[]; compact?: boolean }) {
  if (!events.length) return <Empty>Aucun événement enregistré pour cette sélection.</Empty>;
  return <ol className={`ipd-timeline${compact ? ' ipd-timeline--compact' : ''}`}>{events.map((event, index) => <li key={`${event.etape}-${event.date}-${index}`}>
    <span className="ipd-timeline__dot" aria-hidden="true" />
    <div>{!compact && <span className="ipd-eyebrow">{LIBELLES_ETAPES[event.etape] || event.etape}</span>}<strong>{event.titre}</strong>{event.detail && <p>{event.detail}</p>}{!compact && event.acteur && <p className="ipd-timeline__actor">{event.acteur}</p>}</div>
    <time dateTime={event.date || undefined}>{detailDate(event.date, !compact)}</time>
  </li>)}</ol>;
}
function PageControls({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
  if (total <= 20) return null;
  const count = Math.ceil(total / 20);
  return <nav className="ipd-pagination" aria-label="Pagination"><button className="sn-btn" disabled={page === 1} onClick={() => onPage(page - 1)}>Précédent</button><span>{page} / {count}</span><button className="sn-btn" disabled={page >= count} onClick={() => onPage(page + 1)}>Suivant</button></nav>;
}

export function InternationalPaymentDetailView({ detail, refreshing, onRefresh, onDownload }: Props) {
  const { payment, sale, customerBank, receivingBank, actors, dossier } = detail;
  const customer = sale.customer;
  const finance = paymentFinance(detail);
  const status = detailStatus(payment);
  const documents = paymentDocuments(detail);
  const proof = currentPaymentProof(detail);
  const history = paymentHistory(detail);
  const [tab, setTab] = useState<Tab>('overview');
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const actionButton = useRef<HTMLButtonElement>(null);
  const [downloadId, setDownloadId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('');
  const [historyStage, setHistoryStage] = useState('');
  const [docPage, setDocPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  useEffect(() => {
    if (!actionsOpen) return;
    const close = (event: MouseEvent) => { if (!actionsRef.current?.contains(event.target as Node)) setActionsOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setActionsOpen(false); actionButton.current?.focus(); } };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape); };
  }, [actionsOpen]);
  const money = (value: number | null, currency = sale.currency) => paymentMoney(value, currency || '');
  const actor = (id: string | null) => id ? actors[id] || 'Utilisateur non disponible' : 'Non renseigné';
  const selectTab = (id: Tab) => { setTab(id); setActionsOpen(false); };
  async function download(doc: DocumentDossier) {
    setDownloadError(null); setDownloadId(`${doc.source}:${doc.id}`);
    try { await onDownload(doc); } catch { setDownloadError('Le téléchargement a échoué. Réessayez ou vérifiez votre accès au document.'); }
    finally { setDownloadId(null); }
  }
  const documentCards = (items: DocumentDossier[]) => <div className="ipd-documents">{items.map((doc) => {
    const key = `${doc.source}:${doc.id}`;
    const downloadable = Boolean(paymentDocumentLocation(doc));
    const format = doc.type_mime?.split('/').pop()?.toUpperCase().replace('VND.OPENXMLFORMATS-OFFICEDOCUMENT.SPREADSHEETML.SHEET', 'XLSX');
    return <article key={key} className="ipd-document"><span className={`ipd-document__icon ${doc.etape === 'paiement' ? 'is-green' : ''}`}><FileText aria-hidden="true" /></span><div><strong>{doc.nom || doc.reference || 'Document sans intitulé'}</strong><p>{LIBELLES_ETAPES[doc.etape] || doc.etape} · {detailDate(doc.date)}</p><small>{[format, doc.taille ? `${Math.ceil(doc.taille / 1024)} Ko` : null, doc.version ? `v${doc.version}` : null].filter(Boolean).join(' · ') || (downloadable ? 'Fichier privé' : 'Référence documentaire')}</small></div><button type="button" className="ipd-icon-button" aria-label={`Télécharger ${doc.nom || 'le document'}`} disabled={!downloadable || downloadId !== null} title={downloadable ? 'Télécharger le fichier privé' : 'Référence sans fichier téléchargeable'} onClick={() => { void download(doc); }}><Download aria-hidden="true" /></button></article>;
  })}</div>;
  const amountConfirmed = status.label === 'Payé';
  const financePanel = <Panel title="Aperçu financier" icon={Banknote}>
    <div className="ipd-financial"><div className="ipd-donut" role="img" aria-label={finance.share === null ? 'Part de ce paiement indisponible' : `Ce paiement représente ${finance.share.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} % du montant de la vente`}>
      <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50" /><circle className="ipd-donut__value" cx="60" cy="60" r="50" pathLength="100" strokeDasharray={`${Math.min(100, Math.max(0, finance.share || 0))} 100`} /></svg>
      <div><strong>{finance.share === null ? '—' : `${finance.share.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`}</strong><span>de la vente<br />pour ce paiement</span></div></div>
      <div><Facts rows={[
        ['Montant total de la vente', money(paymentAmount(sale.final_proceeds))],
        ['Autres versements confirmés', money(finance.otherConfirmed)],
        ['Total encaissé confirmé', <span className="ipd-positive">{money(finance.confirmed)}</span>],
        ['Versements à rapprocher', money(finance.processing)],
        ['Solde restant dû', <strong className={finance.settled ? 'ipd-positive' : ''}>{money(finance.outstanding)}</strong>],
      ]} /><div className={`ipd-financial__note ${finance.settled ? 'ipd-positive' : ''}`}><Info aria-hidden="true" />{finance.settled ? 'Vente entièrement réglée' : finance.outstanding === null ? 'Solde indisponible : le registre des versements ne permet pas son calcul.' : finance.outstanding < 0 ? 'Excédent encaissé à vérifier' : 'Le solde est calculé après confirmation des versements.'}</div></div>
    </div>
  </Panel>;
  const clientPanel = <Panel title="Informations sur le client" icon={UserRound}><Facts rows={[
    ['Client', customer?.name], ['Email', customer?.email], ['Téléphone', customer?.phone], ['Pays', customer?.country],
  ]} /></Panel>;
  const bankPanel = <Panel title="Détails bancaires" icon={Landmark}><Facts rows={[
    ['Devise de règlement', payment.currency], ['Mode de paiement', payment.payment_method === 'bank_transfer' ? 'Virement bancaire' : payment.payment_method],
    ['Banque émettrice', customerBank?.bank_name || payment.bank_name], ['IBAN / compte émetteur', customerBank?.iban || customerBank?.account_number || payment.account_number],
    ['SWIFT / BIC', customerBank?.swift_code], ['Compte de réception', receivingBank?.account_name], ['Banque de réception', receivingBank?.bank_name],
  ]} /></Panel>;
  const extraPanel = <Panel title="Informations complémentaires" icon={FileText}><Facts rows={[
    ['Identifiant de transaction', payment.transaction_id], ['Facture', payment.invoice_number],
    ['Taux de change', payment.fx_rate === null ? 'Non renseigné' : payment.fx_rate.toLocaleString('fr-FR', { maximumFractionDigits: 8 })],
    ['Notes', payment.notes], ['Enregistré par', actor(payment.created_by)], ['Date de création', detailDate(payment.created_at, true)],
  ]} /></Panel>;
  const stageUnavailable = detail.unavailable.includes('dossier');
  const filteredDocuments = documents.filter((doc) => (!stage || doc.etape === stage) && `${doc.nom || ''} ${doc.reference || ''}`.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')));
  const filteredHistory = history.filter((event) => !historyStage || event.etape === historyStage);
  const effectiveDocPage = Math.min(docPage, Math.max(1, Math.ceil(filteredDocuments.length / 20)));
  const effectiveHistoryPage = Math.min(historyPage, Math.max(1, Math.ceil(filteredHistory.length / 20)));
  const stageOptions = ETAPES_DOSSIER.map((value) => <option key={value} value={value}>{LIBELLES_ETAPES[value]}</option>);
  const chain = dossier?.chaine;
  const fiscalAdjustments = dossier?.comptes?.taxes || [];
  const credits = dossier?.comptes?.avoirs || [];
  const process = [
    { name: 'Expédition', icon: Truck, references: chain?.expeditions?.map((item) => item.reference || item.id) },
    { name: 'Raffinage & analyse', icon: FlaskConical, references: chain?.analyses?.map((item) => item.reference || item.id) },
    { name: 'Conciliation', icon: RefreshCw, references: chain?.conciliation ? [chain.conciliation.reference || chain.conciliation.id] : [] },
    { name: 'Vente', icon: CircleDollarSign, references: [sale.sale_number] },
    { name: 'Paiement', icon: Wallet, references: [paymentReference(payment)] },
  ];
  const processRibbon = <ol className="ipd-process" aria-label="Traçabilité du dossier">{process.map(({ name, icon: Icon, references }) => <li key={name}><Icon aria-hidden="true" /><strong>{name}</strong><span>{references?.length ? references.join(' · ') : stageUnavailable ? 'Indisponible' : 'Aucun lien disponible'}</span></li>)}</ol>;

  return <div className="sn-page ipd-page">
    <Breadcrumb entries={[{ label: 'Paiements', to: '/payments' }, { label: 'Paiements clients', to: '/payments' }, { label: `Paiement ${paymentReference(payment)}` }]} />
    <header className="ipd-heading"><Link className="sn-btn" to="/payments"><ArrowLeft aria-hidden="true" />Retour à la liste</Link><div><div className="ipd-heading__title"><h1>Paiement {paymentReference(payment)}</h1><Badge tone={status.tone}>{status.label}</Badge></div><p>Détail complet du paiement reçu de votre client international.</p></div>
      <div className="ipd-heading__actions">{proof && <button type="button" className="sn-btn" disabled={downloadId !== null} onClick={() => { void download(proof); }}><Download aria-hidden="true" />Télécharger le justificatif</button>}
        <div className="ipd-actions" ref={actionsRef}><button ref={actionButton} type="button" className="sn-btn sn-btn--primary" aria-expanded={actionsOpen} aria-controls="ipd-actions" onClick={() => setActionsOpen((open) => !open)}>Actions<ChevronDown aria-hidden="true" /></button>{actionsOpen && <div id="ipd-actions" className="ipd-actions__menu"><Link to={`/sales/${sale.id}`}>Voir la vente associée<ArrowRight aria-hidden="true" /></Link><button onClick={() => selectTab('documents')}>Tous les documents<FileText aria-hidden="true" /></button><button onClick={() => selectTab('history')}>Chronologie complète<History aria-hidden="true" /></button><button disabled={refreshing} onClick={() => { setActionsOpen(false); onRefresh(); }}>Actualiser<RefreshCw aria-hidden="true" /></button></div>}</div>
      </div></header>
    {refreshing && <p className="ipd-feedback" role="status">Actualisation du dossier…</p>}
    {downloadError && <p className="ipd-feedback ipd-feedback--error" role="alert">{downloadError}</p>}
    {downloadId && <p className="ipd-feedback" role="status">Téléchargement du document…</p>}
    <section className="ipd-summary" aria-label="Synthèse du paiement">
      {[
        { icon: CircleDollarSign, label: 'Vente associée', value: <Link to={`/sales/${sale.id}`}>{sale.sale_number}</Link>, sub: [customer?.name, customer?.country].filter(Boolean).join(' · ') || 'Client non disponible' },
        { icon: Banknote, label: amountConfirmed ? 'Montant payé' : 'Montant du paiement', value: money(paymentAmount(payment.amount), payment.currency), sub: payment.payment_method === 'bank_transfer' ? 'Virement bancaire' : payment.payment_method || 'Mode non renseigné' },
        { icon: CheckCircle2, label: 'Statut', value: status.label, sub: status.title },
        { icon: CalendarDays, label: 'Date de paiement', value: payment.actual_date ? detailDate(payment.actual_date) : 'Non renseignée', sub: payment.actual_date ? 'Date déclarée · UTC' : `Échéance : ${detailDate(payment.due_date || payment.expected_date)}` },
        { icon: Landmark, label: 'Référence bancaire', value: payment.reference_number || 'Non renseignée', sub: <button onClick={() => selectTab('details')}>Voir les détails<ArrowRight aria-hidden="true" /></button> },
        { icon: UserRound, label: 'Créé par', value: actor(payment.created_by), sub: detailDate(payment.created_at, true) },
      ].map(({ icon: Icon, label, value, sub }) => <div key={label}><span className="ipd-summary__icon"><Icon aria-hidden="true" /></span><div><span className="ipd-eyebrow">{label}</span><strong>{value}</strong><small>{sub}</small></div></div>)}
    </section>
    <div className="ipd-tabs" role="tablist" aria-label="Détail du paiement">{TABS.map(({ id, label, icon: Icon }, index) => <button id={`ipd-tab-${id}`} key={id} type="button" role="tab" tabIndex={tab === id ? 0 : -1} aria-selected={tab === id} aria-controls={`ipd-panel-${id}`} onClick={() => selectTab(id)} onKeyDown={(event) => {
      const next = event.key === 'ArrowRight' ? (index + 1) % TABS.length : event.key === 'ArrowLeft' ? (index + TABS.length - 1) % TABS.length : event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : null;
      if (next !== null) { event.preventDefault(); selectTab(TABS[next].id); document.getElementById(`ipd-tab-${TABS[next].id}`)?.focus(); }
    }}><Icon aria-hidden="true" />{label}{id === 'documents' && <span className="ipd-tab-count">{documents.length}</span>}</button>)}</div>
    <div id={`ipd-panel-${tab}`} className="ipd-tabpanel" role="tabpanel" aria-labelledby={`ipd-tab-${tab}`} tabIndex={0}>
      {tab === 'overview' && <>
        <div className="ipd-overview-top">{financePanel}<Panel title="De l’expédition au paiement" icon={History} action={<button className="ipd-icon-button" aria-label="Voir toute la chronologie" onClick={() => selectTab('history')}><ArrowRight aria-hidden="true" /></button>}><Timeline compact events={paymentOverviewTimeline(detail)} />{stageUnavailable && <p className="ipd-feedback" role="status">La chronologie amont n’a pas pu être chargée.</p>}</Panel>
          <Panel title="Statut du paiement" icon={ShieldCheck} className={`ipd-status ipd-status--${status.tone}`}><div className="ipd-status__symbol" aria-hidden="true">{amountConfirmed ? <Check /> : status.tone === 'danger' ? <XCircle /> : <Clock3 />}</div><h3>{status.title}</h3><p>{status.description}</p><div className="ipd-status__foot">{amountConfirmed && payment.approved_at ? `Confirmé le ${detailDate(payment.approved_at, true)} (UTC)` : 'La confirmation dépend du contrôle des justificatifs.'}</div></Panel>
        </div><div className="ipd-three-columns">{clientPanel}{bankPanel}{extraPanel}</div>
        <Panel title="Documents associés" icon={FileText} action={<button className="ipd-text-button" onClick={() => selectTab('documents')}>Tout voir ({documents.length})<ArrowRight aria-hidden="true" /></button>}>{documents.length ? documentCards(documents.slice(0, 3)) : <Empty>{stageUnavailable ? 'Documents du dossier indisponibles.' : 'Aucun document rattaché à ce dossier.'}</Empty>}</Panel>
      </>}
      {tab === 'details' && <><div className="ipd-two-columns"><Panel title="Détails du règlement" icon={Wallet}><Facts rows={[
        ['Identifiant du paiement', payment.id], ['Vente', <Link to={`/sales/${sale.id}`}>{sale.sale_number}</Link>], ['Montant en devise de vente', money(paymentAmount(payment.amount), payment.currency)],
        ['Montant reçu en devise d’origine', money(paymentAmount(payment.received_amount), payment.payment_currency || '')], ['Référence bancaire', payment.reference_number],
        ['Échéance', detailDate(payment.due_date || payment.expected_date)], ['Date de paiement', detailDate(payment.actual_date, true)], ['Statut', <Badge tone={status.tone}>{status.label}</Badge>],
        ['Source du taux de change', payment.fx_rate_source], ['Date du taux', detailDate(payment.fx_rate_date)],
      ]} /></Panel>{financePanel}</div><div className="ipd-three-columns">{clientPanel}{bankPanel}{extraPanel}</div><Panel title="Versements de la vente" icon={Banknote}>{detail.payments === null ? <Empty>Le registre des versements n’a pas pu être chargé.</Empty> : <div className="ipd-table-wrap"><table><thead><tr><th>Paiement / référence</th><th>Date déclarée</th><th>Montant</th><th>Statut</th></tr></thead><tbody>{detail.payments.map((row) => <tr key={row.id} className={row.id === payment.id ? 'is-current' : ''}><td><Link to={`/payments/${row.id}`}>{paymentReference(row)}</Link>{row.id === payment.id && <small>Paiement consulté</small>}</td><td>{detailDate(row.actual_date)}</td><td>{money(paymentAmount(row.amount), row.currency)}</td><td><Badge tone={detailStatus(row).tone}>{detailStatus(row).label}</Badge></td></tr>)}</tbody></table></div>}</Panel></>}
      {tab === 'reconciliation' && <><div className="ipd-two-columns"><Panel title="Contrôle et rapprochement bancaire" icon={ShieldCheck}><Facts rows={[
        ['Statut du paiement', <Badge tone={status.tone}>{status.label}</Badge>], ['Exécuté par', actor(payment.executed_by)], ['Exécution enregistrée le', detailDate(payment.executed_at, true)],
        ['Vérifié par', actor(payment.verified_by)], ['Vérification enregistrée le', detailDate(payment.verified_at, true)], ['Confirmé par', actor(payment.approved_by)], ['Confirmation enregistrée le', detailDate(payment.approved_at, true)],
      ]} /><p className="ipd-feedback"><LockKeyhole aria-hidden="true" />L’exécution et la confirmation sont deux étapes distinctes. Cette page ne modifie pas les droits ni le statut du paiement.</p></Panel>{financePanel}</div>
        <Panel title="Conciliation de la vente et analyse raffinerie" icon={FlaskConical}>{stageUnavailable ? <Empty>Le dossier de conciliation n’a pas pu être chargé. Utilisez Actions → Actualiser pour réessayer.</Empty> : chain?.conciliation ? <><Facts rows={[
          ['Dossier de conciliation', chain.conciliation.reference], ['Statut du dossier', conciliationStatus[chain.conciliation.statut || ''] || scalar(chain.conciliation.statut)], ['Valeur initiale', money(paymentAmount(chain.conciliation.ca_initial), typeof chain.conciliation.devise === 'string' ? chain.conciliation.devise : '')], ['Valeur finale', money(paymentAmount(chain.conciliation.ca_final), typeof chain.conciliation.devise === 'string' ? chain.conciliation.devise : '')], ['Devise', scalar(chain.conciliation.devise)], ['Validation', detailDate(typeof chain.conciliation.valide_le === 'string' ? chain.conciliation.valide_le : null)],
        ]} /><Link className="sn-btn" to={`/conciliation/${sale.id}`}>Voir le dossier de conciliation<ArrowRight aria-hidden="true" /></Link></> : <Empty>Aucun dossier de conciliation disponible pour cette vente.</Empty>}{chain?.analyses?.map((item) => <div className="ipd-analysis" key={item.id}><FlaskConical aria-hidden="true" /><strong>{item.reference || 'Analyse sans référence'}</strong><span>{scalar(item.laboratoire)} · {detailDate(item.date)}</span><span>Teneur en or : {paymentAmount(item.or_pct)?.toLocaleString('fr-FR', { maximumFractionDigits: 4 }) ?? '—'} %</span></div>)}<p className="ipd-feedback">Les écarts d’analyse et les ajustements fiscaux restent distincts du rapprochement bancaire. Ils ne sont pas ajoutés une seconde fois au solde de la vente.</p></Panel>
        {(fiscalAdjustments.length > 0 || credits.length > 0) && <Panel title="Ajustements fiscaux et avoirs du dossier" icon={FileText}>
          {fiscalAdjustments.length > 0 && <div className="ipd-table-wrap"><table><caption>Ajustements fiscaux enregistrés</caption><thead><tr><th>Taxe</th><th>Complément dû</th><th>Trop-perçu</th><th>Ajustement net</th></tr></thead><tbody>{fiscalAdjustments.map((tax, index) => <tr key={`${tax.code}-${tax.devise}-${index}`}><td>{tax.code.toUpperCase()}</td><td>{money(tax.complement_du ?? null, tax.devise || '')}</td><td>{money(tax.trop_percu ?? null, tax.devise || '')}</td><td>{money(tax.net ?? null, tax.devise || '')}</td></tr>)}</tbody></table></div>}
          {credits.length > 0 && <div className="ipd-table-wrap"><table><caption>Avoirs rattachés à la vente</caption><thead><tr><th>Référence</th><th>Montant</th><th>Statut enregistré</th></tr></thead><tbody>{credits.map((credit, index) => <tr key={`${credit.reference}-${index}`}><td>{credit.reference}</td><td>{money(credit.montant, credit.devise)}</td><td>{credit.statut}</td></tr>)}</tbody></table></div>}
        </Panel>}
      </>}
      {tab === 'documents' && <><Panel title="Dossier documentaire complet" icon={FileText}>{processRibbon}<div className="ipd-filterbar"><label><span>Rechercher un document</span><div className="ipd-search"><Search aria-hidden="true" /><input value={search} onChange={(event) => { setSearch(event.target.value); setDocPage(1); }} placeholder="Nom du fichier, référence…" /></div></label><label><span>Étape du dossier</span><select value={stage} onChange={(event) => { setStage(event.target.value); setDocPage(1); }}><option value="">Toutes les étapes</option>{stageOptions}</select></label><button className="sn-btn" onClick={() => selectTab('history')}><History aria-hidden="true" />Chronologie complète</button></div>
        {stageUnavailable && <p className="ipd-feedback ipd-feedback--error" role="alert">Le dossier documentaire n’a pas pu être chargé. Seuls les justificatifs directement liés au paiement sont disponibles.</p>}
        <p className="ipd-result-count">{filteredDocuments.length} document{filteredDocuments.length > 1 ? 's' : ''}</p>{filteredDocuments.length ? documentCards(filteredDocuments.slice((effectiveDocPage - 1) * 20, effectiveDocPage * 20)) : <Empty>Aucun document pour cette sélection.</Empty>}<PageControls page={effectiveDocPage} total={filteredDocuments.length} onPage={setDocPage} /></Panel></>}
      {tab === 'history' && <Panel title="Chronologie complète du dossier" icon={History}>{processRibbon}<div className="ipd-filterbar"><label><span>Filtrer la chronologie</span><select value={historyStage} onChange={(event) => { setHistoryStage(event.target.value); setHistoryPage(1); }}><option value="">Toutes les étapes</option>{stageOptions}</select></label><p>Événements enregistrés, du plus ancien au plus récent · heures UTC.</p><span className="ipd-result-count">{filteredHistory.length} événement{filteredHistory.length > 1 ? 's' : ''}</span></div>{stageUnavailable && <p className="ipd-feedback ipd-feedback--error" role="alert">La chronologie amont est indisponible. Les événements ci-dessous proviennent des paiements accessibles.</p>}<Timeline events={filteredHistory.slice((effectiveHistoryPage - 1) * 20, effectiveHistoryPage * 20)} /><PageControls page={effectiveHistoryPage} total={filteredHistory.length} onPage={setHistoryPage} /></Panel>}
    </div>
    <footer className="ipd-security"><LockKeyhole aria-hidden="true" />Documents privés · accès contrôlés · traçabilité du dossier</footer>
  </div>;
}
