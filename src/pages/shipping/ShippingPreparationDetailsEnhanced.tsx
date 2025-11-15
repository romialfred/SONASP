import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Package, ArrowLeft, FileText, Calendar, Building2, Truck,
  User, Weight, Box, Users, FileCheck, History
} from 'lucide-react';
import { Tabs } from '@/components/ui/Tabs';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { NotificationDialog } from '@/components/ui/NotificationDialog';
import { ShippingStatusWorkflowEnhanced } from '@/components/shipping/ShippingStatusWorkflowEnhanced';
import { ShippingStatusHistory, ShippingStatusHistoryEntry } from '@/components/shipping/ShippingStatusHistory';
import { ShippingStatusBadge } from '@/components/shipping/ShippingStatusBadge';
import { DocumentUploadSection } from '@/components/shipping/DocumentUploadSection';
import { AssayCertificateUploadForShipping } from '@/components/shipping/AssayCertificateUploadForShipping';
import { shippingPreparationService, ShippingPreparation, ShippingProductionItem, ShippingSignatory, ShippingDocument } from '@/services/shippingPreparationService';
import { supabase } from '@/lib/supabase';
import { ShippingStatus } from '@/constants/shippingStatuses';
import { useAuth } from '@/contexts/AuthContext';

interface Refinery {
  id: string;
  name: string;
  location: string;
  country: string;
}

interface TransportCompany {
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

interface ExportLicense {
  id: string;
  license_number: string;
  issue_date: string;
  end_date: string;
  authorized_quantity_grams: number;
  used_quantity_grams: number;
  status: string;
}

interface MiningCompany {
  id: string;
  name: string;
  code: string;
}

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
  const [transportCompany, setTransportCompany] = useState<TransportCompany | null>(null);
  const [license, setLicense] = useState<ExportLicense | null>(null);
  const [miningCompany, setMiningCompany] = useState<MiningCompany | null>(null);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const returnPath = '/shipping';

  useEffect(() => {
    if (id) {
      loadShippingDetails();
    }
  }, [id]);

  const loadShippingDetails = async (forceRefresh = false) => {
    if (!id) return;

    try {
      setLoading(true);

      if (forceRefresh) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const prep = await shippingPreparationService.getPreparation(id);
      if (!prep) {
        setErrorMessage('Expédition introuvable');
        setShowError(true);
        return;
      }

      setPreparation(prep);

      // Load production items
      const items = await shippingPreparationService.getProductionItems(id);
      setProductionItems(items);

      // Load signatories
      const sigs = await shippingPreparationService.getSignatories(id);
      setSignatories(sigs);

      // Load documents
      const docs = await shippingPreparationService.getDocuments(id);
      setDocuments(docs);

      // Load certificates
      await loadCertificates();

      // Load status history
      await loadStatusHistory(id);

      // Load refinery
      if (prep.refinery_id) {
        const { data: refineryData } = await supabase
          .from('refineries')
          .select('id, name, location, country')
          .eq('id', prep.refinery_id)
          .maybeSingle();
        if (refineryData) setRefinery(refineryData);
      }

      // Load transport company
      if (prep.freight_company_id) {
        const { data: transportData } = await supabase
          .from('freight_companies')
          .select('id, name, address')
          .eq('id', prep.freight_company_id)
          .maybeSingle();
        if (transportData) setTransportCompany(transportData);
      }

      // Load export license
      if (prep.export_license_id) {
        const { data: licenseData } = await supabase
          .from('export_licenses')
          .select('*')
          .eq('id', prep.export_license_id)
          .maybeSingle();
        if (licenseData) setLicense(licenseData);
      }

      // Load mining company
      if (prep.mining_company_id) {
        const { data: companyData } = await supabase
          .from('mining_companies')
          .select('id, name, code')
          .eq('id', prep.mining_company_id)
          .maybeSingle();
        if (companyData) setMiningCompany(companyData);
      }

    } catch (error: any) {
      console.error('Error loading shipping details:', error);
      setErrorMessage(error.message || 'Erreur lors du chargement des détails');
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  const loadStatusHistory = async (shippingId: string) => {
    try {
      const { data, error } = await supabase
        .from('unified_status_history')
        .select(`
          id,
          entity_id,
          old_status,
          new_status,
          changed_by,
          changed_at,
          notes,
          action_description
        `)
        .eq('entity_type', 'shipping')
        .eq('entity_id', shippingId)
        .order('changed_at', { ascending: false });

      if (error) throw error;

      // Fetch user emails
      const historyWithEmails = await Promise.all(
        (data || []).map(async (entry) => {
          if (entry.changed_by) {
            const { data: userData } = await supabase
              .from('users')
              .select('email')
              .eq('id', entry.changed_by)
              .maybeSingle();

            return {
              ...entry,
              changed_by_email: userData?.email || 'Système'
            };
          }
          return { ...entry, changed_by_email: 'Système' };
        })
      );

      setStatusHistory(historyWithEmails);
    } catch (error) {
      console.error('Error loading status history:', error);
      setStatusHistory([]);
    }
  };

  const loadCertificates = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('assay_certificates')
        .select('*')
        .eq('shipping_preparation_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCertificates(data || []);
    } catch (error) {
      console.error('Error loading certificates:', error);
      setCertificates([]);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const calculateTotals = () => {
    const totalNetWeight = productionItems.reduce((sum, item) => sum + (item.net_weight_grams || 0), 0);
    const totalGrossWeight = productionItems.reduce((sum, item) => sum + (item.gross_weight_grams || 0), 0);
    const totalBoxes = productionItems.length;

    return { totalNetWeight, totalGrossWeight, totalBoxes };
  };

  if (loading) {
    return (
      <MainLayout>
        <Loading />
      </MainLayout>
    );
  }

  if (!preparation) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-sm text-gray-600">Expédition introuvable</p>
          <Button onClick={() => navigate(returnPath)} className="mt-4" size="sm">
            Retour à la liste
          </Button>
        </div>
      </MainLayout>
    );
  }

  const { totalNetWeight, totalGrossWeight, totalBoxes } = calculateTotals();

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Header - Refined */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => navigate(returnPath)}
              size="sm"
              className="text-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              Retour
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">
                  Expédition {preparation.expedition_number}
                </h1>
                <ShippingStatusBadge
                  status={preparation.status as ShippingStatus}
                  size="sm"
                  showIcon
                />
              </div>
              <p className="text-xs text-gray-600 mt-0.5 flex items-center gap-1.5">
                <Calendar className="w-3 h-3" />
                {formatDate(preparation.production_date)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate(`/shipping/preparation/${id}/edit`)}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              Modifier
            </Button>
          </div>
        </div>

        {/* Workflow Section - Full Width */}
        <ShippingStatusWorkflowEnhanced
          currentStatus={preparation.status as ShippingStatus}
          statusHistory={statusHistory}
        />

        {/* Tabs Navigation */}
        <Tabs
          tabs={[
            {
              id: 'overview',
              label: 'Vue d\'ensemble',
              icon: Package,
            },
            {
              id: 'productions',
              label: 'Productions',
              icon: Box,
              count: productionItems.length,
            },
            {
              id: 'signatories',
              label: 'Signataires',
              icon: Users,
              count: signatories.length,
            },
            {
              id: 'documents',
              label: 'Documents',
              icon: FileText,
              count: documents.length,
            },
            {
              id: 'certificates',
              label: 'Certificats',
              icon: FileCheck,
              count: certificates.length,
            },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        >
          {(currentTab) => (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left Column - Content based on active tab */}
              <div className="lg:col-span-2 space-y-4">
                {currentTab === 'overview' && (
                  <>
                    {/* Shipping Details Card */}
                    <Card className="p-4">
                      <h3 className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                        Informations d'Expédition
                      </h3>

                      <div className="grid grid-cols-2 gap-3">
                        {/* Raffinerie */}
                        <div className="flex items-start gap-2">
                          <Building2 className="w-4 h-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-xs text-gray-600">Raffinerie de Destination</p>
                            <p className="text-sm font-medium text-gray-900">
                              {refinery?.name || 'Non spécifiée'}
                            </p>
                            {refinery && (
                              <p className="text-xs text-gray-500">
                                {refinery.location}, {refinery.country}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Compagnie de transport */}
                        <div className="flex items-start gap-2">
                          <Truck className="w-4 h-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-xs text-gray-600">Compagnie de Fret</p>
                            <p className="text-sm font-medium text-gray-900">
                              {transportCompany?.name || 'Non spécifiée'}
                            </p>
                          </div>
                        </div>

                        {/* Mining Company */}
                        <div className="flex items-start gap-2">
                          <Building2 className="w-4 h-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-xs text-gray-600">Mining Company</p>
                            <p className="text-sm font-medium text-gray-900">
                              {miningCompany?.name || 'Non spécifiée'}
                            </p>
                          </div>
                        </div>

                        {/* Numéro de scellé */}
                        {preparation.seal_numbers && preparation.seal_numbers.length > 0 && (
                          <div className="flex items-start gap-2">
                            <FileCheck className="w-4 h-4 text-gray-400 mt-0.5" />
                            <div>
                              <p className="text-xs text-gray-600">Numéros de Scellé</p>
                              <p className="text-sm font-medium text-gray-900 font-mono">
                                {preparation.seal_numbers.join(', ')}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Poids et Conversions */}
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h3 className="text-xs font-semibold text-gray-900 mb-3">
                          Poids et Conversions
                        </h3>

                        {/* Totaux */}
                        <div className="space-y-3">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold text-gray-700">Nombre de Boîtes</p>
                              <p className="text-sm font-bold text-gray-900">{totalBoxes}</p>
                            </div>
                          </div>

                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-semibold text-blue-900">Poids Net Total</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <p className="text-xs text-blue-700">Grammes</p>
                                <p className="text-sm font-bold text-blue-900">
                                  {totalNetWeight.toFixed(2)} g
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-blue-700">Onces</p>
                                <p className="text-sm font-bold text-blue-900">
                                  {(totalNetWeight / 31.1035).toFixed(4)} oz
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-semibold text-gray-700">Poids Brut Total</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <p className="text-xs text-gray-600">Grammes</p>
                                <p className="text-sm font-bold text-gray-900">
                                  {totalGrossWeight.toFixed(2)} g
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-600">Onces</p>
                                <p className="text-sm font-bold text-gray-900">
                                  {(totalGrossWeight / 31.1035).toFixed(4)} oz
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* License d'exportation */}
                      {license && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <h3 className="text-xs font-semibold text-gray-900 mb-3">
                            Licence d'Exportation
                          </h3>
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-green-700">Numéro</span>
                                <span className="text-sm font-bold text-green-900 font-mono">
                                  {license.license_number}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-green-700">Date d'émission</span>
                                <span className="text-xs text-green-900">
                                  {formatDate(license.issue_date)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-green-700">Date d'expiration</span>
                                <span className="text-xs text-green-900">
                                  {formatDate(license.end_date)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {preparation.notes && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <h3 className="text-xs font-semibold text-gray-900 mb-1">Notes</h3>
                          <p className="text-xs text-gray-700 whitespace-pre-wrap">
                            {preparation.notes}
                          </p>
                        </div>
                      )}
                    </Card>

                    {/* Status Action Button - Below content */}
                    <div>
                      {/* TODO: Add status action button component here */}
                    </div>
                  </>
                )}

                {currentTab === 'productions' && (
                  <Card className="p-4">
                    <h3 className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                      Productions Incluses
                    </h3>
                    {productionItems.length === 0 ? (
                      <p className="text-xs text-gray-500 text-center py-4">
                        Aucune production incluse
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {productionItems.map((item, index) => (
                          <div
                            key={item.id}
                            className="bg-gray-50 rounded-lg p-3 border border-gray-200"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold text-gray-700">
                                Boîte {index + 1}
                              </span>
                              <span className="text-xs font-mono text-gray-600">
                                {item.box_number || `BOX-${index + 1}`}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <p className="text-xs text-gray-600">Poids Net</p>
                                <p className="text-sm font-medium text-gray-900">
                                  {item.net_weight_grams.toFixed(2)} g
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-600">Poids Brut</p>
                                <p className="text-sm font-medium text-gray-900">
                                  {item.gross_weight_grams.toFixed(2)} g
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )}

                {currentTab === 'signatories' && (
                  <Card className="p-4">
                    <h3 className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                      Signataires
                    </h3>
                    {signatories.length === 0 ? (
                      <p className="text-xs text-gray-500 text-center py-4">
                        Aucun signataire enregistré
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {signatories.map((sig) => (
                          <div
                            key={sig.id}
                            className="bg-gray-50 rounded-lg p-3 border border-gray-200"
                          >
                            <div className="flex items-start gap-2">
                              <User className="w-4 h-4 text-gray-400 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">
                                  {sig.full_name}
                                </p>
                                <p className="text-xs text-gray-600">{sig.title}</p>
                                {sig.organization && (
                                  <p className="text-xs text-gray-500">{sig.organization}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )}

                {currentTab === 'documents' && (
                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        Documents Attachés
                      </h3>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-xs"
                      >
                        Ajouter
                      </Button>
                    </div>
                    <DocumentUploadSection
                      shippingId={id!}
                      documents={documents}
                      onDocumentsChange={(docs) => setDocuments(docs)}
                    />
                  </Card>
                )}

                {currentTab === 'certificates' && (
                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        Certificats d'Essai
                      </h3>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-xs"
                      >
                        Ajouter
                      </Button>
                    </div>
                    {certificates.length === 0 ? (
                      <p className="text-xs text-gray-500 text-center py-4">
                        Aucun certificat téléchargé
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {certificates.map((cert) => (
                          <div
                            key={cert.id}
                            className="bg-gray-50 rounded-lg p-3 border border-gray-200"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-start gap-2">
                                <FileCheck className="w-4 h-4 text-gray-400 mt-0.5" />
                                <div>
                                  <p className="text-sm font-medium text-gray-900">
                                    {cert.file_name}
                                  </p>
                                  {cert.certificate_number && (
                                    <p className="text-xs text-gray-600 font-mono">
                                      {cert.certificate_number}
                                    </p>
                                  )}
                                  <p className="text-xs text-gray-500">
                                    {formatDate(cert.created_at)}
                                  </p>
                                </div>
                              </div>
                              <span className={`text-xs px-2 py-1 rounded ${
                                cert.approval_status === 'approved'
                                  ? 'bg-green-100 text-green-700'
                                  : cert.approval_status === 'rejected'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {cert.approval_status === 'approved' ? 'Approuvé' :
                                 cert.approval_status === 'rejected' ? 'Rejeté' : 'En attente'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )}
              </div>

              {/* Right Column - History - Always visible */}
              <div className="space-y-4">
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200">
                    <History className="w-4 h-4 text-blue-600" />
                    <h2 className="text-sm font-semibold text-gray-900">
                      Historique des Changements
                    </h2>
                  </div>

                  <ShippingStatusHistory
                    history={statusHistory}
                    siteCountry="Guinée"
                  />
                </Card>
              </div>
            </div>
          )}
        </Tabs>
      </div>

      {/* Error Dialog */}
      <ErrorDialog
        isOpen={showError}
        onClose={() => setShowError(false)}
        title="Erreur"
        message={errorMessage}
      />

      {/* Success Dialog */}
      <NotificationDialog
        isOpen={showSuccess}
        onClose={() => setShowSuccess(false)}
        type="success"
        title="Succès"
        message={successMessage}
      />
    </MainLayout>
  );
}
