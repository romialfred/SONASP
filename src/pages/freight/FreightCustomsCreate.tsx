import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Package, AlertCircle } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { TextArea } from '@/components/ui/TextArea';
import { Loading } from '@/components/ui/Loading';
import { freightCustomsService } from '@/services/freightCustomsService';
import { useNotification } from '@/contexts/NotificationContext';
import { supabase } from '@/lib/supabase';

interface ShippingPreparation {
  id: string;
  reference_number: string;
  total_weight_grams: number;
  total_weight_oz: number;
  mining_company_id: string;
  status: string;
  mining_companies?: {
    id: string;
    name: string;
  };
}

export default function FreightCustomsCreate() {
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [shippedExpeditions, setShippedExpeditions] = useState<ShippingPreparation[]>([]);
  const [selectedExpeditionId, setSelectedExpeditionId] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadShippedExpeditions();
  }, []);

  const loadShippedExpeditions = async () => {
    try {
      setLoading(true);

      // Charger les expéditions avec statut "shipped"
      const { data, error } = await supabase
        .from('shipping_preparations')
        .select(`
          id,
          reference_number,
          total_weight_grams,
          total_weight_oz,
          mining_company_id,
          status,
          mining_companies:mining_company_id (
            id,
            name
          )
        `)
        .eq('status', 'shipped')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filtrer celles qui n'ont pas déjà d'opération freight customs
      const expeditionsWithoutOperation: ShippingPreparation[] = [];

      for (const expedition of data || []) {
        const { data: existingOp } = await supabase
          .from('freight_customs_operations')
          .select('id')
          .eq('shipping_preparation_id', expedition.id)
          .single();

        if (!existingOp) {
          expeditionsWithoutOperation.push(expedition as ShippingPreparation);
        }
      }

      setShippedExpeditions(expeditionsWithoutOperation);

      if (expeditionsWithoutOperation.length === 0) {
        showNotification('info', 'Aucune expédition disponible. Toutes les expéditions "Expédié" ont déjà une opération douanière.');
      }
    } catch (error: any) {
      console.error('Erreur lors du chargement des expéditions:', error);
      showNotification('error', 'Erreur lors du chargement des expéditions: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedExpeditionId) {
      showNotification('error', 'Veuillez sélectionner une expédition');
      return;
    }

    try {
      setSubmitting(true);

      const operation = await freightCustomsService.createOperation({
        shipping_preparation_id: selectedExpeditionId,
        notes: notes || undefined,
      });

      showNotification('success', `Opération ${operation.reference_number} créée avec succès`);
      navigate(`/freight-customs/${operation.id}`);
    } catch (error: any) {
      console.error('Erreur lors de la création:', error);
      showNotification('error', 'Erreur lors de la création: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedExpedition = shippedExpeditions.find(exp => exp.id === selectedExpeditionId);

  if (loading) {
    return (
      <MainLayout>
        <Loading />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/freight-customs')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nouvelle Opération Invoice & Consignment</h1>
            <p className="text-sm text-gray-600 mt-1">
              Créer une opération douanière depuis une expédition
            </p>
          </div>
        </div>

        {/* Alert si aucune expédition disponible */}
        {shippedExpeditions.length === 0 && (
          <Card className="p-6 border-l-4 border-l-yellow-500 bg-yellow-50">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-yellow-900 mb-1">Aucune expédition disponible</h3>
                <p className="text-sm text-yellow-800">
                  Toutes les expéditions avec le statut "Expédié" ont déjà une opération douanière associée.
                  Créez une nouvelle expédition ou attendez qu'une expédition soit marquée comme "Expédié".
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="p-6">
            <div className="space-y-6">
              {/* Sélection de l'expédition */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expédition <span className="text-red-500">*</span>
                </label>
                <Select
                  value={selectedExpeditionId}
                  onChange={(e) => setSelectedExpeditionId(e.target.value)}
                  required
                  disabled={shippedExpeditions.length === 0}
                >
                  <option value="">Sélectionner une expédition...</option>
                  {shippedExpeditions.map((expedition) => (
                    <option key={expedition.id} value={expedition.id}>
                      {expedition.reference_number} - {expedition.mining_companies?.name}
                      {' '}({expedition.total_weight_oz?.toFixed(2)} oz)
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  Seules les expéditions avec statut "Expédié" sont disponibles
                </p>
              </div>

              {/* Aperçu de l'expédition sélectionnée */}
              {selectedExpedition && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-blue-900 mb-3">Détails de l'expédition</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-blue-700 font-medium">Référence:</span>
                      <p className="text-blue-900 mt-1">{selectedExpedition.reference_number}</p>
                    </div>
                    <div>
                      <span className="text-blue-700 font-medium">Société minière:</span>
                      <p className="text-blue-900 mt-1">{selectedExpedition.mining_companies?.name}</p>
                    </div>
                    <div>
                      <span className="text-blue-700 font-medium">Poids (g):</span>
                      <p className="text-blue-900 mt-1">
                        {selectedExpedition.total_weight_grams?.toLocaleString('fr-FR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })} g
                      </p>
                    </div>
                    <div>
                      <span className="text-blue-700 font-medium">Poids (oz):</span>
                      <p className="text-blue-900 mt-1">
                        {selectedExpedition.total_weight_oz?.toLocaleString('fr-FR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })} oz
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <TextArea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Notes ou observations pour cette opération douanière..."
                />
              </div>
            </div>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/freight-customs')}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700"
              disabled={submitting || !selectedExpeditionId || shippedExpeditions.length === 0}
            >
              {submitting ? (
                <>
                  <Loading />
                  Création...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Créer l'opération
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Info box */}
        <Card className="p-4 bg-gray-50">
          <div className="flex items-start gap-3">
            <Package className="w-5 h-5 text-gray-600 mt-0.5" />
            <div className="text-sm text-gray-700">
              <p className="font-medium mb-1">À propos de la création d'opération</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Un numéro de référence unique sera généré automatiquement (FC-YYYYMMDD-XXXX)</li>
                <li>Le statut initial sera "En Attente Douane" (customs_pending)</li>
                <li>Vous pourrez ajouter des documents et changer le statut après la création</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
