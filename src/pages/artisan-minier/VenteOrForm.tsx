import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Save,
  X,
  Coins,
  Calendar,
  DollarSign,
  FileText,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Loading } from '@/components/ui/Loading';
import { artisanGoldSalesService, ArtisanGoldSale } from '@/services/artisanGoldSalesService';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import { CustomAlert } from '@/components/ui/CustomAlert';

interface VenteOrFormData {
  artisan_id: string;
  date_vente: string;
  type_or: string;
  quantite_grammes: number;
  purete_karat: number;
  prix_unitaire_fcfa: number;
  montant_total_fcfa: number;
  numero_recu: string;
  observations: string;
  statut: string;
}

const INITIAL_FORM_DATA: VenteOrFormData = {
  artisan_id: '',
  date_vente: new Date().toISOString().split('T')[0],
  type_or: 'poudre',
  quantite_grammes: 0,
  purete_karat: 24,
  prix_unitaire_fcfa: 0,
  montant_total_fcfa: 0,
  numero_recu: '',
  observations: '',
  statut: 'en_attente',
};

const TYPE_OR_OPTIONS = [
  { value: 'poudre', label: 'Poudre' },
  { value: 'lingot', label: 'Lingot' },
  { value: 'pepites', label: 'Pépites' },
  { value: 'bijoux', label: 'Bijoux' },
  { value: 'autre', label: 'Autre' },
];

export default function VenteOrForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<VenteOrFormData>(INITIAL_FORM_DATA);
  const { alertState, showSuccess, showError, closeAlert } = useCustomAlert();

  useEffect(() => {
    if (isEditMode && id) {
      loadVente(id);
    }
  }, [id, isEditMode]);

  useEffect(() => {
    calculateTotal();
  }, [formData.quantite_grammes, formData.prix_unitaire_fcfa]);

  const loadVente = async (venteId: string) => {
    try {
      setLoading(true);
      const vente = await artisanGoldSalesService.getById(venteId);
      if (vente) {
        setFormData({
          artisan_id: vente.artisan_id,
          date_vente: vente.date_vente.split('T')[0],
          type_or: vente.type_or,
          quantite_grammes: vente.quantite_grammes,
          purete_karat: vente.purete_karat,
          prix_unitaire_fcfa: vente.prix_unitaire_fcfa,
          montant_total_fcfa: vente.montant_total_fcfa,
          numero_recu: vente.numero_recu || '',
          observations: vente.observations || '',
          statut: vente.statut,
        });
      }
    } catch (error) {
      showError('Impossible de charger la vente');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    const total = formData.quantite_grammes * formData.prix_unitaire_fcfa;
    setFormData((prev) => ({
      ...prev,
      montant_total_fcfa: Math.round(total),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.artisan_id) {
      showError('Veuillez sélectionner un artisan');
      return;
    }

    if (formData.quantite_grammes <= 0) {
      showError('La quantité doit être supérieure à 0');
      return;
    }

    if (formData.prix_unitaire_fcfa <= 0) {
      showError('Le prix unitaire doit être supérieur à 0');
      return;
    }

    try {
      setSaving(true);
      if (isEditMode && id) {
        await artisanGoldSalesService.update(id, formData);
        showSuccess('Vente mise à jour avec succès');
      } else {
        await artisanGoldSalesService.create(formData);
        showSuccess('Vente créée avec succès');
      }
      setTimeout(() => navigate('/artisan-minier/ventes-or'), 1500);
    } catch (error: any) {
      showError(error.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center h-96">
          <Loading />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <CustomAlert {...alertState} onClose={closeAlert} />

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isEditMode ? 'Modifier' : 'Nouvelle'} Vente d'Or
            </h1>
            <p className="text-gray-600 mt-2">
              {isEditMode
                ? 'Modifier les informations de la vente'
                : 'Enregistrer une nouvelle vente d\'or d\'un artisan'}
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/artisan-minier/ventes-or')}>
            <X className="w-5 h-5 mr-2" />
            Annuler
          </Button>
        </div>

        <form onSubmit={handleSubmit}>
          <Card className="p-6">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="w-4 h-4 inline mr-2" />
                    Date de Vente *
                  </label>
                  <Input
                    type="date"
                    value={formData.date_vente}
                    onChange={(e) =>
                      setFormData({ ...formData, date_vente: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Coins className="w-4 h-4 inline mr-2" />
                    Type d'Or *
                  </label>
                  <select
                    value={formData.type_or}
                    onChange={(e) =>
                      setFormData({ ...formData, type_or: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    required
                  >
                    {TYPE_OR_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantité (grammes) *
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.quantite_grammes}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        quantite_grammes: parseFloat(e.target.value) || 0,
                      })
                    }
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pureté (Karat) *
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="24"
                    value={formData.purete_karat}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        purete_karat: parseInt(e.target.value) || 24,
                      })
                    }
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <DollarSign className="w-4 h-4 inline mr-2" />
                    Prix Unitaire (FCFA/g) *
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.prix_unitaire_fcfa}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        prix_unitaire_fcfa: parseInt(e.target.value) || 0,
                      })
                    }
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Montant Total (FCFA)
                  </label>
                  <Input
                    type="number"
                    value={formData.montant_total_fcfa}
                    disabled
                    className="bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <FileText className="w-4 h-4 inline mr-2" />
                    Numéro de Reçu
                  </label>
                  <Input
                    type="text"
                    value={formData.numero_recu}
                    onChange={(e) =>
                      setFormData({ ...formData, numero_recu: e.target.value })
                    }
                    placeholder="Ex: REC-2024-001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Statut
                  </label>
                  <select
                    value={formData.statut}
                    onChange={(e) =>
                      setFormData({ ...formData, statut: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="en_attente">En Attente</option>
                    <option value="validee">Validée</option>
                    <option value="payee">Payée</option>
                    <option value="annulee">Annulée</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observations
                </label>
                <textarea
                  value={formData.observations}
                  onChange={(e) =>
                    setFormData({ ...formData, observations: e.target.value })
                  }
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Notes ou observations supplémentaires..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/artisan-minier/ventes-or')}
                  disabled={saving}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <Loading />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5 mr-2" />
                      {isEditMode ? 'Mettre à jour' : 'Créer la Vente'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </form>
      </div>
    </MainLayout>
  );
}
