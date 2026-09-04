import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileText, Upload, Eye, Trash2,
  FileCheck, ShieldCheck, ChevronRight, RefreshCw, Package
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { PageHeader, Section, Card, Note } from '@/components/ui/sn';
import { logisticsNumber, logisticsDate } from '@/components/shipping/LogisticsRegister';
import { ActionErrorDialog } from '@/components/ui/ActionErrorDialog';
import { presentError } from '@/lib/presentError';
import { Button } from '@/components/ui/Button';
import { PDFViewer } from '@/components/ui/PDFViewer';
import { FreightStatusBadge } from '@/components/freight/FreightStatusBadge';
import {
  freightCustomsService,
  type FreightCustomsDocument,
  type FreightCustomsHistoryEntry,
  type FreightCustomsOperation,
} from '@/services/freightCustomsService';
import { useNotification } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  FREIGHT_CAPABILITIES,
  canReadFreightHistory,
  getFreightTransitionAccess,
  hasFreightCapability,
} from '@/lib/freightCustomsAccess';
import { AddDocumentModal } from '@/components/freight/AddDocumentModal';
import { ChangeStatusModal } from '@/components/freight/ChangeStatusModal';
import { GenerateInvoiceModal } from '@/components/freight/GenerateInvoiceModal';

const FREIGHT_DOCUMENT_LABELS: Record<string, string> = {
  customs_declaration: 'Déclaration en douane',
  customs_approval: 'Approbation douanière',
  transport_document: 'Document de transport',
  bill_of_lading: 'Connaissement',
  export_invoice: 'Facture d’exportation',
  bullion_summary: 'Récapitulatif des lingots',
  other: 'Autre document',
};

export default function FreightCustomsDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const { user } = useAuth();
  const canPrepare = hasFreightCapability(user, FREIGHT_CAPABILITIES.PREPARE);
  const canManageInvoice = hasFreightCapability(user, FREIGHT_CAPABILITIES.INVOICE_MANAGE);
  const canReadHistory = canReadFreightHistory(user);

  const [operation, setOperation] = useState<FreightCustomsOperation | null>(null);
  const [documents, setDocuments] = useState<FreightCustomsDocument[]>([]);
  const [history, setHistory] = useState<FreightCustomsHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReturnType<typeof presentError> | null>(null);
  const [contextFailed, setContextFailed] = useState(false);
  const [tab, setTab] = useState('overview');
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<FreightCustomsDocument | null>(null);

  // Function to handle back navigation
  const handleBack = () => {
    navigate('/freight-customs');
  };

  useEffect(() => {
    if (id) {
      loadOperationDetails();
    }
  }, [id]);

  const loadOperationDetails = async () => {
    if (!id) return;

    try {
      setLoading(true);
      setContextFailed(false);
      const data = await freightCustomsService.getOperationById(id);
      setOperation(data);

      if (data) {
        const [docs, entries] = await Promise.all([
          freightCustomsService.listDocuments(id),
          canReadHistory ? freightCustomsService.getStatusHistory(id) : Promise.resolve([]),
        ]);
        setDocuments(docs);
        setHistory(entries);
      }
    } catch (reason) {
      setContextFailed(true);
      setError(presentError(reason));
    } finally {
      setLoading(false);
    }
  };

  const handleViewDocument = async (doc: FreightCustomsDocument) => {
    if (!doc.file_path) return;

    try {
      const url = await freightCustomsService.getDocumentUrl(doc.file_path);
      setSelectedDocument(doc);
      setPdfViewerUrl(url);
    } catch (error: any) {
      showNotification('error', 'Impossible d’ouvrir le document : ' + error.message);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('Supprimer ce document ? Cette action le retirera du dossier douanier.')) return;

    try {
      await freightCustomsService.deleteDocument(docId);
      showNotification('success', 'Document supprimé');
      loadOperationDetails();
    } catch (error: any) {
      showNotification('error', 'Impossible de supprimer le document : ' + error.message);
    }
  };

  const handleDocumentAdded = () => {
    setShowDocumentModal(false);
    loadOperationDetails();
    showNotification('success', 'Document ajouté');
  };

  const handleStatusChanged = () => {
    setShowStatusModal(false);
    loadOperationDetails();
    showNotification('success', 'Statut du circuit mis à jour');
  };

  const handleInvoiceGenerated = () => {
    setShowInvoiceModal(false);
    loadOperationDetails();
    showNotification('success', 'Facture générée et ajoutée aux documents');
  };

  const shipping = operation?.shipping_preparation;
  const transitionAccess = operation ? getFreightTransitionAccess(user, operation) : null;
  const canDeleteDocument = canPrepare && (operation?.status === 'customs_pending' || operation?.status === 'ready_for_expedition');
  const nextAction = operation?.status === 'customs_pending' ? 'Examiner l’approbation douanière'
    : operation?.status === 'customs_approved' ? 'Préparer le transport' : 'Autoriser le départ';
  return <NationalDashboardLayout><div className="sn-page logistics-workspace">
    <PageHeader title={operation?.reference_number || 'Opération douanière'} subtitle="Dédouanement, documents et autorisations traçables de l’expédition." icon={ShieldCheck}
      breadcrumb={[{ label: 'Expéditions', to: '/shipping/preparation' }, { label: 'Douane et consignation', to: '/freight-customs' }, { label: operation?.reference_number || 'Détails' }]}
      actions={<><Button type="button" variant="outline" onClick={handleBack}><ArrowLeft size={16} />Retour aux opérations</Button><Button type="button" variant="outline" disabled={loading} onClick={() => void loadOperationDetails()}><RefreshCw size={16} />{loading ? 'Chargement…' : 'Actualiser'}</Button></>} />
    {contextFailed && <Note tone="danger">Certains dossiers n’ont pas pu être chargés. Actualisez ce dossier avant de poursuivre. Les données déjà affichées peuvent être obsolètes.</Note>}
    {!operation ? <Section id="customs-empty" title={loading ? 'Chargement du dossier douanier…' : 'Dossier douanier indisponible'} icon={Package}><p>{loading ? 'Chargement des dossiers autorisés.' : 'Impossible d’ouvrir ce dossier. Vérifiez la référence et vos droits d’accès, puis actualisez la page.'}</p></Section> : <>
      <Card className="logistics-record-header"><div><span>Préparation d’expédition</span><strong>{shipping?.expedition_lot_number || '—'}</strong></div>
        <div><span>Société minière</span><strong>{shipping?.mining_companies?.name || '—'}</strong></div>
        <div><span>Poids d’or fin</span><strong>{logisticsNumber(shipping?.total_weight_grams)} g</strong></div>
        <FreightStatusBadge status={operation.status} size="lg" />
      </Card>
      <div className="logistics-tabs" role="tablist" aria-label="Sections du dossier douanier">
        {[['overview', 'Vue d’ensemble'], ['lots', 'Lots et poids'], ['documents', `Documents (${documents.length})`], ...(canReadHistory ? [['history', 'Piste d’audit']] : [])].map(([value, label]) =>
          <button type="button" key={value} role="tab" aria-selected={tab === value} aria-controls="customs-tab-panel" id={`customs-tab-${value}`} onClick={() => setTab(value)}>{label}</button>)}
      </div>
      <div className="logistics-form-grid"><div id="customs-tab-panel" role="tabpanel" aria-labelledby={`customs-tab-${tab}`} className="logistics-form-main">
        {tab === 'overview' && <>
          <Section id="customs-information" title="Dédouanement" icon={ShieldCheck}>
            <dl className="logistics-detail-grid"><dt>Bureau de douane</dt><dd>{operation.customs_office || '—'}</dd><dt>Agent des douanes</dt><dd>{operation.customs_officer_name || '—'}</dd>
              <dt>Référence douanière</dt><dd>{operation.customs_reference_number || '—'}</dd><dt>Approuvée le</dt><dd>{logisticsDate(operation.customs_approval_date)}</dd>
              <dt>Destination</dt><dd>{shipping?.destination || '—'}</dd><dt>Expédiée le</dt><dd>{logisticsDate(shipping?.shipped_at)}</dd></dl>
          </Section>
          <Section id="customs-transport" title="Transport et suivi" icon={Package}><dl className="logistics-detail-grid">
            <dt>Lettre de transport aérien (LTA)</dt><dd>{operation.awb_number || '—'}</dd><dt>Numéro de suivi</dt><dd>{operation.tracking_number || '—'}</dd>
            <dt>Contact du transitaire</dt><dd>{operation.freight_forwarder_contact || '—'}</dd><dt>Départ effectif</dt><dd>{logisticsDate(operation.actual_departure_date)}</dd></dl>
          </Section>
          <Section id="customs-observations" title="Instructions et observations" icon={FileText}><p className="whitespace-pre-wrap">{operation.notes || 'Aucune note enregistrée.'}</p></Section>
        </>}
        {tab === 'lots' && <Section id="customs-lots" title="Lots de production" description="Analyses sources et poids d’expédition, sans remplacer les valeurs manquantes par zéro." icon={Package}>
          <div className="overflow-x-auto"><table className="sn-table"><thead><tr><th>Référence du lingot</th><th>Poids brut (g)</th><th>Titre (%)</th><th>Or fin (g)</th><th>Onces troy</th></tr></thead><tbody>
            {(shipping?.items || []).map((item: any) => <tr key={item.id}><td>{item.daily_productions?.bar_reference || '—'}</td><td>{logisticsNumber(item.daily_productions?.bullion_grams)}</td>
              <td>{logisticsNumber(item.daily_productions?.estimated_fineness_pct)}</td><td>{logisticsNumber(item.daily_productions?.pure_gold_grams)}</td><td>{logisticsNumber(item.daily_productions?.estimated_oz)}</td></tr>)}
            {!shipping?.items?.length && <tr><td colSpan={5}>Aucun lot de production n’est disponible dans ce dossier.</td></tr>}
          </tbody></table></div>
        </Section>}
        {tab === 'documents' && <Section id="customs-documents" title="Pièces justificatives" icon={FileText}>
          {!documents.length ? <p>{contextFailed ? 'Impossible de charger les documents.' : 'Aucun document n’a été joint.'}</p> : <ul className="logistics-document-list">
            {documents.map(doc => <li key={doc.id}><FileText aria-hidden="true" /><div><strong>{doc.title}</strong><small>{doc.file_name || FREIGHT_DOCUMENT_LABELS[doc.document_type] || doc.document_type}</small></div>
              <Button type="button" variant="outline" onClick={() => void handleViewDocument(doc)} aria-label={`Ouvrir ${doc.title}`} disabled={!doc.file_path}><Eye size={16} />Consulter</Button>
              {canDeleteDocument && !contextFailed && <Button type="button" variant="outline" onClick={() => void handleDeleteDocument(doc.id)} aria-label={`Supprimer ${doc.title}`}><Trash2 size={16} /></Button>}</li>)}
          </ul>}
        </Section>}
        {tab === 'history' && canReadHistory && <Section id="customs-history" title="Piste d’audit" icon={ShieldCheck}>
          {!history.length ? <p>{contextFailed ? 'Impossible de charger l’historique.' : 'Aucune transition n’a été enregistrée.'}</p> : <ol className="logistics-timeline">
            {history.map(entry => <li key={entry.id}><div>{entry.old_status && <><FreightStatusBadge status={entry.old_status} size="sm" /><ChevronRight size={16} /></>}<FreightStatusBadge status={entry.new_status} size="sm" /></div>
              <p>{entry.user_name || entry.user_email || 'Système'} · {new Date(entry.changed_at).toLocaleString('fr-FR')}</p>{entry.notes && <p>{entry.notes}</p>}</li>)}
          </ol>}
        </Section>}
      </div><Card title="Actions disponibles" className="logistics-summary"><div className="logistics-form-main">
        {canPrepare && operation.status !== 'shipped_to_refinery' && <Button type="button" onClick={() => setShowDocumentModal(true)} disabled={contextFailed}><Upload size={16} />Ajouter un document</Button>}
        {canManageInvoice && operation.status !== 'shipped_to_refinery' && <Button type="button" variant="outline" onClick={() => setShowInvoiceModal(true)} disabled={contextFailed}><FileCheck size={16} />Générer la facture</Button>}
        {transitionAccess?.allowed && <Button type="button" variant="outline" onClick={() => setShowStatusModal(true)} disabled={contextFailed}><ChevronRight size={16} />{nextAction}</Button>}
        <p className="text-sm text-slate-500">Les actions dépendent de l’étape actuelle du circuit, des droits vérifiés et de la séparation des responsabilités. La création d’un dossier ne vaut pas approbation.</p>
      </div></Card></div>
      {showDocumentModal && <AddDocumentModal operationId={operation.id} onClose={() => setShowDocumentModal(false)} onSuccess={handleDocumentAdded} />}
      {showStatusModal && <ChangeStatusModal operation={operation} onClose={() => setShowStatusModal(false)} onSuccess={handleStatusChanged} />}
      {showInvoiceModal && <GenerateInvoiceModal operation={operation} onClose={() => setShowInvoiceModal(false)} onSuccess={handleInvoiceGenerated} />}
      {pdfViewerUrl && selectedDocument && <PDFViewer url={pdfViewerUrl} fileName={selectedDocument.file_name || selectedDocument.title} onClose={() => { setPdfViewerUrl(null); setSelectedDocument(null); }} />}
    </>}
    <ActionErrorDialog isOpen={Boolean(error)} onClose={() => setError(null)} title={error?.title} message={error?.message || ''} recovery={error?.recovery} diagnosticCode={error?.code} actionLabel="Recharger le dossier"
      onAction={() => { setError(null); void loadOperationDetails(); }} />
  </div></NationalDashboardLayout>;
}
