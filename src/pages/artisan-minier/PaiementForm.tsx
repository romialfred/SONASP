import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  DollarSign,
  FileText,
  AlertCircle,
  Info,
  HelpCircle,
  Download
} from 'lucide-react';
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
import {
  BankTransferLogo,
  OrangeMoneyLogo,
  MoovMoneyLogo,
  WaveLogo,
  MobileMoneyLogo,
  CashLogo,
  ChequeLogo
} from '@/components/payment/PaymentMethodLogos';
import { telechargerFacturePaiementArtisan } from '@/services/factureArtisanPdfService';

// Définition des moyens de paiement avec logos
const MOYENS_PAIEMENT = [
  {
    id: 'virement_bancaire',
    label: 'Virement Bancaire',
    LogoComponent: BankTransferLogo,
    borderColor: 'border-blue-200',
    description: 'Transfert électronique entre comptes bancaires'
  },
  {
    id: 'orange_money',
    label: 'Orange Money',
    LogoComponent: OrangeMoneyLogo,
    borderColor: 'border-orange-200',
    description: 'Paiement mobile Orange Money'
  },
  {
    id: 'moov_money',
    label: 'Moov Money',
    LogoComponent: MoovMoneyLogo,
    borderColor: 'border-blue-200',
    description: 'Paiement mobile Moov Money'
  },
  {
    id: 'wave',
    label: 'Wave',
    LogoComponent: WaveLogo,
    borderColor: 'border-pink-200',
    description: 'Paiement mobile Wave'
  },
  {
    id: 'mobile_money',
    label: 'Mobile Money',
    LogoComponent: MobileMoneyLogo,
    borderColor: 'border-purple-200',
    description: 'Autre service de paiement mobile'
  },
  {
    id: 'cash',
    label: 'Espèces',
    LogoComponent: CashLogo,
    borderColor: 'border-green-200',
    description: 'Paiement en espèces'
  },
  {
    id: 'cheque',
    label: 'Chèque',
    LogoComponent: ChequeLogo,
    borderColor: 'border-slate-200',
    description: 'Paiement par chèque bancaire'
  }
];

// Aide pour les champs du formulaire bancaire
const AIDE_CHAMPS_BANCAIRES: Record<string, { titre: string; description: string; exemple?: string }> = {
  banque: {
    titre: 'Nom de la Banque',
    description: 'Le nom complet de l\'établissement bancaire où le compte est domicilié. Vérifiez l\'orthographe exacte.',
    exemple: 'Ex: Banque Atlantique Burkina, Coris Bank International, UBA Burkina Faso'
  },
  agence: {
    titre: 'Agence Bancaire',
    description: 'Le nom ou code de l\'agence spécifique. Cela permet d\'identifier précisément la localisation du compte.',
    exemple: 'Ex: Agence Centrale Ouagadougou, Bobo-Dioulasso Sud, Koudougou'
  },
  numero_compte: {
    titre: 'Numéro de Compte (24 chiffres)',
    description: 'Le numéro de compte bancaire complet composé de 24 chiffres. Ce numéro doit être exact pour éviter tout rejet du virement.',
    exemple: 'Ex: BF42 BF01 0160 2010 0000 0123 4567'
  },
  proprietaire_compte: {
    titre: 'Titulaire du Compte',
    description: 'Le nom complet du propriétaire du compte tel qu\'il apparaît sur le relevé bancaire. Doit correspondre exactement.',
    exemple: 'Ex: TRAORE Moussa'
  },
  devise: {
    titre: 'Devise du Compte',
    description: 'La monnaie dans laquelle le compte est libellé. Important pour les conversions éventuelles.',
    exemple: 'Ex: FCFA (Franc CFA), XOF'
  },
  rib_cle: {
    titre: 'Clé RIB',
    description: 'Les 2 derniers chiffres de contrôle du RIB. Permet de valider l\'exactitude du numéro de compte.',
    exemple: 'Ex: 45, 89, 12'
  },
  swift_bic: {
    titre: 'Code SWIFT/BIC',
    description: 'Code international d\'identification de la banque, nécessaire pour les virements internationaux (8 ou 11 caractères).',
    exemple: 'Ex: CBAFBFBF, ECOCBFBF, UBAFBFBFXXX'
  },
  iban: {
    titre: 'IBAN',
    description: 'Identifiant international de compte bancaire. Format standardisé incluant le code pays (BF pour Burkina Faso).',
    exemple: 'Ex: BF42 BF01 0160 2010 0000 0123 4567'
  },
  domiciliation: {
    titre: 'Domiciliation Bancaire',
    description: 'L\'adresse complète de l\'agence bancaire. Peut inclure la ville et le quartier.',
    exemple: 'Ex: Avenue Kwamé N\'Krumah, 01 BP 3535 Ouagadougou 01'
  },
  type_compte: {
    titre: 'Type de Compte',
    description: 'La nature du compte bancaire (courant, épargne, professionnel).',
    exemple: 'Ex: Compte Courant, Compte Épargne'
  }
};

const PaiementForm = () => {
  const { venteId } = useParams<{ venteId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [vente, setVente] = useState<any>(null);
  const [facture, setFacture] = useState<FactureDefinitive | null>(null);
  const [artisan, setArtisan] = useState<any>(null);
  const [activeHelp, setActiveHelp] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<PaiementArtisan>>({
    type_paiement: 'virement_bancaire',
    statut: 'en_attente',
    details_paiement: {},
    notes: ''
  });

  const [detailsPaiement, setDetailsPaiement] = useState<any>({
    type_compte: 'courant',
    devise: 'FCFA'
  });

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
    setDetailsPaiement({
      type_compte: 'courant',
      devise: 'FCFA'
    });
    setActiveHelp(null);
  };

  const handleDetailsChange = (field: string, value: any) => {
    setDetailsPaiement((prev: any) => ({ ...prev, [field]: value }));
  };

  const renderDetailsPaiement = () => {
    switch (formData.type_paiement) {
      case 'virement_bancaire':
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">Formulaire de Virement Bancaire</p>
                  <p>Remplissez tous les champs requis avec précision. Survolez l'icône d'aide pour plus d'informations.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {/* Banque */}
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Nom de la Banque <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveHelp(activeHelp === 'banque' ? null : 'banque')}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                </div>
                <Input
                  value={detailsPaiement.banque || ''}
                  onChange={(e) => handleDetailsChange('banque', e.target.value)}
                  placeholder="Ex: Banque Atlantique Burkina"
                  required
                />
              </div>

              {/* Agence */}
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Agence Bancaire <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveHelp(activeHelp === 'agence' ? null : 'agence')}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                </div>
                <Input
                  value={detailsPaiement.agence || ''}
                  onChange={(e) => handleDetailsChange('agence', e.target.value)}
                  placeholder="Ex: Agence Centrale Ouagadougou"
                  required
                />
              </div>

              {/* Numéro de compte 24 chiffres */}
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Numéro de Compte (24 chiffres) <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveHelp(activeHelp === 'numero_compte' ? null : 'numero_compte')}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                </div>
                <Input
                  value={detailsPaiement.numero_compte || ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\s/g, '');
                    handleDetailsChange('numero_compte', value);
                  }}
                  placeholder="BF42BF01016020100000012345"
                  maxLength={24}
                  required
                  pattern="[A-Z0-9]{24}"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {detailsPaiement.numero_compte?.length || 0}/24 caractères
                </p>
              </div>

              {/* Clé RIB */}
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Clé RIB (2 chiffres) <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveHelp(activeHelp === 'rib_cle' ? null : 'rib_cle')}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                </div>
                <Input
                  value={detailsPaiement.rib_cle || ''}
                  onChange={(e) => handleDetailsChange('rib_cle', e.target.value)}
                  placeholder="Ex: 45"
                  maxLength={2}
                  pattern="[0-9]{2}"
                  required
                />
              </div>

              {/* Propriétaire du compte */}
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Titulaire du Compte <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveHelp(activeHelp === 'proprietaire_compte' ? null : 'proprietaire_compte')}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                </div>
                <Input
                  value={detailsPaiement.proprietaire_compte || `${artisan?.nom || ''} ${artisan?.prenom || ''}`.trim()}
                  onChange={(e) => handleDetailsChange('proprietaire_compte', e.target.value)}
                  placeholder="Nom complet du titulaire"
                  required
                />
              </div>

              {/* Type de compte */}
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Type de Compte <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveHelp(activeHelp === 'type_compte' ? null : 'type_compte')}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                </div>
                <Select
                  value={detailsPaiement.type_compte || 'courant'}
                  onChange={(e) => handleDetailsChange('type_compte', e.target.value)}
                  required
                >
                  <option value="courant">Compte Courant</option>
                  <option value="epargne">Compte Épargne</option>
                  <option value="professionnel">Compte Professionnel</option>
                </Select>
              </div>

              {/* Devise */}
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Devise du Compte <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveHelp(activeHelp === 'devise' ? null : 'devise')}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                </div>
                <Select
                  value={detailsPaiement.devise || 'FCFA'}
                  onChange={(e) => handleDetailsChange('devise', e.target.value)}
                  required
                >
                  <option value="FCFA">FCFA (Franc CFA)</option>
                  <option value="XOF">XOF (Franc CFA - Code ISO)</option>
                  <option value="EUR">EUR (Euro)</option>
                  <option value="USD">USD (Dollar américain)</option>
                </Select>
              </div>

              {/* IBAN */}
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    IBAN (optionnel)
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveHelp(activeHelp === 'iban' ? null : 'iban')}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                </div>
                <Input
                  value={detailsPaiement.iban || ''}
                  onChange={(e) => handleDetailsChange('iban', e.target.value.toUpperCase())}
                  placeholder="BF42 BF01 0160 2010 0000 0123 4567"
                />
              </div>

              {/* SWIFT/BIC */}
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Code SWIFT/BIC (optionnel)
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveHelp(activeHelp === 'swift_bic' ? null : 'swift_bic')}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                </div>
                <Input
                  value={detailsPaiement.swift_bic || ''}
                  onChange={(e) => handleDetailsChange('swift_bic', e.target.value.toUpperCase())}
                  placeholder="CBAFBFBF"
                  maxLength={11}
                />
              </div>

              {/* Domiciliation */}
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Domiciliation Bancaire <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveHelp(activeHelp === 'domiciliation' ? null : 'domiciliation')}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                </div>
                <textarea
                  value={detailsPaiement.domiciliation || ''}
                  onChange={(e) => handleDetailsChange('domiciliation', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Avenue Kwamé N'Krumah, 01 BP 3535 Ouagadougou 01"
                  required
                />
              </div>

              {/* Référence virement */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Référence du Virement (optionnel)
                </label>
                <Input
                  value={detailsPaiement.reference_virement || ''}
                  onChange={(e) => handleDetailsChange('reference_virement', e.target.value)}
                  placeholder="Ex: VENTE-OR-2024-001"
                />
              </div>
            </div>
          </div>
        );

      case 'orange_money':
      case 'mobile_money':
      case 'moov_money':
      case 'wave':
        return (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-800">
                  <p className="font-semibold mb-1">Paiement Mobile Money</p>
                  <p>Assurez-vous que le numéro est actif et que le compte peut recevoir des montants importants.</p>
                </div>
              </div>
            </div>

            <Input
              label="Numéro de téléphone"
              type="tel"
              value={detailsPaiement.numero_telephone || artisan?.telephone || ''}
              onChange={(e) => handleDetailsChange('numero_telephone', e.target.value)}
              placeholder="+226 XX XX XX XX"
              required
            />
            <Input
              label="Nom du titulaire"
              value={detailsPaiement.nom_titulaire || `${artisan?.nom} ${artisan?.prenom}` || ''}
              onChange={(e) => handleDetailsChange('nom_titulaire', e.target.value)}
              required
            />
            <Input
              label="Référence transaction (après paiement)"
              value={detailsPaiement.reference_transaction || ''}
              onChange={(e) => handleDetailsChange('reference_transaction', e.target.value)}
              placeholder="Ex: MP241228.1234.A12345"
            />
          </div>
        );

      case 'cash':
        return (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-green-800">
                  <p className="font-semibold mb-1">Paiement en Espèces</p>
                  <p>Un reçu officiel sera généré automatiquement après validation.</p>
                </div>
              </div>
            </div>

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
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-slate-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-slate-800">
                  <p className="font-semibold mb-1">Paiement par Chèque</p>
                  <p>Vérifiez que le chèque est certifié pour les montants importants.</p>
                </div>
              </div>
            </div>

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
              placeholder="Nom sur le chèque"
            />
          </div>
        );

      default:
        return null;
    }
  };

  const handleTelechargerFacture = async () => {
    if (!facture || !vente || !artisan) {
      alert('Données manquantes pour générer la facture');
      return;
    }

    try {
      const paiementData: PaiementArtisan = {
        ...formData,
        details_paiement: detailsPaiement,
        date_paiement: new Date().toISOString(),
        traite_par: user?.id
      } as PaiementArtisan;

      telechargerFacturePaiementArtisan({
        facture,
        paiement: paiementData,
        artisan: {
          nom: artisan.nom,
          prenom: artisan.prenom,
          adresse: artisan.adresse_physique,
          telephone: artisan.telephone,
          numero_carte: artisan.numero_carte
        },
        venteOr: {
          poids_grammes: vente.poids_grammes,
          poids_onces: vente.poids_onces,
          prix_unitaire_fcfa: vente.prix_unitaire_fcfa,
          purete_pourcentage: vente.purete_pourcentage || 96
        }
      });
    } catch (error) {
      console.error('Erreur génération facture:', error);
      alert('Erreur lors de la génération de la facture');
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

      alert('Paiement enregistré avec succès. Vous pouvez maintenant télécharger la facture.');

      if (window.confirm('Voulez-vous télécharger la facture PDF maintenant ?')) {
        handleTelechargerFacture();
      }

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

  const moyenPaiementSelectionne = MOYENS_PAIEMENT.find(m => m.id === formData.type_paiement);

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

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Formulaire principal - 7 colonnes */}
          <div className="xl:col-span-7">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Sélection du moyen de paiement */}
              <Card className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <DollarSign className="w-6 h-6 text-emerald-600" />
                  Moyen de Paiement
                </h2>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {MOYENS_PAIEMENT.map((moyen) => {
                    const LogoComponent = moyen.LogoComponent;
                    const isSelected = formData.type_paiement === moyen.id;

                    return (
                      <button
                        key={moyen.id}
                        type="button"
                        onClick={() => handleTypePaiementChange(moyen.id)}
                        className={`
                          flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all
                          ${isSelected
                            ? `${moyen.borderColor} bg-white shadow-lg ring-2 ring-offset-2 ${moyen.borderColor.replace('border', 'ring')}`
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                          }
                        `}
                      >
                        <div className={`w-16 h-16 mb-2 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-70'}`}>
                          <LogoComponent className="w-full h-full" />
                        </div>
                        <span className={`text-xs font-medium text-center ${isSelected ? 'text-gray-900' : 'text-gray-600'}`}>
                          {moyen.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {moyenPaiementSelectionne && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Mode sélectionné :</span> {moyenPaiementSelectionne.description}
                    </p>
                  </div>
                )}
              </Card>

              {/* Détails du paiement */}
              <Card className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Détails du Paiement</h2>
                {renderDetailsPaiement()}

                <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Montant à payer
                    </label>
                    <div className="text-2xl font-bold text-emerald-600">
                      {formData.montant_paye?.toLocaleString('fr-FR')} FCFA
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Taxes retenues
                    </label>
                    <div className="text-2xl font-bold text-red-600">
                      {formData.montant_taxes_retenues?.toLocaleString('fr-FR')} FCFA
                    </div>
                  </div>
                </div>

                <div className="mt-6">
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

          {/* Volet d'aide et infos - 5 colonnes */}
          <div className="xl:col-span-5 space-y-6">
            {/* Panneau d'aide contextuelle */}
            {activeHelp && AIDE_CHAMPS_BANCAIRES[activeHelp] && (
              <Card className="p-6 bg-blue-50 border-2 border-blue-300 sticky top-6">
                <div className="flex items-start gap-3 mb-4">
                  <HelpCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-bold text-blue-900 text-lg">
                      {AIDE_CHAMPS_BANCAIRES[activeHelp].titre}
                    </h3>
                  </div>
                </div>

                <p className="text-sm text-blue-800 mb-4 leading-relaxed">
                  {AIDE_CHAMPS_BANCAIRES[activeHelp].description}
                </p>

                {AIDE_CHAMPS_BANCAIRES[activeHelp].exemple && (
                  <div className="bg-white border border-blue-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-blue-700 mb-1">Exemple :</p>
                    <p className="text-sm text-gray-700 font-mono">
                      {AIDE_CHAMPS_BANCAIRES[activeHelp].exemple}
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setActiveHelp(null)}
                  className="mt-4 text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Fermer l'aide
                </button>
              </Card>
            )}

            {/* Détails de la facture */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Détails de la Facture
                </h3>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleTelechargerFacture}
                  className="text-xs py-1 px-2"
                >
                  <Download className="w-3 h-3 mr-1" />
                  PDF
                </Button>
              </div>
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

            {/* Informations artisan */}
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

            {/* Conseils généraux */}
            <Card className="p-6 bg-amber-50 border-amber-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-800">
                  <p className="font-semibold mb-2">Conseils Importants</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Vérifiez toutes les informations avant validation</li>
                    <li>Les taxes sont automatiquement retenues</li>
                    <li>Un reçu sera généré après validation</li>
                    <li>Cliquez sur les icônes d'aide pour plus d'informations</li>
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
