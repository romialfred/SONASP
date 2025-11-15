import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Package, ArrowLeft, FileText, Calendar, Building2,
  User, Clock, MapPin, Weight, Box, Users, FileCheck, Edit,
  CheckCircle, XCircle, History, MapPinned
} from 'lucide-react';
import { Tabs } from '@/components/ui/Tabs';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { SuccessDialog } from '@/components/ui/SuccessDialog';
import { ShippingStatusWorkflowEnhanced } from '@/components/shipping/ShippingStatusWorkflowEnhanced';
import { ShippingStatusHistory, ShippingStatusHistoryEntry } from '@/components/shipping/ShippingStatusHistory';
import { ShippingStatusBadge } from '@/components/shipping/ShippingStatusBadge';
import { DocumentUploadSection } from '@/components/shipping/DocumentUploadSection';
import { AssayCertificateUploadForShipping } from '@/components/shipping/AssayCertificateUploadForShipping';
import { shippingPreparationService, ShippingPreparation, ShippingProductionItem, ShippingSignatory, ShippingDocument } from '@/services/shippingPreparationService';
import { shippingStatusService } from '@/services/shippingStatusService';
import { supabase } from '@/lib/supabase';
import { ShippingStatus } from '@/constants/shippingStatuses';
import { useAuth } from '@/contexts/AuthContext';

interface Refinery {
  id: string;
  name: string;
  location: string;
  country: string;
}

interface FreightCompany {
  id: string;
  name: string;
  address: string | null;
}

interface AssayCertificate {
  id: string;
  shipping_preparation_id: string;
  certificate_number: string | null;
  certificate_date: string | null;
  issuing_laboratory: string | null;
  file_name: string;
  approval_status: string;
  created_at: string;
}

interface StatusHistory {
  id: string;
  old_status: string;
  new_status: string;
  changed_at: string;
  changed_by: string;
  notes: string | null;
  location: string | null;
}

interface ExportLicense {
  id: string;
  license_number: string;
  issue_date: string;
  expiry_date: string;
  issued_by: string;
  total_weight_authorized_grams: number;
  weight_used_grams: number;
  status: string;
}

const statusLabels: Record<string, string> = {
  pending: 'En Attente',
  prepared: 'Préparée',
  validated: 'Validée',
  shipped: 'Expédiée',
  in_transit: 'En Transit',
  received: 'Reçue',
  refining: 'En Raffinage',
  refined: 'Raffinée',
  in_sale: 'En Vente',
  sold: 'Vendue',
  cancelled: 'Annulée'
};

export default function ShippingPreparationDetailsEnhanced() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [preparation, setPreparation] = useState<ShippingPreparation | null>(null);
  const [productionItems, setProductionItems] = useState<ShippingProductionItem[]>([]);
  const [signatories, setSignatories] = useState<ShippingSignatory[]>([]);
  const [documents, setDocuments] = useState<ShippingDocument[]>([]);
  const [certificates, setCertificates] = useState<AssayCertificate[]>([]);
  const [statusHistory, setStatusHistory] = useState<ShippingStatusHistoryEntry[]>([]);
  const [refinery, setRefinery] = useState<Refinery | null>(null);
  const [freightCompany, setFreightCompany] = useState<FreightCompany | null>(null);
  const [license, setLicense] = useState<ExportLicense | null>(null);

  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (id) {
      loadPreparationDetails();
    }
  }, [id]);

  const loadPreparationDetails = async () => {
    try {
      setLoading(true);

      const prep = await shippingPreparationService.getPreparationById(id!);

      if (!prep) {
        setErrorMessage('Préparation non trouvée.');
        setShowError(true);
        setLoading(false);
        return;
      }

      setPreparation(prep);

      const [items, sigs, docs] = await Promise.all([
        shippingPreparationService.getProductionItems(id!),
        shippingPreparationService.getSignatories(id!),
        shippingPreparationService.getDocuments(id!),
      ]);

      setProductionItems(items);
      setSignatories(sigs);
      setDocuments(docs);

      // Load certificates
      const { data: certsData } = await supabase
        .from('assay_certificates')
        .select('*')
        .eq('shipping_preparation_id', id!);

      if (certsData) setCertificates(certsData);

      // Load status history from shipping_status_history
      const historyData = await shippingStatusService.getStatusHistory(id!).catch(() => []);
      setStatusHistory(historyData);

      // Load refinery if ID exists
      if (prep.shipped_to_address) {
        const { data: refineryData } = await supabase
          .from('refineries')
          .select('*')
          .eq('id', prep.shipped_to_address)
          .maybeSingle();

        if (refineryData) setRefinery(refineryData);
      }

      // Load freight company if ID exists
      if (prep.shipped_to_company) {
        const { data: companyData } = await supabase
          .from('transport_companies')
          .select('*')
          .eq('id', prep.shipped_to_company)
          .maybeSingle();

        if (companyData) setFreightCompany(companyData);
      }

      // Load export license if ID exists
      if (prep.export_license_id) {
        const { data: licenseData } = await supabase
          .from('export_licenses')
          .select('*')
          .eq('id', prep.export_license_id)
          .maybeSingle();

        if (licenseData) setLicense(licenseData);
      }

    } catch (error) {
      console.error('Error loading preparation:', error);
      setErrorMessage('Erreur lors du chargement des détails.');
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string, notes?: string) => {
    try {
      await shippingPreparationService.updateStatus(id!, newStatus as any, notes);
      setSuccessMessage('Statut mis à jour avec succès');
      setShowSuccess(true);
      await loadPreparationDetails();
    } catch (error) {
      console.error('Error updating status:', error);
      setErrorMessage('Erreur lors du changement de statut');
      setShowError(true);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-screen">
          <Loading size="lg" />
        </div>
      </MainLayout>
    );
  }

  if (!preparation) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Package className="w-16 h-16 mx-auto mb-4 text-slate-400" />
            <p className="text-slate-600">Préparation non trouvée</p>
            <Button onClick={() => navigate('/shipping/preparation')} className="mt-4">
              Retour
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatShortDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <MainLayout>
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-[1600px] mx-auto p-6">
          <div className="flex gap-6">
            {/* Main Content - Left Side */}
            <div className="flex-1 space-y-6">
              {/* Header */}
              <div className="flex items-center gap-4">
                <Button
                  onClick={() => navigate('/shipping/preparation')}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Retour
                </Button>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl shadow-md">
                    <Package className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-slate-900">Détails de l'Expédition</h1>
                    <p className="text-sm text-slate-500">{preparation.expedition_lot_number}</p>
                  </div>
                </div>
              </div>

              {/* Metric Tiles - Modern Design */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Boxes */}
                <div className="relative overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50/50 to-orange-50/30 p-5">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-full -mr-16 -mt-16" />
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2.5 bg-amber-500/10 rounded-lg">
                        <Box className="w-5 h-5 text-amber-600" />
                      </div>
                      <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Boîtes</span>
                    </div>
                    <p className="text-3xl font-bold text-amber-900">{preparation.total_boxes}</p>
                  </div>
                </div>

                {/* Net Weight */}
                <div className="relative overflow-hidden rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-teal-50/30 p-5">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/10 rounded-full -mr-16 -mt-16" />
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2.5 bg-emerald-500/10 rounded-lg">
                        <Weight className="w-5 h-5 text-emerald-600" />
                      </div>
                      <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Poids Net</span>
                    </div>
                    <p className="text-3xl font-bold text-emerald-900">
                      {preparation.total_net_weight_grams.toFixed(2)}
                      <span className="text-base font-normal text-emerald-600 ml-2">g</span>
                    </p>
                  </div>
                </div>

                {/* Gross Weight */}
                <div className="relative overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 p-5">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400/10 rounded-full -mr-16 -mt-16" />
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2.5 bg-blue-500/10 rounded-lg">
                        <Weight className="w-5 h-5 text-blue-600" />
                      </div>
                      <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Poids Brut</span>
                    </div>
                    <p className="text-3xl font-bold text-blue-900">
                      {preparation.total_gross_weight_grams.toFixed(2)}
                      <span className="text-base font-normal text-blue-600 ml-2">g</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Tabs Content */}
              <Card className="bg-white border-slate-200">
                <Tabs
                  tabs={[
                    { id: 'overview', label: 'Vue d\'ensemble', icon: Package },
                    { id: 'productions', label: 'Productions', icon: Box },
                    { id: 'signatories', label: 'Signataires', icon: Users },
                    { id: 'documents', label: 'Documents', icon: FileText },
                    { id: 'certificates', label: 'Certificats', icon: FileCheck },
                  ]}
                  activeTab={activeTab}
                  onChange={setActiveTab}
                />

                <div className="p-6">
                  {/* Overview Tab */}
                  {activeTab === 'overview' && (
                    <div className="space-y-6">
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <Building2 className="w-5 h-5 text-blue-600" />
                          <h3 className="text-base font-semibold text-slate-900">Informations d'Expédition</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div>
                              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">
                                Raffinerie de Destination
                              </label>
                              <div className="text-sm font-medium text-slate-900">{refinery?.name || 'N/A'}</div>
                              {refinery && (
                                <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                  <MapPin className="w-3 h-3" />
                                  {refinery.location}, {refinery.country}
                                </div>
                              )}
                            </div>

                            <div>
                              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">
                                Compagnie de Fret
                              </label>
                              <div className="text-sm font-medium text-slate-900">{freightCompany?.name || 'N/A'}</div>
                              {freightCompany?.address && (
                                <div className="text-xs text-slate-500 mt-1">{freightCompany.address}</div>
                              )}
                            </div>

                            <div>
                              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">
                                Numéro de Scellé
                              </label>
                              <div className="text-sm font-medium text-slate-900">
                                {preparation.seal_number || 'N/A'}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">
                                Date de Préparation
                              </label>
                              <div className="text-sm font-medium text-slate-900 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-emerald-500" />
                                {formatDate(preparation.prepared_at)}
                              </div>
                            </div>

                            {license && (
                              <div>
                                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">
                                  Licence d'Exportation
                                </label>
                                <div className="text-sm font-medium text-slate-900">
                                  {license.license_number}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                  Émise par: {license.issued_by}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5">
                                  Expire le: {formatDate(license.expiry_date)}
                                </div>
                                <div className="text-xs mt-1">
                                  <span className="text-slate-500">Utilisé: </span>
                                  <span className="font-medium text-slate-900">
                                    {license.weight_used_grams.toFixed(2)} g
                                  </span>
                                  <span className="text-slate-500"> / {license.total_weight_authorized_grams.toFixed(2)} g</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {preparation.notes && (
                          <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-2">
                              Notes
                            </label>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">{preparation.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Productions Tab */}
                  {activeTab === 'productions' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-semibold text-slate-900">Éléments de Production</h3>
                        <span className="text-sm text-slate-500">{productionItems.length} élément(s)</span>
                      </div>

                      {productionItems.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                          <Box className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p className="text-sm">Aucun élément de production</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {productionItems.map((item, index) => (
                            <div key={item.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="bg-amber-100 rounded-lg p-2">
                                    <Box className="w-4 h-4 text-amber-600" />
                                  </div>
                                  <div>
                                    <div className="text-sm font-semibold text-slate-900">
                                      Boîte #{item.ingot_box_number}
                                    </div>
                                    <div className="text-xs text-slate-500">Index: {index + 1}</div>
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                <div>
                                  <div className="text-slate-500 mb-1">Poids Net</div>
                                  <div className="font-semibold text-slate-900">{item.net_weight_grams.toFixed(2)} g</div>
                                </div>
                                <div>
                                  <div className="text-slate-500 mb-1">Poids Brut</div>
                                  <div className="font-semibold text-slate-900">{item.gross_weight_grams.toFixed(2)} g</div>
                                </div>
                                <div>
                                  <div className="text-slate-500 mb-1">Finesse</div>
                                  <div className="font-semibold text-slate-900">{item.fineness_pct.toFixed(2)}%</div>
                                </div>
                                <div>
                                  <div className="text-slate-500 mb-1">Or Pur</div>
                                  <div className="font-semibold text-slate-900">{item.pure_gold_grams.toFixed(2)} g</div>
                                </div>
                              </div>

                              {(item.seal_number_1 || item.seal_number_2) && (
                                <div className="mt-3 pt-3 border-t border-slate-200">
                                  <div className="text-xs text-slate-500">
                                    Scellés: {[item.seal_number_1, item.seal_number_2].filter(Boolean).join(', ')}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Signatories Tab */}
                  {activeTab === 'signatories' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-semibold text-slate-900">Signataires</h3>
                        <span className="text-sm text-slate-500">{signatories.length} signataire(s)</span>
                      </div>

                      {signatories.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p className="text-sm">Aucun signataire</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {signatories.map((signatory) => (
                            <div key={signatory.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                              <div className="flex items-center gap-3">
                                <div className="bg-blue-100 rounded-lg p-2">
                                  <User className="w-4 h-4 text-blue-600" />
                                </div>
                                <div className="flex-1">
                                  <div className="text-sm font-semibold text-slate-900">{signatory.name}</div>
                                  <div className="text-xs text-slate-500">{signatory.position}</div>
                                  {signatory.signed_at && (
                                    <div className="text-xs text-emerald-600 mt-1">
                                      Signé le {formatDate(signatory.signed_at)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Documents Tab */}
                  {activeTab === 'documents' && (
                    <DocumentUploadSection
                      shippingId={id!}
                      documents={documents}
                      onDocumentAdded={loadPreparationDetails}
                      onDocumentDeleted={(docId) => {
                        setDocuments(documents.filter(d => d.id !== docId));
                      }}
                    />
                  )}

                  {/* Certificates Tab */}
                  {activeTab === 'certificates' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-semibold text-slate-900">Certificats d'Analyse</h3>
                        <span className="text-sm text-slate-500">{certificates.length} certificat(s)</span>
                      </div>

                      <AssayCertificateUploadForShipping
                        shippingPreparationId={id!}
                        onUploadComplete={loadPreparationDetails}
                      />

                      {certificates.length > 0 && (
                        <div className="space-y-3 mt-6">
                          {certificates.map((cert) => (
                            <div key={cert.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="bg-teal-100 rounded-lg p-2">
                                    <FileCheck className="w-4 h-4 text-teal-600" />
                                  </div>
                                  <div>
                                    <div className="text-sm font-semibold text-slate-900">
                                      {cert.certificate_number || cert.file_name}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      {cert.issuing_laboratory || 'Laboratoire non spécifié'}
                                    </div>
                                    {cert.certificate_date && (
                                      <div className="text-xs text-slate-500">
                                        Date: {formatDate(cert.certificate_date)}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                                    cert.approval_status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                    cert.approval_status === 'rejected' ? 'bg-red-100 text-red-700' :
                                    'bg-amber-100 text-amber-700'
                                  }`}>
                                    {cert.approval_status === 'approved' ? 'Approuvé' :
                                     cert.approval_status === 'rejected' ? 'Rejeté' :
                                     'En attente'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Right Sidebar - Actions & History */}
            <div className="w-96 space-y-6">
              {/* Status & Actions Panel */}
              <Card className="bg-white border-slate-200 p-5">
                <div className="space-y-4">
                  {/* Current Status */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Statut Actuel</span>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <Package className="w-5 h-5 text-blue-600" />
                      <span className="font-semibold text-blue-900">{statusLabels[preparation.status] || preparation.status}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                      Workflow de Statut
                    </div>
                    <ShippingStatusWorkflowEnhanced
                      shippingId={preparation.id}
                      currentStatus={preparation.status as ShippingStatus}
                      onStatusChanged={loadPreparationDetails}
                      userEmail={user?.email}
                    />
                  </div>

                  {/* Edit Button */}
                  <Button
                    onClick={() => navigate(`/shipping/preparation/${id}/edit`)}
                    variant="outline"
                    className="w-full gap-2 border-slate-300 hover:bg-slate-50"
                    size="sm"
                  >
                    <Edit className="w-4 h-4" />
                    Modifier l'expédition
                  </Button>
                </div>
              </Card>

              {/* History Timeline */}
              <Card className="bg-white border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200">
                  <History className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-semibold text-slate-900">Historique des Changements</h3>
                </div>

                <ShippingStatusHistory
                  history={statusHistory}
                  siteCountry={preparation?.shipped_to_country || undefined}
                />
              </Card>
            </div>
          </div>
        </div>
      </div>

      <ErrorDialog
        isOpen={showError}
        onClose={() => setShowError(false)}
        title="Erreur"
        message={errorMessage}
      />

      <SuccessDialog
        isOpen={showSuccess}
        onClose={() => setShowSuccess(false)}
        title="Succès"
        message={successMessage}
      />
    </MainLayout>
  );
}
