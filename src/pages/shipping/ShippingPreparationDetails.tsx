import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Package, ArrowLeft, Download, FileText, Calendar, Building2, Truck,
  User, CheckCircle, Clock, MapPin, Weight, Box, Printer
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { shippingPreparationService, ShippingPreparation, ShippingProductionItem, ShippingSignatory, ShippingDocument } from '@/services/shippingPreparationService';
import { supabase } from '@/lib/supabase';

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

export default function ShippingPreparationDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [preparation, setPreparation] = useState<ShippingPreparation | null>(null);
  const [productionItems, setProductionItems] = useState<ShippingProductionItem[]>([]);
  const [signatories, setSignatories] = useState<ShippingSignatory[]>([]);
  const [documents, setDocuments] = useState<ShippingDocument[]>([]);
  const [refinery, setRefinery] = useState<Refinery | null>(null);
  const [transportCompany, setTransportCompany] = useState<TransportCompany | null>(null);

  useEffect(() => {
    if (id) {
      loadPreparationDetails();
    }
  }, [id]);

  const loadPreparationDetails = async () => {
    try {
      setLoading(true);

      console.log('Loading preparation with ID:', id);
      const prep = await shippingPreparationService.getPreparationById(id!);
      console.log('Preparation loaded:', prep);

      if (!prep) {
        console.error('Preparation not found for ID:', id);
        alert('Préparation non trouvée');
        navigate('/shipping/preparation');
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

      if (prep.shipped_to_address) {
        const { data: refineryData } = await supabase
          .from('refineries')
          .select('*')
          .eq('id', prep.shipped_to_address)
          .maybeSingle();

        if (refineryData) setRefinery(refineryData);
      }

      if (prep.shipped_to_company) {
        const { data: companyData } = await supabase
          .from('transport_companies')
          .select('*')
          .eq('id', prep.shipped_to_company)
          .maybeSingle();

        if (companyData) setTransportCompany(companyData);
      }

    } catch (error) {
      console.error('Error loading preparation:', error);
      alert('Erreur lors du chargement des détails');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPackingList = () => {
    alert('Téléchargement du Packing List - Fonctionnalité à implémenter');
  };

  const handlePrint = () => {
    window.print();
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
    pending: { label: 'En Attente', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
    prepared: { label: 'Préparée', color: 'bg-blue-100 text-blue-800 border-blue-300' },
    shipped: { label: 'Expédiée', color: 'bg-green-100 text-green-800 border-green-300' },
  };

  const currentStatus = statusConfig[preparation.status] || statusConfig.pending;

  return (
    <MainLayout>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
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
              <div className="p-3 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-xl shadow-lg">
                <Package className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Détails de l'Expédition</h1>
                <p className="text-sm text-gray-600">{preparation.expedition_lot_number}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handlePrint}
                variant="outline"
                className="gap-2"
              >
                <Printer className="w-4 h-4" />
                Imprimer
              </Button>
              <Button
                onClick={handleDownloadPackingList}
                className="gap-2 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white"
              >
                <Download className="w-4 h-4" />
                Packing List
              </Button>
            </div>
          </div>

          {/* Status and Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Status */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-gray-500" />
                <span className="text-sm font-medium text-gray-600">Statut</span>
              </div>
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 font-semibold ${currentStatus.color}`}>
                <CheckCircle className="w-4 h-4" />
                {currentStatus.label}
              </div>
            </Card>

            {/* Total Boxes */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Box className="w-5 h-5 text-yellow-600" />
                <span className="text-sm font-medium text-gray-600">Boîtes</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{preparation.total_boxes}</p>
            </Card>

            {/* Net Weight */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Weight className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-gray-600">Poids Net</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{preparation.total_net_weight_grams.toFixed(2)} g</p>
            </Card>

            {/* Gross Weight */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Weight className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-gray-600">Poids Brut</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{preparation.total_gross_weight_grams.toFixed(2)} g</p>
            </Card>
          </div>

          {/* Expedition Info */}
          <Card className="p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Informations d'Expédition</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Building2 className="w-5 h-5 text-yellow-600 mt-1" />
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

                <div className="flex items-start gap-3">
                  <Truck className="w-5 h-5 text-blue-600 mt-1" />
                  <div>
                    <p className="text-sm font-medium text-gray-600">Compagnie de Fret</p>
                    <p className="text-base font-semibold text-gray-900">{transportCompany?.name || 'N/A'}</p>
                    {transportCompany?.address && (
                      <p className="text-sm text-gray-600">{transportCompany.address}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-green-600 mt-1" />
                  <div>
                    <p className="text-sm font-medium text-gray-600">Date de Préparation</p>
                    <p className="text-base font-semibold text-gray-900">
                      {preparation.prepared_at
                        ? new Date(preparation.prepared_at).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : 'N/A'}
                    </p>
                  </div>
                </div>

                {preparation.shipped_at && (
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-blue-600 mt-1" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">Date d'Expédition</p>
                      <p className="text-base font-semibold text-gray-900">
                        {new Date(preparation.shipped_at).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Production Items */}
          <Card className="p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Productions Incluses</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-700 to-gray-800 text-white">
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase">#</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase">Ingot/Box</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase">Net (g)</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase">Brut (g)</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase">Fineness %</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase">Seal 1</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase">Seal 2</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {productionItems.map((item, index) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-600">{index + 1}</td>
                      <td className="px-4 py-3 text-sm font-mono font-semibold">{item.ingot_box_number}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-yellow-800">{item.net_weight_grams.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold">{item.gross_weight_grams.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-right">{item.fineness_pct.toFixed(2)}%</td>
                      <td className="px-4 py-3 text-sm font-mono text-blue-900">{item.seal_number_1 || '-'}</td>
                      <td className="px-4 py-3 text-sm font-mono text-blue-700">{item.seal_number_2 || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Signatories */}
          {signatories.length > 0 && (
            <Card className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Signataires</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {signatories.map((signatory, index) => (
                  <div key={signatory.id} className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <User className="w-5 h-5 text-yellow-600 mt-1" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-600">{signatory.position}</p>
                      <p className="text-base font-semibold text-gray-900">{signatory.name}</p>
                      {signatory.signed_at && (
                        <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                          <CheckCircle className="w-3 h-3" />
                          Signé le {new Date(signatory.signed_at).toLocaleDateString('fr-FR')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Documents */}
          {documents.length > 0 && (
            <Card className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Documents de Support</h2>
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-yellow-600" />
                      <div>
                        <p className="font-semibold text-gray-900">{doc.title}</p>
                        <p className="text-sm text-gray-600">{doc.file_name}</p>
                      </div>
                    </div>
                    <Button
                      onClick={() => window.open(doc.document_url, '_blank')}
                      variant="outline"
                      size="sm"
                      className="gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Télécharger
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Notes */}
          {preparation.notes && (
            <Card className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Notes</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{preparation.notes}</p>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
