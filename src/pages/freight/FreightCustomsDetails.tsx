import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileText, Upload, Eye, Trash2,
  FileCheck, AlertCircle, ChevronRight
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { PDFViewer } from '@/components/ui/PDFViewer';
import { FreightStatusBadge } from '@/components/freight/FreightStatusBadge';
import { freightCustomsService, FreightCustomsOperation, FreightCustomsDocument } from '@/services/freightCustomsService';
import { useNotification } from '@/contexts/NotificationContext';
import { AddDocumentModal } from '@/components/freight/AddDocumentModal';
import { ChangeStatusModal } from '@/components/freight/ChangeStatusModal';
import { GenerateInvoiceModal } from '@/components/freight/GenerateInvoiceModal';

export default function FreightCustomsDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [operation, setOperation] = useState<FreightCustomsOperation | null>(null);
  const [documents, setDocuments] = useState<FreightCustomsDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<FreightCustomsDocument | null>(null);

  // Function to handle back navigation
  const handleBack = () => {
    navigate(-1);
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
      const data = await freightCustomsService.getOperationById(id);
      setOperation(data);

      if (data) {
        const docs = await freightCustomsService.listDocuments(id);
        setDocuments(docs);
      }
    } catch (error: any) {
      showNotification('error', 'Erreur lors du chargement: ' + error.message);
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
      showNotification('error', 'Erreur lors de l\'ouverture du document: ' + error.message);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) return;

    try {
      await freightCustomsService.deleteDocument(docId);
      showNotification('success', 'Document supprimé');
      loadOperationDetails();
    } catch (error: any) {
      showNotification('error', 'Erreur lors de la suppression: ' + error.message);
    }
  };

  const handleDocumentAdded = () => {
    setShowDocumentModal(false);
    loadOperationDetails();
    showNotification('success', 'Document ajouté avec succès');
  };

  const handleStatusChanged = () => {
    setShowStatusModal(false);
    loadOperationDetails();
    showNotification('success', 'Statut mis à jour');
  };

  const handleInvoiceGenerated = () => {
    setShowInvoiceModal(false);
    loadOperationDetails();
    showNotification('success', 'Facture générée et ajoutée aux documents');
  };

  if (loading) {
    return (
      <MainLayout>
        <Loading />
      </MainLayout>
    );
  }

  if (!operation) {
    return (
      <MainLayout>
        <div className="p-6">
          <Card className="p-12 text-center">
            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Opération non trouvée</h3>
            <p className="text-sm text-gray-600 mb-4">L'opération demandée n'existe pas ou a été supprimée.</p>
            <Button onClick={handleBack}>
              Retour à la liste
            </Button>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const shipping = operation.shipping_preparation;

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{operation.reference_number}</h1>
            <p className="text-sm text-gray-600 mt-1">
              Expédition: {shipping?.reference_number || 'N/A'}
            </p>
          </div>
        </div>
        <FreightStatusBadge status={operation.status} size="lg" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne principale (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Informations Générales */}
          <Card>
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">Informations Générales</h2>
            </div>
            <div className="p-6 grid grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Société Minière</label>
                <p className="text-sm text-gray-900 mt-1 font-medium">
                  {shipping?.mining_companies?.name || '-'}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Date d'Expédition</label>
                <p className="text-sm text-gray-900 mt-1">
                  {shipping?.shipment_date ? new Date(shipping.shipment_date).toLocaleDateString('fr-FR') : '-'}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Poids Total</label>
                <p className="text-sm text-gray-900 mt-1">
                  {shipping?.total_weight_grams?.toLocaleString('fr-FR')} g ({shipping?.total_weight_oz?.toFixed(2)} oz)
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Destination</label>
                <p className="text-sm text-gray-900 mt-1">{shipping?.destination || '-'}</p>
              </div>
            </div>
          </Card>

          {/* Informations Douanières */}
          {(operation.customs_office || operation.customs_officer_name || operation.customs_reference_number) && (
            <Card>
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-900">Informations Douanières</h2>
              </div>
              <div className="p-6 grid grid-cols-2 gap-6">
                {operation.customs_office && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Bureau de Douane</label>
                    <p className="text-sm text-gray-900 mt-1">{operation.customs_office}</p>
                  </div>
                )}
                {operation.customs_officer_name && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Officier de Douane</label>
                    <p className="text-sm text-gray-900 mt-1">{operation.customs_officer_name}</p>
                  </div>
                )}
                {operation.customs_approval_date && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Date d'Approbation</label>
                    <p className="text-sm text-gray-900 mt-1">
                      {new Date(operation.customs_approval_date).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                )}
                {operation.customs_reference_number && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Référence Douane</label>
                    <p className="text-sm text-gray-900 mt-1 font-mono">{operation.customs_reference_number}</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Informations de Transport */}
          {(operation.awb_number || operation.tracking_number || operation.freight_forwarder_contact) && (
            <Card>
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-900">Informations de Transport</h2>
              </div>
              <div className="p-6 grid grid-cols-2 gap-6">
                {operation.awb_number && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">AWB Number</label>
                    <p className="text-sm text-gray-900 mt-1 font-mono font-medium">{operation.awb_number}</p>
                  </div>
                )}
                {operation.tracking_number && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Tracking Number</label>
                    <p className="text-sm text-gray-900 mt-1 font-mono">{operation.tracking_number}</p>
                  </div>
                )}
                {operation.freight_forwarder_contact && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Contact Transitaire</label>
                    <p className="text-sm text-gray-900 mt-1">{operation.freight_forwarder_contact}</p>
                  </div>
                )}
                {operation.actual_departure_date && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Date de Départ</label>
                    <p className="text-sm text-gray-900 mt-1">
                      {new Date(operation.actual_departure_date).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Barres Incluses */}
          {shipping?.items && shipping.items.length > 0 && (
            <Card>
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-900">
                  Barres Incluses ({shipping.items.length})
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-[10px] font-medium text-gray-700 uppercase whitespace-nowrap">
                        Référence
                      </th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-medium text-gray-700 uppercase whitespace-nowrap">
                        Poids (g)
                      </th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-medium text-gray-700 uppercase whitespace-nowrap">
                        Or (%)
                      </th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-medium text-gray-700 uppercase whitespace-nowrap">
                        Or Pur (g)
                      </th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-medium text-gray-700 uppercase whitespace-nowrap">
                        Oz
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {shipping.items.map((item: any) => {
                      const prod = item.daily_productions;
                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-3 py-3 text-xs font-mono text-gray-900">{prod?.bar_reference || '-'}</td>
                          <td className="px-3 py-3 text-xs text-right text-gray-900">
                            {prod?.bullion_grams?.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) || '-'}
                          </td>
                          <td className="px-3 py-3 text-xs text-right text-yellow-700">
                            {prod?.estimated_fineness_pct?.toFixed(2) || '-'}%
                          </td>
                          <td className="px-3 py-3 text-xs text-right text-gray-900">
                            {prod?.pure_gold_grams?.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) || '-'}
                          </td>
                          <td className="px-3 py-3 text-xs text-right font-medium text-emerald-700">
                            {prod?.estimated_oz?.toFixed(2) || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        {/* Panneau latéral (1/3) */}
        <div className="space-y-6">
          {/* Actions Rapides */}
          <Card>
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-base font-semibold text-gray-900">Actions</h2>
            </div>
            <div className="p-4 space-y-2">
              <Button
                onClick={() => setShowDocumentModal(true)}
                className="w-full justify-start bg-blue-600 hover:bg-blue-700"
              >
                <Upload className="w-4 h-4 mr-2" />
                Ajouter un Document
              </Button>
              <Button
                onClick={() => setShowInvoiceModal(true)}
                variant="outline"
                className="w-full justify-start border-green-600 text-green-700 hover:bg-green-50"
              >
                <FileCheck className="w-4 h-4 mr-2" />
                Générer Facture
              </Button>
              <Button
                onClick={() => setShowStatusModal(true)}
                variant="outline"
                className="w-full justify-start"
              >
                <ChevronRight className="w-4 h-4 mr-2" />
                Changer le Statut
              </Button>
            </div>
          </Card>

          {/* Documents */}
          <Card>
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-base font-semibold text-gray-900">
                Documents ({documents.length})
              </h2>
            </div>
            <div className="divide-y divide-gray-200">
              {documents.length === 0 ? (
                <div className="p-6 text-center">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">Aucun document</p>
                </div>
              ) : (
                documents.map((doc) => (
                  <div key={doc.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">{doc.title}</p>
                        <p className="text-[10px] text-gray-500 mt-1">
                          {doc.document_type.replace('_', ' ')}
                        </p>
                        {doc.file_name && (
                          <p className="text-[10px] text-gray-400 mt-0.5 truncate">{doc.file_name}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDocument(doc)}
                          className="h-7 w-7 p-0"
                          title="Voir"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Modals */}
      {showDocumentModal && (
        <AddDocumentModal
          operationId={operation.id}
          onClose={() => setShowDocumentModal(false)}
          onSuccess={handleDocumentAdded}
        />
      )}

      {showStatusModal && (
        <ChangeStatusModal
          operation={operation}
          onClose={() => setShowStatusModal(false)}
          onSuccess={handleStatusChanged}
        />
      )}

      {showInvoiceModal && (
        <GenerateInvoiceModal
          operation={operation}
          onClose={() => setShowInvoiceModal(false)}
          onSuccess={handleInvoiceGenerated}
        />
      )}

      {/* PDF Viewer */}
      {pdfViewerUrl && selectedDocument && (
        <PDFViewer
          url={pdfViewerUrl}
          fileName={selectedDocument.file_name || selectedDocument.title}
          onClose={() => {
            setPdfViewerUrl(null);
            setSelectedDocument(null);
          }}
        />
      )}
      </div>
    </MainLayout>
  );
}
