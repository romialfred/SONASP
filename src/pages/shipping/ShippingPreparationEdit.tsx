import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Package, ArrowLeft, Save, Building2, Truck, FileText, AlertCircle
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { Loading } from '@/components/ui/Loading';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { SuccessDialog } from '@/components/ui/SuccessDialog';
import { shippingPreparationService, ShippingPreparation } from '@/services/shippingPreparationService';
import { ShippingStatus } from '@/constants/shippingStatuses';
import { supabase } from '@/lib/supabase';

interface Refinery {
  id: string;
  name: string;
}

interface FreightCompany {
  id: string;
  name: string;
}

export default function ShippingPreparationEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preparation, setPreparation] = useState<ShippingPreparation | null>(null);
  const [refineries, setRefineries] = useState<Refinery[]>([]);
  const [freightCompanies, setFreightCompanies] = useState<FreightCompany[]>([]);

  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // Form fields
  const [expeditionLotNumber, setExpeditionLotNumber] = useState('');
  const [sealNumber, setSealNumber] = useState('');
  const [selectedRefineryId, setSelectedRefineryId] = useState('');
  const [selectedFreightCompanyId, setSelectedFreightCompanyId] = useState('');
  const [shippedToCountry, setShippedToCountry] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<ShippingStatus>('waiting_for_customs_approval');

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load preparation
      const prep = await shippingPreparationService.getPreparationById(id!);
      if (!prep) {
        setErrorMessage('Préparation non trouvée.');
        setShowError(true);
        return;
      }

      setPreparation(prep);
      setExpeditionLotNumber(prep.expedition_lot_number || '');
      setSealNumber(prep.seal_number || '');
      setSelectedRefineryId(prep.shipped_to_address || '');
      setSelectedFreightCompanyId(prep.shipped_to_company || '');
      setShippedToCountry(prep.shipped_to_country || '');
      setNotes(prep.notes || '');
      setStatus(prep.status);

      // Load refineries
      const { data: refineriesData } = await supabase
        .from('refineries')
        .select('id, name')
        .order('name');
      if (refineriesData) setRefineries(refineriesData);

      // Load freight companies
      const { data: freightData } = await supabase
        .from('transport_companies')
        .select('id, name')
        .order('name');
      if (freightData) setFreightCompanies(freightData);

    } catch (error) {
      console.error('Error loading data:', error);
      setErrorMessage('Erreur lors du chargement des données.');
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!expeditionLotNumber.trim()) {
      setErrorMessage('Le numéro de lot d\'expédition est requis.');
      setShowError(true);
      return;
    }

    try {
      setSaving(true);

      const updates = {
        expedition_lot_number: expeditionLotNumber.trim(),
        seal_number: sealNumber.trim() || null,
        shipped_to_address: selectedRefineryId || null,
        shipped_to_company: selectedFreightCompanyId || null,
        shipped_to_country: shippedToCountry.trim() || null,
        notes: notes.trim() || null,
        status,
      };

      const { error } = await supabase
        .from('shipping_preparations')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setShowSuccess(true);
      setTimeout(() => {
        navigate(`/shipping/preparations/${id}/details`);
      }, 1500);

    } catch (error: any) {
      console.error('Error updating preparation:', error);
      setErrorMessage('Erreur lors de la mise à jour: ' + (error.message || 'Erreur inconnue'));
      setShowError(true);
    } finally {
      setSaving(false);
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

  return (
    <MainLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between bg-white rounded-xl shadow-sm p-4 border border-gray-200">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => navigate(`/shipping/preparations/${id}/details`)}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Retour
              </Button>
              <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md">
                <Package className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Modifier l'Expédition</h1>
                <p className="text-sm text-gray-600 font-mono">{preparation.expedition_lot_number || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Main Information Card */}
            <Card className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                Informations Principales
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Numéro de Lot d'Expédition <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={expeditionLotNumber}
                    onChange={(e) => setExpeditionLotNumber(e.target.value)}
                    placeholder="Ex: SHIP-2025-001"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Numéro de Scellé
                  </label>
                  <Input
                    value={sealNumber}
                    onChange={(e) => setSealNumber(e.target.value)}
                    placeholder="Ex: SEAL-12345"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Statut
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ShippingStatus)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="waiting_for_customs_approval">En Attente Douane</option>
                    <option value="approved_by_customs">Douane Approuvée</option>
                    <option value="ready_for_expedition">Prêt pour Expédition</option>
                  </select>
                </div>
              </div>
            </Card>

            {/* Destination Card */}
            <Card className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-600" />
                Destination
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Raffinerie de Destination
                  </label>
                  <select
                    value={selectedRefineryId}
                    onChange={(e) => setSelectedRefineryId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Sélectionner une raffinerie</option>
                    {refineries.map((refinery) => (
                      <option key={refinery.id} value={refinery.id}>
                        {refinery.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pays de Destination
                  </label>
                  <Input
                    value={shippedToCountry}
                    onChange={(e) => setShippedToCountry(e.target.value)}
                    placeholder="Ex: United Arab Emirates"
                  />
                </div>
              </div>
            </Card>

            {/* Transport Card */}
            <Card className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600" />
                Transport
              </h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Compagnie de Fret
                </label>
                <select
                  value={selectedFreightCompanyId}
                  onChange={(e) => setSelectedFreightCompanyId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Sélectionner une compagnie</option>
                  {freightCompanies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>
            </Card>

            {/* Notes Card */}
            <Card className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-600" />
                Notes
              </h2>
              <TextArea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ajoutez des notes ou commentaires..."
                rows={4}
              />
            </Card>

            {/* Info Notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">Note Importante</p>
                <p>
                  Les modifications des productions, signataires et documents se font directement depuis la page de détails.
                  Seules les informations générales peuvent être modifiées ici.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/shipping/preparations/${id}/details`)}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="gap-2 bg-blue-600 hover:bg-blue-700"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Enregistrer
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>

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
        message="L'expédition a été mise à jour avec succès!"
      />
    </MainLayout>
  );
}
