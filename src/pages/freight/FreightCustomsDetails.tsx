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
      showNotification('error', 'Unable to open the document: ' + error.message);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('Delete this document? This action removes it from the customs file.')) return;

    try {
      await freightCustomsService.deleteDocument(docId);
      showNotification('success', 'Document deleted');
      loadOperationDetails();
    } catch (error: any) {
      showNotification('error', 'Unable to delete the document: ' + error.message);
    }
  };

  const handleDocumentAdded = () => {
    setShowDocumentModal(false);
    loadOperationDetails();
    showNotification('success', 'Document added');
  };

  const handleStatusChanged = () => {
    setShowStatusModal(false);
    loadOperationDetails();
    showNotification('success', 'Workflow status updated');
  };

  const handleInvoiceGenerated = () => {
    setShowInvoiceModal(false);
    loadOperationDetails();
    showNotification('success', 'Invoice generated and added to the documents');
  };

  const shipping = operation?.shipping_preparation;
  const transitionAccess = operation ? getFreightTransitionAccess(user, operation) : null;
  const canDeleteDocument = canPrepare && (operation?.status === 'customs_pending' || operation?.status === 'ready_for_expedition');
  const nextAction = operation?.status === 'customs_pending' ? 'Review customs approval'
    : operation?.status === 'customs_approved' ? 'Prepare transport' : 'Authorise dispatch';
  return <NationalDashboardLayout><div className="sn-page logistics-workspace">
    <PageHeader title={operation?.reference_number || 'Customs operation'} subtitle="Shipment clearance, documents and traceable authorisations." icon={ShieldCheck}
      breadcrumb={[{ label: 'Shipments', to: '/shipping/preparation' }, { label: 'Customs & consignment', to: '/freight-customs' }, { label: operation?.reference_number || 'Details' }]}
      actions={<><Button type="button" variant="outline" onClick={handleBack}><ArrowLeft size={16} />Back to operations</Button><Button type="button" variant="outline" disabled={loading} onClick={() => void loadOperationDetails()}><RefreshCw size={16} />{loading ? 'Loading…' : 'Refresh'}</Button></>} />
    {contextFailed && <Note tone="danger">Some records could not be loaded. Refresh this file before proceeding. Previously loaded data may be out of date.</Note>}
    {!operation ? <Section id="customs-empty" title={loading ? 'Loading customs file…' : 'Customs file unavailable'} icon={Package}><p>{loading ? 'Retrieving the authorised records.' : 'This record could not be opened. Check the reference and your access, then refresh.'}</p></Section> : <>
      <Card className="logistics-record-header"><div><span>Shipment preparation</span><strong>{shipping?.expedition_lot_number || '—'}</strong></div>
        <div><span>Mining company</span><strong>{shipping?.mining_companies?.name || '—'}</strong></div>
        <div><span>Fine gold weight</span><strong>{logisticsNumber(shipping?.total_weight_grams)} g</strong></div>
        <FreightStatusBadge status={operation.status} size="lg" />
      </Card>
      <div className="logistics-tabs" role="tablist" aria-label="Customs file sections">
        {[['overview', 'Overview'], ['lots', 'Lots & weights'], ['documents', `Documents (${documents.length})`], ...(canReadHistory ? [['history', 'Audit trail']] : [])].map(([value, label]) =>
          <button type="button" key={value} role="tab" aria-selected={tab === value} aria-controls="customs-tab-panel" id={`customs-tab-${value}`} onClick={() => setTab(value)}>{label}</button>)}
      </div>
      <div className="logistics-form-grid"><div id="customs-tab-panel" role="tabpanel" aria-labelledby={`customs-tab-${tab}`} className="logistics-form-main">
        {tab === 'overview' && <>
          <Section id="customs-information" title="Customs clearance" icon={ShieldCheck}>
            <dl className="logistics-detail-grid"><dt>Customs office</dt><dd>{operation.customs_office || '—'}</dd><dt>Customs officer</dt><dd>{operation.customs_officer_name || '—'}</dd>
              <dt>Customs reference</dt><dd>{operation.customs_reference_number || '—'}</dd><dt>Approved on</dt><dd>{logisticsDate(operation.customs_approval_date)}</dd>
              <dt>Destination</dt><dd>{shipping?.destination || '—'}</dd><dt>Dispatched on</dt><dd>{logisticsDate(shipping?.shipped_at)}</dd></dl>
          </Section>
          <Section id="customs-transport" title="Transport & tracking" icon={Package}><dl className="logistics-detail-grid">
            <dt>Air waybill (AWB)</dt><dd>{operation.awb_number || '—'}</dd><dt>Tracking number</dt><dd>{operation.tracking_number || '—'}</dd>
            <dt>Freight forwarder contact</dt><dd>{operation.freight_forwarder_contact || '—'}</dd><dt>Actual departure</dt><dd>{logisticsDate(operation.actual_departure_date)}</dd></dl>
          </Section>
          <Section id="customs-observations" title="Instructions & observations" icon={FileText}><p className="whitespace-pre-wrap">{operation.notes || 'No notes recorded.'}</p></Section>
        </>}
        {tab === 'lots' && <Section id="customs-lots" title="Production lots" description="Source assays and shipment weights, without replacing missing values with zero." icon={Package}>
          <div className="overflow-x-auto"><table className="sn-table"><thead><tr><th>Bar reference</th><th>Gross weight (g)</th><th>Fineness (%)</th><th>Fine gold (g)</th><th>Troy ounces</th></tr></thead><tbody>
            {(shipping?.items || []).map((item: any) => <tr key={item.id}><td>{item.daily_productions?.bar_reference || '—'}</td><td>{logisticsNumber(item.daily_productions?.bullion_grams)}</td>
              <td>{logisticsNumber(item.daily_productions?.estimated_fineness_pct)}</td><td>{logisticsNumber(item.daily_productions?.pure_gold_grams)}</td><td>{logisticsNumber(item.daily_productions?.estimated_oz)}</td></tr>)}
            {!shipping?.items?.length && <tr><td colSpan={5}>No production lots are available in this file.</td></tr>}
          </tbody></table></div>
        </Section>}
        {tab === 'documents' && <Section id="customs-documents" title="Supporting documents" icon={FileText}>
          {!documents.length ? <p>{contextFailed ? 'Documents could not be loaded.' : 'No documents have been attached.'}</p> : <ul className="logistics-document-list">
            {documents.map(doc => <li key={doc.id}><FileText aria-hidden="true" /><div><strong>{doc.title}</strong><small>{doc.file_name || doc.document_type.replaceAll('_', ' ')}</small></div>
              <Button type="button" variant="outline" onClick={() => void handleViewDocument(doc)} aria-label={`Open ${doc.title}`} disabled={!doc.file_path}><Eye size={16} />View</Button>
              {canDeleteDocument && !contextFailed && <Button type="button" variant="outline" onClick={() => void handleDeleteDocument(doc.id)} aria-label={`Delete ${doc.title}`}><Trash2 size={16} /></Button>}</li>)}
          </ul>}
        </Section>}
        {tab === 'history' && canReadHistory && <Section id="customs-history" title="Audit trail" icon={ShieldCheck}>
          {!history.length ? <p>{contextFailed ? 'History could not be loaded.' : 'No transitions have been recorded.'}</p> : <ol className="logistics-timeline">
            {history.map(entry => <li key={entry.id}><div>{entry.old_status && <><FreightStatusBadge status={entry.old_status} size="sm" /><ChevronRight size={16} /></>}<FreightStatusBadge status={entry.new_status} size="sm" /></div>
              <p>{entry.user_name || entry.user_email || 'System'} · {new Date(entry.changed_at).toLocaleString('en-GB')}</p>{entry.notes && <p>{entry.notes}</p>}</li>)}
          </ol>}
        </Section>}
      </div><Card title="Available actions" className="logistics-summary"><div className="logistics-form-main">
        {canPrepare && operation.status !== 'shipped_to_refinery' && <Button type="button" onClick={() => setShowDocumentModal(true)} disabled={contextFailed}><Upload size={16} />Add document</Button>}
        {canManageInvoice && operation.status !== 'shipped_to_refinery' && <Button type="button" variant="outline" onClick={() => setShowInvoiceModal(true)} disabled={contextFailed}><FileCheck size={16} />Generate invoice</Button>}
        {transitionAccess?.allowed && <Button type="button" variant="outline" onClick={() => setShowStatusModal(true)} disabled={contextFailed}><ChevronRight size={16} />{nextAction}</Button>}
        <p className="text-sm text-slate-500">Actions depend on the current workflow, verified permissions and separation of duties. Creating a file does not approve it.</p>
      </div></Card></div>
      {showDocumentModal && <AddDocumentModal operationId={operation.id} onClose={() => setShowDocumentModal(false)} onSuccess={handleDocumentAdded} />}
      {showStatusModal && <ChangeStatusModal operation={operation} onClose={() => setShowStatusModal(false)} onSuccess={handleStatusChanged} />}
      {showInvoiceModal && <GenerateInvoiceModal operation={operation} onClose={() => setShowInvoiceModal(false)} onSuccess={handleInvoiceGenerated} />}
      {pdfViewerUrl && selectedDocument && <PDFViewer url={pdfViewerUrl} fileName={selectedDocument.file_name || selectedDocument.title} onClose={() => { setPdfViewerUrl(null); setSelectedDocument(null); }} />}
    </>}
    <ActionErrorDialog isOpen={Boolean(error)} onClose={() => setError(null)} title={error?.title} message={error?.message || ''} recovery={error?.recovery} diagnosticCode={error?.code} actionLabel="Reload file"
      onAction={() => { setError(null); void loadOperationDetails(); }} />
  </div></NationalDashboardLayout>;
}
