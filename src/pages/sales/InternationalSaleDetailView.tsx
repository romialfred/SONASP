import { useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Banknote, Check, ClipboardList, Coins, Download, FileText, Gem, History, MoreVertical, Package, Scale, ShieldCheck, Truck, type LucideIcon } from 'lucide-react';
import { Badge, Breadcrumb, EmptyState, Tabs, TabPanel } from '@/components/ui/sn';
import type { InternationalSaleDetail } from '@/services/internationalSaleDetailService';
import type { SaleDocument } from '@/services/saleDocumentsService';
import { internationalPaymentBalance, isPayableSaleStatus } from '@/services/internationalPaymentBalance';
import { confirmedPaidAmount, GRAMS_PER_TROY_OUNCE } from './internationalSalesList';
import { internationalSalesCopy } from './internationalSalesCopy';
import { LIBELLES_STATUTS_CONCILIATION, type StatutConciliation } from '@/services/conciliationService';
import './international-sale-detail.css';

type DetailTab = 'summary' | 'shipment' | 'conciliation' | 'payments' | 'documents' | 'history';
export interface InternationalSaleDetailViewProps {
  detail: InternationalSaleDetail;
  canPay: boolean;
  canApprove: boolean;
  onDecision: (decision: 'approve' | 'reject', reason: string) => Promise<void>;
  onDownload: (document: SaleDocument) => Promise<void>;
  historyContent?: ReactNode;
  initialTab?: DetailTab;
}

function Panel({ title, icon: Icon, children, actions, tone = '' }: {
  title: string; icon: LucideIcon; children: ReactNode; actions?: ReactNode; tone?: string;
}) {
  return <section className={`isd-card ${tone}`} aria-label={title}>
    <header><h2><span><Icon aria-hidden="true" /></span>{title}</h2>{actions}</header>
    <div className="isd-card__body">{children}</div>
  </section>;
}

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return <dl className="isd-facts">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? '—'}</dd></div>)}</dl>;
}

export function InternationalSaleDetailView({ detail, canPay, canApprove, onDecision, onDownload, historyContent, initialTab = 'summary' }: InternationalSaleDetailViewProps) {
  const { i18n } = useTranslation();
  const en = i18n.language.startsWith('en');
  const tr = (fr: string, english: string) => en ? english : fr;
  const copy = internationalSalesCopy[en ? 'en' : 'fr'];
  const [tab, setTab] = useState<DetailTab>(initialTab);
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const actionsRef = useRef<HTMLDetailsElement>(null);
  const { sale, payments, shipment, documents, conciliations } = detail;
  const locale = en ? 'en-GB' : 'fr-FR';
  const number = (value: number | null | undefined, digits = 2) => value == null || !Number.isFinite(value) ? '—'
    : new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  const money = (value: number | null | undefined, currency = sale.currency) => value == null || !currency ? '—' : `${number(value)} ${currency}`;
  const date = (value: string | null | undefined, time = false) => !value || Number.isNaN(Date.parse(value)) ? '—'
    : new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric', ...(time ? { hour: '2-digit', minute: '2-digit' } as const : {}) }).format(new Date(value));
  const grams = sale.quantity_oz * GRAMS_PER_TROY_OUNCE;
  const price = (sale.final_price_per_oz ?? sale.london_am_rate) / GRAMS_PER_TROY_OUNCE;
  const balance = internationalPaymentBalance(sale.final_proceeds, sale.currency, payments);
  // A legacy closed sale without a confirmed ledger is not an unpaid sale.
  const confirmed = confirmedPaidAmount({ ...sale, payments });
  const unverified = ['payment_received', 'completed'].includes(sale.status) && confirmed === null;
  const outstanding = confirmed === null ? null : Math.round((sale.final_proceeds - confirmed) * 100) / 100;
  const payable = canPay && sale.seller_type === 'sonasp' && isPayableSaleStatus(sale.status) && (balance.available ?? 0) > 0;
  const paidPercent = confirmed === null || !(sale.final_proceeds > 0) ? null : confirmed / sale.final_proceeds * 100;
  const actualPayments = payments.filter((p) => p.is_virtual === false);
  const availableDocuments = documents?.filter((doc) => doc.available) ?? [];
  const invoice = documents?.find((doc) => doc.type === 'invoice' && doc.available);
  const invoiceRef = invoice?.description.startsWith('Référence ') ? invoice.description.slice(10) : payments.find((p) => p.invoice_number)?.invoice_number;
  const latestConciliation = conciliations?.[0];
  const conciliationLabelsEn: Record<string, string> = { en_attente_analyse: 'Awaiting assay', analyse_recue: 'Assay received', calculee: 'Calculated', ecart_a_verifier: 'Difference to verify', en_attente_validation: 'Awaiting approval', contestee: 'Disputed', validee: 'Approved', facture_definitive_generee: 'Final invoice generated', cloturee: 'Closed', annulee: 'Cancelled' };
  const delta = latestConciliation?.ca_final != null && latestConciliation.ca_initial != null
    && latestConciliation.devise_finale === latestConciliation.devise_initiale
    ? latestConciliation.ca_final - latestConciliation.ca_initial : null;
  const paymentStatus = (p: { status: string | null; is_virtual: boolean | null }) => p.is_virtual ? tr('Engagement attendu', 'Expected commitment')
    : ({ approved: tr('Confirmé', 'Confirmed'), processing: tr('À rapprocher', 'Under review'), pending: tr('En attente', 'Pending'), rejected: tr('Rejeté', 'Rejected'), cancelled: tr('Annulé', 'Cancelled'), failed: tr('Échec', 'Failed') }[p.status || ''] || tr('À vérifier', 'To verify'));
  const statusLabel = ['management_rejected', 'customer_rejected'].includes(sale.status) ? copy.statuses[sale.status] : unverified ? copy.unknownPayment : confirmed !== null && outstanding !== null && outstanding <= 0 ? tr('Payée', 'Paid')
    : confirmed !== null && confirmed > 0 ? tr('Partiellement payée', 'Partially paid') : copy.statuses[sale.status] || sale.status;
  const pendingApproval = canApprove && sale.status === 'pending_management_approval';
  const timeline = [
    [tr('Vente créée', 'Sale created'), sale.created_at], [tr('Validation SONASP', 'SONASP approval'), sale.management_approved_at],
    [tr('Accord du client', 'Customer approval'), sale.customer_approved_at], [tr('Expédition', 'Shipment'), shipment?.shipped_at],
    [tr('Vente refusée par la SONASP', 'Sale rejected by SONASP'), sale.management_rejected_at],
    [tr('Vente refusée par le client', 'Sale rejected by customer'), sale.customer_rejected_at],
    [tr('Encaissement confirmé', 'Receipt confirmed'), sale.payment_received_at], [tr('Vente clôturée', 'Sale closed'), sale.completed_at],
  ].filter((entry): entry is [string, string] => Boolean(entry[1])).sort((a, b) => a[1].localeCompare(b[1]));
  const proceed = <Link className="sn-btn sn-btn--primary" to={`/payments/create?saleId=${encodeURIComponent(sale.id)}`}><Banknote aria-hidden="true" />{tr('Procéder au paiement', 'Record payment')}</Link>;
  const tabOptions = [
    { value: 'summary' as const, label: tr('Résumé', 'Summary'), icon: ClipboardList },
    { value: 'shipment' as const, label: tr('Expédition', 'Shipment'), icon: Truck },
    { value: 'conciliation' as const, label: 'Conciliation', icon: Scale },
    { value: 'payments' as const, label: tr('Paiements', 'Payments'), icon: Banknote, count: actualPayments.length },
    { value: 'documents' as const, label: 'Documents', icon: FileText, count: availableDocuments.length },
    { value: 'history' as const, label: tr('Historique', 'History'), icon: History },
  ];
  async function download(doc: SaleDocument) {
    setActionError(null);
    try { await onDownload(doc); } catch { setActionError(tr('Le document n’a pas pu être ouvert. Réessayez.', 'Unable to open this document. Please retry.')); }
  }
  const documentsPanel = (all = false) => <Panel title={tr('Documents clés', 'Key documents')} icon={FileText}>
    {documents === null ? <EmptyState title={tr('Documents indisponibles', 'Documents unavailable')} /> : !availableDocuments.length
      ? <EmptyState title={tr('Aucun document rattaché', 'No linked documents')} />
      : <ul className="isd-documents">{(all ? availableDocuments : availableDocuments.slice(0, 5)).map((doc) => <li key={doc.documentId}>
        <FileText aria-hidden="true" /><div><strong>{doc.label}</strong><small>{doc.description}</small></div><time>{date(doc.generatedDate)}</time>
        <button type="button" className="isd-icon-btn" aria-label={`${tr('Ouvrir', 'Open')} ${doc.label}`} onClick={() => void download(doc)}><Download aria-hidden="true" /></button>
      </li>)}</ul>}
    {!all && <button type="button" className="isd-text-link" onClick={() => setTab('documents')}>{tr('Voir tous les documents', 'View all documents')} ({availableDocuments.length})<ArrowRight aria-hidden="true" /></button>}
  </Panel>;
  const financePanel = <Panel title={tr('Aperçu financier', 'Financial overview')} icon={Coins}>
    <Facts rows={[
      [tr('Montant total de la vente', 'Sale total'), money(sale.final_proceeds)],
      [tr('Versements en cours de contrôle', 'Receipts under review'), money(balance.processing)],
      [tr('Total payé et confirmé', 'Total confirmed receipts'), <span key="paid">{money(confirmed)} {paidPercent !== null && <Badge tone="success">{number(paidPercent, 1)} %</Badge>}</span>],
    ]} />
    <div className={`isd-balance${outstanding !== null && outstanding <= 0 ? ' is-settled' : ''}`}><span>{tr('Solde restant dû', 'Outstanding balance')}</span><strong>{money(outstanding)}</strong></div>
    {unverified && <p className="isd-hint">{tr('Historique d’encaissement à vérifier : la vente est clôturée, sans versement confirmé dans le registre.', 'Receipt history requires review: the sale is closed without a confirmed ledger entry.')}</p>}
  </Panel>;
  const schedulePanel = (all = false) => <Panel title={tr('Échéancier et versements', 'Schedule and receipts')} icon={Banknote}
    actions={payable ? <Link className="sn-btn sn-btn--sm" to={`/payments/create?saleId=${encodeURIComponent(sale.id)}`}><Banknote aria-hidden="true" />{tr('Enregistrer un paiement', 'Record a payment')}</Link> : undefined}>
    {!payments.length ? <EmptyState title={tr('Aucun versement enregistré', 'No payments recorded')} /> : <ol className="isd-schedule">{(all ? payments : payments.slice(-4)).map((p) => <li key={p.id}>
      <span className={`isd-schedule__dot${p.status === 'approved' && !p.is_virtual ? ' is-paid' : ''}`} />
      <Link to={`/payments/${p.id}`}>{p.is_virtual ? tr('Engagement de paiement', 'Payment commitment') : p.reference_number || tr('Versement', 'Receipt')}</Link>
      <time>{date(p.actual_date || p.expected_date)}</time><strong>{money(p.amount, p.currency)}</strong>
      <Badge tone={p.status === 'approved' && !p.is_virtual ? 'success' : p.status === 'processing' ? 'info' : 'neutral'}>{paymentStatus(p)}</Badge>
      {p.status === 'approved' && !p.is_virtual && <Check aria-label={tr('Confirmé', 'Confirmed')} />}
    </li>)}</ol>}
    <p className="isd-hint">{tr('Un engagement n’est pas un encaissement. Chaque versement est confirmé après contrôle de sa preuve bancaire.', 'A commitment is not a receipt. Each payment is confirmed after its supporting proof is reviewed.')}</p>
    {!all && payments.length > 4 && <button type="button" className="isd-text-link" onClick={() => setTab('payments')}>{tr('Voir tous les versements', 'View all receipts')}<ArrowRight aria-hidden="true" /></button>}
  </Panel>;
  const conciliationPanel = <Panel title={tr('Résumé de conciliation', 'Reconciliation summary')} icon={Scale}>
    {!latestConciliation ? <EmptyState title={conciliations === null ? tr('Conciliation indisponible', 'Reconciliation unavailable') : tr('Aucune conciliation enregistrée', 'No reconciliation recorded')} /> : <>
      <Facts rows={[[tr('Référence', 'Reference'), latestConciliation.reference], [tr('Valeur initiale', 'Initial value'), money(latestConciliation.ca_initial, latestConciliation.devise_initiale)],
        [tr('Valeur après analyse', 'Value after analysis'), money(latestConciliation.ca_final, latestConciliation.devise_finale)],
        [tr('Écart de valorisation', 'Valuation difference'), money(delta, latestConciliation.devise_finale)], [tr('Statut', 'Status'), (en ? conciliationLabelsEn[latestConciliation.statut] : LIBELLES_STATUTS_CONCILIATION[latestConciliation.statut as StatutConciliation]) || tr('À vérifier', 'To verify')]]} />
      <Link className="isd-text-link" to={`/conciliation/${sale.id}`}>{tr('Consulter le dossier de conciliation', 'View reconciliation file')}<ArrowRight aria-hidden="true" /></Link>
    </>}
  </Panel>;
  return <div className="sn-page international-sale-detail">
    <div className="isd-topline"><Breadcrumb entries={[{ label: copy.sales, to: '/sales' }, { label: copy.allSales, to: '/sales' }, { label: tr('Détail de la vente', 'Sale details') }]} /><small>{tr('Dernière mise à jour', 'Last updated')} : {date(sale.updated_at, true)}</small></div>
    <header className="isd-titlebar"><Link className="sn-btn" to="/sales"><ArrowLeft aria-hidden="true" />{tr('Retour à la liste', 'Back to list')}</Link><div className="isd-title"><h1>{tr('Vente d’or à l’international', 'International gold sale')}</h1><Badge tone="info">{sale.sale_number}</Badge></div>
      <div className="isd-current-status"><small>{tr('Statut actuel', 'Current status')}</small><strong>{statusLabel}</strong></div>
      {payable && proceed}
      <details ref={actionsRef} className="isd-actions" onKeyDown={(event) => { if (event.key === 'Escape' && actionsRef.current) { actionsRef.current.open = false; actionsRef.current.querySelector('summary')?.focus(); } }}><summary className="sn-btn"><MoreVertical aria-hidden="true" />Actions</summary><div onClick={() => { if (actionsRef.current) actionsRef.current.open = false; }}>
        <button type="button" onClick={() => setTab('documents')}>{tr('Consulter les documents', 'View documents')}</button>
        <button type="button" onClick={() => setTab('history')}>{tr('Consulter le workflow', 'View workflow')}</button>
        {pendingApproval && <><button type="button" onClick={() => { setDecision('approve'); setReason(''); }}>{tr('Valider la vente', 'Approve sale')}</button><button type="button" onClick={() => { setDecision('reject'); setReason(''); }}>{tr('Refuser la vente', 'Reject sale')}</button></>}
      </div></details>
    </header>
    {actionError && <p role="alert" className="sn-note sn-note--danger">{actionError}</p>}
    {decision && pendingApproval && <Panel title={decision === 'approve' ? tr('Valider la vente', 'Approve sale') : tr('Refuser la vente', 'Reject sale')} icon={ShieldCheck}>
      <form onSubmit={(event) => { event.preventDefault(); if (busy) return; setBusy(true); setActionError(null); void onDecision(decision, reason).then(() => setDecision(null)).catch((error: unknown) => setActionError(error instanceof Error ? error.message : tr('Décision refusée.', 'Decision refused.'))).finally(() => setBusy(false)); }}>
        <label className="sn-field"><span>{tr('Motif / observations', 'Reason / notes')}</span><textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} required={decision === 'reject'} minLength={decision === 'reject' ? 5 : undefined} maxLength={4000} disabled={busy} /></label>
        <div className="isd-form-actions"><button type="button" className="sn-btn" disabled={busy} onClick={() => setDecision(null)}>{tr('Annuler', 'Cancel')}</button><button className="sn-btn sn-btn--primary" disabled={busy}>{busy ? tr('Enregistrement…', 'Saving…') : tr('Confirmer la décision', 'Confirm decision')}</button></div>
      </form>
    </Panel>}
    <section className="isd-metadata" aria-label={tr('Informations générales', 'General information')}>
      <div><small>{copy.client}</small><strong>{sale.customer?.name || '—'}</strong><span>{sale.customer?.country || '—'}</span></div>
      <div><small>{tr('Structure vendeuse', 'Selling organisation')}</small><strong>{detail.companyName || '—'}</strong>{detail.licenseNumber && <Badge tone="success">{copy.license} {detail.licenseNumber}</Badge>}</div>
      <div><small>{copy.shippingDate}</small><strong>{date(shipment?.shipped_at)}</strong></div>
      <div><small>{tr('Référence facture', 'Invoice reference')}</small><strong>{invoiceRef || '—'}</strong></div>
      <div><small>Incoterm</small><strong>—</strong></div>
      <div><small>{copy.currency}</small><strong>{sale.currency || '—'}</strong></div>
      <div><small>{tr('Créée le', 'Created on')}</small><strong>{date(sale.created_at, true)}</strong><span>{detail.creatorName || tr('Auteur non renseigné', 'Author not provided')}</span></div>
    </section>
    <div className="isd-tabs" onKeyDownCapture={(event) => {
      if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const index = tabOptions.findIndex((option) => option.value === tab);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabOptions.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabOptions.length) % tabOptions.length;
      setTab(tabOptions[next].value);
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
    }}><Tabs value={tab} options={tabOptions} onChange={setTab} ariaLabel={tr('Détail de vente', 'Sale details')} /></div>
    <TabPanel value={tab}>
      {tab === 'summary' && <div className="isd-grid"><div className="isd-column">
        <Panel title={tr('Détails de la vente', 'Sale details')} icon={Gem} tone="isd-card--gold"><div className="isd-facts-columns"><Facts rows={[
          [tr('Quantité (poids fin)', 'Quantity (fine gold)'), `${number(grams)} g`], [tr('Prix au gramme', 'Price per gram'), money(price)], [tr('Valeur brute', 'Gross value'), money(sale.gross_proceeds)],
          [tr('Frais & charges', 'Fees and charges'), sale.freight_cost === null || sale.other_costs === null ? '—' : money(sale.freight_cost + sale.other_costs)], [tr('Valeur nette à régler', 'Net amount due'), money(sale.final_proceeds)],
        ]} /><Facts rows={[[tr('Monnaie de règlement', 'Settlement currency'), sale.currency], [tr('Mode de paiement', 'Payment method'), sale.payment_method === 'bank_transfer' ? tr('Virement bancaire', 'Bank transfer') : sale.payment_method],
          [tr('Mécanisme de vente', 'Pricing mechanism'), sale.mechanism_type === 'spot' ? tr('Au comptant (spot)', 'Spot price') : sale.mechanism_type], [tr('Conditions de paiement', 'Payment terms'), sale.payment_terms], [tr('Lieu de livraison', 'Delivery location'), shipment ? [shipment.shipped_to_address, shipment.shipped_to_country].filter(Boolean).join(', ') || null : null]]} /></div></Panel>
        {schedulePanel()}
        <Panel title={tr('Répartition par éléments', 'Value breakdown')} icon={ClipboardList}><div className="isd-table-wrap"><table className="isd-table"><thead><tr><th>{tr('Élément', 'Item')}</th><th>Description</th><th>{tr('Montant', 'Amount')} ({sale.currency || '—'})</th><th>%</th></tr></thead><tbody>
          {[[tr('Valeur brute', 'Gross value'), `${number(grams)} g × ${money(price)}`, sale.gross_proceeds], [tr('Frais logistiques', 'Freight costs'), tr('Transport et expédition', 'Transport and shipment'), sale.freight_cost], [tr('Autres frais', 'Other costs'), tr('Charges enregistrées', 'Recorded charges'), sale.other_costs], [tr('Redevances', 'Royalties'), tr('Montant calculé pour cette vente', 'Amount calculated for this sale'), sale.royalty_amount]].map(([label, desc, value]) => <tr key={String(label)}><th>{label}</th><td>{desc}</td><td>{number(value as number | null)}</td><td>{value == null || !sale.gross_proceeds ? '—' : `${number(Number(value) / sale.gross_proceeds * 100)} %`}</td></tr>)}
          <tr className="isd-table__total"><th colSpan={2}>{tr('Valeur nette à régler', 'Net amount due')}</th><td>{number(sale.final_proceeds)}</td><td>{sale.gross_proceeds > 0 ? `${number(sale.final_proceeds / sale.gross_proceeds * 100)} %` : '—'}</td></tr>
        </tbody></table></div></Panel>
      </div><div className="isd-column">{financePanel}{conciliationPanel}{documentsPanel()}</div></div>}
      {tab === 'payments' && <div className="isd-grid"><div className="isd-column">{schedulePanel(true)}{canPay && !payable && <p className="sn-note sn-note--info">{isPayableSaleStatus(sale.status) ? tr('Aucun montant disponible à enregistrer. Vérifiez les versements en cours de contrôle.', 'No available amount to record. Review pending receipts.') : tr('L’accord du client et l’ouverture du règlement sont requis avant l’enregistrement.', 'Customer approval and the payment stage are required before recording a receipt.')}</p>}</div><div className="isd-column">{financePanel}<Panel title={tr('Contrôle des paiements', 'Payment verification')} icon={ShieldCheck}><p>{tr('Enregistrez le montant réellement reçu, même partiel, avec son justificatif. Un autre agent habilité confirme ensuite l’encaissement. Aucun virement bancaire n’est émis par cet écran.', 'Record the amount actually received, including a partial receipt, with its proof. Another authorised agent confirms it. This screen does not initiate a bank transfer.')}</p></Panel></div></div>}
      {tab === 'documents' && documentsPanel(true)}
      {tab === 'conciliation' && <div className="isd-grid"><div className="isd-column">{conciliationPanel}<Panel title={tr('Rapports et analyse', 'Reports and analysis')} icon={Scale}><p>{tr('Le dossier de conciliation compare l’analyse initiale et les résultats de raffinage. Les écarts de poids, de valeur et de taxes restent distincts du solde bancaire.', 'Reconciliation compares the original assay and refinery results. Weight, value and tax differences are separate from the bank balance.')}</p><Link className="sn-btn" to={`/conciliation/${sale.id}`}>{tr('Ouvrir le dossier', 'Open file')}<ArrowRight aria-hidden="true" /></Link></Panel></div><div className="isd-column">{financePanel}</div></div>}
      {tab === 'shipment' && <div className="isd-grid"><div className="isd-column"><Panel title={tr('Expédition concernée', 'Linked shipment')} icon={Truck}>{shipment ? <Facts rows={[[tr('Lot', 'Lot'), shipment.expedition_lot_number], [tr('Date d’expédition', 'Shipment date'), date(shipment.shipped_at)], [tr('Destinataire', 'Recipient'), shipment.shipped_to_company], [tr('Destination', 'Destination'), [shipment.shipped_to_address, shipment.shipped_to_country].filter(Boolean).join(', ')], [tr('Nombre de colis', 'Number of boxes'), shipment.total_boxes], [tr('Poids brut', 'Gross weight'), `${number(shipment.total_gross_weight_grams)} g`], [tr('Poids net', 'Net weight'), `${number(shipment.total_net_weight_grams)} g`], [tr('Scellé', 'Seal'), shipment.seal_number]]} /> : <EmptyState title={tr('Aucune expédition disponible', 'No shipment available')} />}</Panel></div><div className="isd-column"><Panel title={tr('Origine de l’or vendu', 'Gold provenance')} icon={Package}>{detail.origins?.length ? <ul className="isd-origins">{detail.origins.map((part) => <li key={`${part.source_type}-${part.source_id}`}><strong>{part.reference}</strong><span>{part.origine}</span><b>{number(part.quantite_oz * GRAMS_PER_TROY_OUNCE)} g</b></li>)}</ul> : <EmptyState title={detail.origins === null ? tr('Origines indisponibles', 'Origins unavailable') : tr('Aucun lot rattaché', 'No linked lots')} />}</Panel></div></div>}
      {tab === 'history' && <><Panel title={tr('Cycle de vie de la vente', 'Sale lifecycle')} icon={History}><ol className="isd-history">{timeline.map(([label, value]) => <li key={label}><span /><strong>{label}</strong><time>{date(value, true)}</time></li>)}</ol></Panel>{historyContent}</>}
    </TabPanel>
  </div>;
}
