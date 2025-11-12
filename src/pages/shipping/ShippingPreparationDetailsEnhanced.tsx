import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Package, ArrowLeft, FileText, Calendar, Building2, Truck,
  User, CheckCircle, Clock, MapPin, Weight, Box, FolderOpen, Edit, Upload, Eye, Download, X
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { SuccessDialog } from '@/components/ui/SuccessDialog';
import { Modal } from '@/components/ui/Modal';
import { shippingPreparationService, ShippingPreparation, ShippingProductionItem, ShippingSignatory, ShippingDocument } from '@/services/shippingPreparationService';
import { AssayCertificateUploadForShipping } from '@/components/shipping/AssayCertificateUploadForShipping';
import { supabase } from '@/lib/supabase';

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

export default function ShippingPreparationDetailsEnhanced() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [preparation, setPreparation] = useState<ShippingPreparation | null>(null);
  const [productionItems, setProductionItems] = useState<ShippingProductionItem[]>([]);
  const [signatories, setSignatories] = useState<ShippingSignatory[]>([]);
  const [documents, setDocuments] = useState<ShippingDocument[]>([]);
  const [refinery, setRefinery] = useState<Refinery | null>(null);
  const [freightCompany, setFreightCompany] = useState<FreightCompany | null>(null);

  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const [activeTab, setActiveTab] = useState('overview');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

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
          .from('freight_companies')
          .select('*')
          .eq('id', prep.shipped_to_company)
          .maybeSingle();

        if (companyData) setFreightCompany(companyData);
      }

    } catch (error) {
      console.error('Error loading preparation:', error);
      setErrorMessage('Erreur lors du chargement des détails.');
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    navigate(`/shipping/preparation/${id}/edit`);
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
            <Package className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">Préparation non trouvée</p>
            <Button onClick={() => navigate('/shipping/preparation')} className="mt-4">
              Retour
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  const statusConfig = {
    pending: { label: 'En Attente', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: Clock },
    prepared: { label: 'Préparée', color: 'bg-blue-100 text-blue-800 border-blue-300', icon: CheckCircle },
    shipped: { label: 'Expédiée', color: 'bg-green-100 text-green-800 border-green-300', icon: CheckCircle },
  };

  const currentStatus = statusConfig[preparation.status as keyof typeof statusConfig] || statusConfig.pending;
  const StatusIcon = currentStatus.icon;

  return (
    <MainLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between bg-white rounded-xl shadow-sm p-4 border border-gray-200">
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
              <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-md">
                <Package className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Détails de l'Expédition</h1>
                <p className="text-sm text-gray-600 font-mono">{preparation.expedition_lot_number || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setShowUploadModal(true)}
                variant="outline"
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                Upload Certificat
              </Button>
              <Button
                onClick={handleEdit}
                className="gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <Edit className="w-4 h-4" />
                Modifier
              </Button>
            </div>
          </div>

          {/* Status and Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Status */}
            <Card className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-5 h-5 text-gray-500" />
                <span className="text-sm font-medium text-gray-600">Statut</span>
              </div>
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 font-semibold ${currentStatus.color}`}>
                <StatusIcon className="w-5 h-5" />
                {currentStatus.label}
              </div>
            </Card>

            {/* Total Boxes */}
            <Card className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-3">
                <Box className="w-5 h-5 text-amber-600" />
                <span className="text-sm font-medium text-gray-600">Boîtes</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{preparation.total_boxes || 0}</p>
            </Card>

            {/* Net Weight */}
            <Card className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-3">
                <Weight className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-gray-600">Poids Net</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{preparation.total_net_weight_grams.toFixed(2)} g</p>
            </Card>

            {/* Gross Weight */}
            <Card className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-3">
                <Weight className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-gray-600">Poids Brut</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{preparation.total_gross_weight_grams.toFixed(2)} g</p>
            </Card>
          </div>

          {/* Tabs Navigation */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="flex border-b border-gray-200">
              {[
                { id: 'overview', label: 'Vue d\'ensemble', icon: Package },
                { id: 'productions', label: 'Productions', icon: Box },
                { id: 'signatories', label: 'Signataires', icon: User },
                { id: 'documents', label: 'Documents', icon: FolderOpen },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 px-6 py-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                      activeTab === tab.id
                        ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="p-6">
              {/* Tab Content: Overview */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <Card className="p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-blue-600" />
                      Informations d'Expédition
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                          <Building2 className="w-5 h-5 text-amber-600 mt-1" />
                          <div>
                            <p className="text-sm font-medium text-gray-600">Raffinerie de Destination</p>
                            <p className="text-base font-semibold text-gray-900">{refinery?.name || 'N/A'}</p>
                            {refinery && (
                              <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                                <MapPin className="w-3 h-3" />
                                {refinery.location}, {refinery.country}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                          <Truck className="w-5 h-5 text-blue-600 mt-1" />
                          <div>
                            <p className="text-sm font-medium text-gray-600">Compagnie de Fret</p>
                            <p className="text-base font-semibold text-gray-900">{freightCompany?.name || 'N/A'}</p>
                            {freightCompany?.address && (
                              <p className="text-sm text-gray-600 mt-1">{freightCompany.address}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                          <Calendar className="w-5 h-5 text-green-600 mt-1" />
                          <div>
                            <p className="text-sm font-medium text-gray-600">Date de Préparation</p>
                            <p className="text-base font-semibold text-gray-900">
                              {preparation.prepared_at
                                ? new Date(preparation.prepared_at).toLocaleDateString('fr-FR', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : 'Non préparée'}
                            </p>
                          </div>
                        </div>

                        {preparation.shipped_at && (
                          <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                            <Calendar className="w-5 h-5 text-purple-600 mt-1" />
                            <div>
                              <p className="text-sm font-medium text-gray-600">Date d'Expédition</p>
                              <p className="text-base font-semibold text-gray-900">
                                {new Date(preparation.shipped_at).toLocaleDateString('fr-FR', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {preparation.notes && (
                      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm font-medium text-blue-900 mb-2">Notes</p>
                        <p className="text-sm text-blue-800">{preparation.notes}</p>
                      </div>
                    )}
                  </Card>
                </div>
              )}

              {/* Tab Content: Productions */}
              {activeTab === 'productions' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <Box className="w-5 h-5 text-blue-600" />
                      Productions ({productionItems.length})
                    </h2>
                  </div>
                  {productionItems.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Box className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>Aucune production ajoutée</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {productionItems.map((item, index) => (
                        <Card key={item.id} className="p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <span className="text-blue-600 font-bold">{index + 1}</span>
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">{item.ingot_box_number}</p>
                                <p className="text-sm text-gray-600">
                                  Fineness: {item.fineness_pct}% | Or Pur: {item.pure_gold_grams.toFixed(2)}g
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-gray-600">Net: <span className="font-semibold text-gray-900">{item.net_weight_grams.toFixed(2)}g</span></p>
                              <p className="text-sm text-gray-600">Brut: <span className="font-semibold text-gray-900">{item.gross_weight_grams.toFixed(2)}g</span></p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab Content: Signatories */}
              {activeTab === 'signatories' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <User className="w-5 h-5 text-blue-600" />
                      Signataires ({signatories.length})
                    </h2>
                  </div>
                  {signatories.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>Aucun signataire ajouté</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {signatories.map((signatory) => (
                        <Card key={signatory.id} className="p-5 hover:shadow-md transition-shadow">
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                              <User className="w-6 h-6 text-blue-600" />
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">{signatory.name}</p>
                              <p className="text-sm text-gray-600">{signatory.position}</p>
                              {signatory.signed_at && (
                                <p className="text-xs text-green-600 mt-1">
                                  ✓ Signé le {new Date(signatory.signed_at).toLocaleDateString('fr-FR')}
                                </p>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab Content: Documents */}
              {activeTab === 'documents' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <FolderOpen className="w-5 h-5 text-blue-600" />
                      Documents ({documents.length})
                    </h2>
                    <Button
                      onClick={() => setShowUploadModal(true)}
                      size="sm"
                      className="gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      Upload Certificat
                    </Button>
                  </div>
                  {documents.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>Aucun document uploadé</p>
                      <Button
                        onClick={() => setShowUploadModal(true)}
                        variant="outline"
                        size="sm"
                        className="mt-4 gap-2"
                      >
                        <Upload className="w-4 h-4" />
                        Upload Certificat
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {documents.map((doc) => (
                        <Card key={doc.id} className="p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <FileText className="w-5 h-5 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">{doc.title}</p>
                                <p className="text-sm text-gray-600">{doc.file_name}</p>
                                {doc.file_size && (
                                  <p className="text-xs text-gray-500">
                                    {(doc.file_size / 1024).toFixed(2)} KB
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                onClick={() => window.open(doc.document_url, '_blank')}
                                variant="outline"
                                size="sm"
                                className="gap-2"
                              >
                                <Eye className="w-4 h-4" />
                                Voir
                              </Button>
                              <Button
                                onClick={() => {
                                  const a = document.createElement('a');
                                  a.href = doc.document_url;
                                  a.download = doc.file_name;
                                  a.click();
                                }}
                                variant="outline"
                                size="sm"
                                className="gap-2"
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload Assay Certificate"
        size="lg"
      >
        <AssayCertificateUploadForShipping
          shippingPreparationId={id!}
          onUploadComplete={() => {
            setShowUploadModal(false);
            loadPreparationDetails();
            setSuccessMessage('Certificat uploadé avec succès!');
            setShowSuccess(true);
          }}
        />
      </Modal>

      {/* Error Dialog */}
      <ErrorDialog
        isOpen={showError}
        onClose={() => setShowError(false)}
        title="Erreur"
        message={errorMessage}
      />

      {/* Success Dialog */}
      <SuccessDialog
        isOpen={showSuccess}
        onClose={() => setShowSuccess(false)}
        title="Succès"
        message={successMessage}
      />
    </MainLayout>
  );
}
