import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, DollarSign, FileText, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import artisanPaiementsService, { type FactureDefinitive, type PaiementArtisan } from '@/services/artisanPaiementsService';
import { artisanGoldSalesService } from '@/services/artisanGoldSalesService';
import { artisanMinierService } from '@/services/artisanMinierService';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Loading } from '@/components/ui/Loading';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';

const PaiementForm = () => {
  const { venteId } = useParams<{ venteId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [vente, setVente] = useState<any>(null);
  const [facture, setFacture] = useState<FactureDefinitive | null>(null);
  const [artisan, setArtisan] = useState<any>(null);

  const [formData, setFormData] = useState<Partial<PaiementArtisan>>({
    type_paiement: 'virement_bancaire',
    statut: 'en_attente',
    details_paiement: {},
    notes: ''
  });

  const [detailsPaiement, setDetailsPaiement] = useState<any>({});

  useEffect(() => {
    if (venteId) {
      chargerDonnees();
    }
  }, [venteId]);

  const chargerDonnees = async () => {
    try {
      setLoading(true);

      const venteData = await artisanGoldSalesService.getById(venteId!);
      setVente(venteData);

      const artisanData = await artisanMinierService.getById(venteData.artisan_id);
      setArtisan(artisanData);

      let factureData = await artisanPaiementsService.getFactureByVenteId(venteId!);

      if (!factureData && venteData.statut === 'validee') {
        const taxes = await artisanPaiementsService.calculerTaxes(venteData.montant_total_fcfa, 18, 1.5);

        factureData = await artisanPaiementsService.creerFactureDefinitive({
          vente_or_id: venteId!,
          artisan_id: venteData.artisan_id,
          montant_brut: venteData.montant_total_fcfa,
          montant_taxe_tva: taxes.montant_tva,
          montant_taxe_retenue_source: taxes.montant_retenue_source,
          montant_autres_taxes: 0,
          montant_total_taxes: taxes.montant_total_taxes,
          montant_net_a_payer: taxes.montant_net,
          taux_tva: 18,
          taux_retenue_source: 1.5,
          date_emission: new Date().toISOString(),
          statut: 'emise',
          emise_par: user?.id
        });
      }

      setFacture(factureData);

      setFormData((prev) => ({
        ...prev,
        facture_id: factureData?.id,
        vente_or_id: venteId,
        artisan_id: venteData.artisan_id,
        montant_paye: factureData?.montant_net_a_payer || 0,
        montant_taxes_retenues: factureData?.montant_total_taxes || 0
      }));
    } catch (error) {
      console.error('Erreur chargement données:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTypePaiementChange = (type: string) => {
    setFormData((prev) => ({ ...prev, type_paiement: type as any }));
    setDetailsPaiement({});
  };

  const handleDetailsChange = (field: string, value: any) => {
    setDetailsPaiement((prev: any) => ({ ...prev, [field]: value }));
  };

  const renderDetailsPaiement = () => {
    switch (formData.type_paiement) {
      case 'virement_bancaire':
        return (
          <div className="space-y-4">
            <Input
              label="IBAN / Numéro de compte"
              value={detailsPaiement.numero_compte || ''}
              onChange={(e) => handleDetailsChange('numero_compte', e.target.value)}
              required
            />
            <Input
              label="Nom de la banque"
              value={detailsPaiement.banque || ''}
              onChange={(e) => handleDetailsChange('banque', e.target.value)}
              required
            />
            <Input
              label="BIC / SWIFT (optionnel)"
              value={detailsPaiement.bic || ''}
              onChange={(e) => handleDetailsChange('bic', e.target.value)}
            />
            <Input
              label="Référence virement"
              value={detailsPaiement.reference_virement || ''}
              onChange={(e) => handleDetailsChange('reference_virement', e.target.value)}
            />
          </div>
        );

      case 'orange_money':
      case 'mobile_money':
      case 'moov_money':
      case 'wave':
        return (
          <div className="space-y-4">
            <Input
              label="Numéro de téléphone"
              type="tel"
              value={detailsPaiement.numero_telephone || artisan?.telephone || ''}
              onChange={(e) => handleDetailsChange('numero_telephone', e.target.value)}
              required
            />
            <Input
              label="Nom du titulaire"
              value={detailsPaiement.nom_titulaire || `${artisan?.nom} ${artisan?.prenom}` || ''}
              onChange={(e) => handleDetailsChange('nom_titulaire', e.target.value)}
              required
            />
            <Input
              label="Référence transaction"
              value={detailsPaiement.reference_transaction || ''}
              onChange={(e) => handleDetailsChange('reference_transaction', e.target.value)}
              placeholder="Ex: MP241228.1234.A12345"
            />
          </div>
        );

      case 'cash':
        return (
          <div className="space-y-4">
            <Input
              label="Reçu par"
              value={detailsPaiement.recu_par || ''}
              onChange={(e) => handleDetailsChange('recu_par', e.target.value)}
              required
              placeholder="Nom de la personne qui reçoit le paiement"
            />
            <Input
              label="Lieu du paiement"
              value={detailsPaiement.lieu_paiement || ''}
              onChange={(e) => handleDetailsChange('lieu_paiement', e.target.value)}
              required
              placeholder="Ex: Bureau SONASP Ouagadougou"
            />
            <Input
              label="Numéro de reçu"
              value={detailsPaiement.numero_recu || ''}
              onChange={(e) => handleDetailsChange('numero_recu', e.target.value)}
              placeholder="Ex: RECU-2024-001"
            />
          </div>
        );

      case 'cheque':
        return (
          <div className="space-y-4">
            <Input
              label="Numéro de chèque"
              value={detailsPaiement.numero_cheque || ''}
              onChange={(e) => handleDetailsChange('numero_cheque', e.target.value)}
              required
            />
            <Input
              label="Banque émettrice"
              value={detailsPaiement.banque_emettrice || ''}
              onChange={(e) => handleDetailsChange('banque_emettrice', e.target.value)}
              required
            />
            <Input
              label="Date d'émission"
              type="date"
              value={detailsPaiement.date_emission || new Date().toISOString().split('T')[0]}
              onChange={(e) => handleDetailsChange('date_emission', e.target.value)}
              required
            />
            <Input
              label="Nom du tireur"
              value={detailsPaiement.nom_tireur || ''}
              onChange={(e) => handleDetailsChange('nom_tireur', e.target.value)}
            />
          </div>
        );

      default:
        return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!facture) {
      alert('Aucune facture trouvée pour cette vente');
      return;
    }

    try {
      setSubmitting(true);

      const paiementData: Partial<PaiementArtisan> = {
        ...formData,
        details_paiement: detailsPaiement,
        date_paiement: new Date().toISOString(),
        traite_par: user?.id
      };

      await artisanPaiementsService.creerPaiement(paiementData);

      alert('Paiement enregistré avec succès');
      navigate('/artisan-minier/paiements');
    } catch (error) {
      console.error('Erreur enregistrement paiement:', error);
      alert('Erreur lors de l\'enregistrement du paiement');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <Loading size="lg" />
          <p className="mt-4 text-gray-600">Chargement des informations de paiement...</p>
        </div>
      </MainLayout>
    );
  }

  if (!vente || !facture) {
    return (
      <MainLayout>
        <div className="p-6">
          <Card className="p-6 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Données non trouvées</h2>
            <p className="text-gray-600 mb-4">
              Impossible de charger les informations de la vente ou de la facture
            </p>
            <Button onClick={() => navigate('/artisan-minier/paiements')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour à la liste
            </Button>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="secondary" onClick={() => navigate('/artisan-minier/paiements')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Nouveau Paiement</h1>
          <p className="text-gray-600 mt-1">Enregistrer un paiement pour une vente d'or validée</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-emerald-600" />
                Informations de Paiement
              </h2>

              <div className="space-y-4">
                <Select
                  label="Type de paiement"
                  value={formData.type_paiement}
                  onChange={(e) => handleTypePaiementChange(e.target.value)}
                  required
                >
                  <option value="virement_bancaire">Virement bancaire</option>
                  <option value="cash">Cash</option>
                  <option value="orange_money">Orange Money</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="moov_money">Moov Money</option>
                  <option value="wave">Wave</option>
                  <option value="cheque">Chèque</option>
                </Select>

                {renderDetailsPaiement()}

                <div className="grid grid-cols-2 gap-4 mt-6">
                  <Input
                    label="Montant à payer"
                    type="number"
                    step="0.01"
                    value={formData.montant_paye}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, montant_paye: parseFloat(e.target.value) }))
                    }
                    required
                    disabled
                  />
                  <Input
                    label="Taxes retenues"
                    type="number"
                    step="0.01"
                    value={formData.montant_taxes_retenues}
                    disabled
                  />
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (optionnel)
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Ajoutez des notes sur ce paiement..."
                  />
                </div>
              </div>
            </Card>

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/artisan-minier/paiements')}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>Enregistrement...</>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Enregistrer le paiement
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Détails de la Facture
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-600">Numéro:</span>
                <span className="ml-2 font-medium text-gray-900">{facture.numero_facture}</span>
              </div>
              <div>
                <span className="text-gray-600">Date émission:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {new Date(facture.date_emission).toLocaleDateString('fr-FR')}
                </span>
              </div>
              <div className="pt-2 border-t">
                <span className="text-gray-600">Montant brut:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {facture.montant_brut.toLocaleString('fr-FR')} FCFA
                </span>
              </div>
              <div>
                <span className="text-gray-600">TVA ({facture.taux_tva}%):</span>
                <span className="ml-2 font-medium text-red-600">
                  -{facture.montant_taxe_tva.toLocaleString('fr-FR')} FCFA
                </span>
              </div>
              <div>
                <span className="text-gray-600">Retenue ({facture.taux_retenue_source}%):</span>
                <span className="ml-2 font-medium text-red-600">
                  -{facture.montant_taxe_retenue_source.toLocaleString('fr-FR')} FCFA
                </span>
              </div>
              <div className="pt-2 border-t">
                <span className="text-gray-600 font-bold">Net à payer:</span>
                <span className="ml-2 font-bold text-emerald-600 text-lg">
                  {facture.montant_net_a_payer.toLocaleString('fr-FR')} FCFA
                </span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-bold text-gray-900 mb-4">Informations Artisan</h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-600">Nom:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {artisan?.nom} {artisan?.prenom}
                </span>
              </div>
              <div>
                <span className="text-gray-600">N° Carte:</span>
                <span className="ml-2 font-medium text-gray-900">{artisan?.numero_carte}</span>
              </div>
              {artisan?.telephone && (
                <div>
                  <span className="text-gray-600">Téléphone:</span>
                  <span className="ml-2 font-medium text-gray-900">{artisan?.telephone}</span>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-6 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-2">Important</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Vérifiez les informations avant validation</li>
                  <li>Les taxes sont automatiquement retenues</li>
                  <li>Un reçu sera généré après validation</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      </div>
      </div>
    </MainLayout>
  );
};

export default PaiementForm;
