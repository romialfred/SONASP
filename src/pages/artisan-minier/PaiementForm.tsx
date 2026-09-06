import { FormEvent, useEffect, useMemo, useState } from 'react';
import { affiliationService } from '@/services/affiliationService';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Banknote,
  Download,
  FileText,
  Landmark,
  Loader2,
  Receipt,
  Save,
  StickyNote,
  UserRound,
  Wallet,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import {
  Badge,
  EmptyState,
  Field,
  Note,
  PageHeader,
  Section,
} from '@/components/ui/sn';
import { useConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import { CustomAlert } from '@/components/ui/CustomAlert';
import { useAuth } from '@/contexts/AuthContext';
import { CAPABILITIES, hasSensitiveCapability } from '@/lib/capabilities';
import { messageErreurUtilisateur } from '@/lib/presentError';
import {
  BankTransferLogo,
  CashLogo,
  ChequeLogo,
  MobileMoneyLogo,
  MoovMoneyLogo,
  OrangeMoneyLogo,
  WaveLogo,
} from '@/components/payment/PaymentMethodLogos';
import artisanPaiementsService, {
  createArtisanPaymentIdempotencyKey,
  type FactureDefinitive,
  type PaiementArtisan,
} from '@/services/artisanPaiementsService';
import { artisanGoldSalesService, type ArtisanGoldSale } from '@/services/artisanGoldSalesService';
import { artisanMinierService, type ArtisanMinier } from '@/services/artisanMinierService';
import { normaliserArtisan } from './artisanRow';
import {
  LIBELLES_MOYEN,
  artisanMoyenPaiementService,
  coordonneeMasquee,
  moyenParDefaut,
  type MoyenPaiement,
} from '@/services/artisanMoyenPaiementService';
import { TROY_OZ_GRAMS } from '@/constants/goldConstants';
import './paiement-form.css';

type TypePaiement = PaiementArtisan['type_paiement'];

interface MethodField {
  key: string;
  label: string;
  required?: boolean;
  type?: 'text' | 'date' | 'select';
  placeholder?: string;
  hint?: string;
  options?: Array<{ value: string; label: string }>;
  wide?: boolean;
}

interface PaymentMethod {
  id: TypePaiement;
  label: string;
  description: string;
  Logo: typeof BankTransferLogo;
  /** Champs propres au moyen de paiement : la saisie ne montre que ce qui le concerne. */
  fields: MethodField[];
}

const MOYENS_PAIEMENT: PaymentMethod[] = [
  {
    id: 'virement_bancaire',
    label: 'Virement bancaire',
    description: 'Transfert entre comptes bancaires',
    Logo: BankTransferLogo,
    fields: [
      { key: 'banque', label: 'Nom de la banque', required: true, placeholder: 'Coris Bank International' },
      { key: 'agence', label: 'Agence', placeholder: 'Agence centrale Ouagadougou' },
      { key: 'numero_compte', label: 'Numéro de compte', required: true, placeholder: '24 chiffres', hint: 'Un numéro erroné provoque le rejet du virement.' },
      { key: 'rib_cle', label: 'Clé RIB', placeholder: '2 chiffres' },
      { key: 'proprietaire_compte', label: 'Titulaire du compte', required: true, placeholder: 'Nom figurant sur le relevé' },
      {
        key: 'type_compte',
        label: 'Type de compte',
        type: 'select',
        options: [
          { value: 'courant', label: 'Compte courant' },
          { value: 'epargne', label: "Compte d'épargne" },
          { value: 'professionnel', label: 'Compte professionnel' },
        ],
      },
      { key: 'iban', label: 'IBAN', placeholder: 'BF__ ____ ____ ____ ____ ____ ___' },
      { key: 'swift_bic', label: 'Code SWIFT / BIC', placeholder: '8 ou 11 caractères' },
      { key: 'domiciliation', label: 'Domiciliation', placeholder: 'Ville de domiciliation' },
      {
        key: 'devise',
        label: 'Devise',
        type: 'select',
        options: [
          { value: 'FCFA', label: 'FCFA (XOF)' },
          { value: 'EUR', label: 'Euro' },
          { value: 'USD', label: 'Dollar américain' },
        ],
      },
      { key: 'reference_virement', label: 'Référence du virement', placeholder: 'Référence bancaire', wide: true },
    ],
  },
  {
    id: 'orange_money',
    label: 'Orange Money',
    description: 'Paiement mobile Orange',
    Logo: OrangeMoneyLogo,
    fields: [],
  },
  {
    id: 'moov_money',
    label: 'Moov Money',
    description: 'Paiement mobile Moov',
    Logo: MoovMoneyLogo,
    fields: [],
  },
  {
    id: 'wave',
    label: 'Wave',
    description: 'Paiement mobile Wave',
    Logo: WaveLogo,
    fields: [],
  },
  {
    id: 'mobile_money',
    label: 'Mobile Money',
    description: 'Autre service mobile',
    Logo: MobileMoneyLogo,
    fields: [],
  },
  {
    id: 'cash',
    label: 'Espèces',
    description: 'Remise en main propre',
    Logo: CashLogo,
    fields: [
      { key: 'recu_par', label: 'Reçu par', required: true, placeholder: 'Nom du bénéficiaire' },
      { key: 'lieu_paiement', label: 'Lieu du paiement', required: true, placeholder: 'Agence, site, comptoir' },
      { key: 'numero_recu', label: 'Numéro de reçu', placeholder: 'REC-…' },
    ],
  },
  {
    id: 'cheque',
    label: 'Chèque',
    description: 'Chèque bancaire',
    Logo: ChequeLogo,
    fields: [
      { key: 'numero_cheque', label: 'Numéro de chèque', required: true },
      { key: 'banque_emettrice', label: 'Banque émettrice', required: true },
      { key: 'date_emission', label: "Date d'émission", type: 'date', required: true },
      { key: 'nom_tireur', label: 'Nom du tireur', placeholder: 'Nom porté sur le chèque' },
    ],
  },
];

/** Champs communs aux quatre services de paiement mobile. */
const CHAMPS_MOBILE: MethodField[] = [
  { key: 'numero_telephone', label: 'Numéro de téléphone', required: true, placeholder: '+226 __ __ __ __' },
  { key: 'nom_titulaire', label: 'Nom du titulaire', required: true, placeholder: 'Nom associé au compte mobile' },
  { key: 'reference_transaction', label: 'Référence de transaction', placeholder: 'Renseignée après le paiement' },
];

const MOBILE_METHODS: TypePaiement[] = ['orange_money', 'moov_money', 'wave', 'mobile_money'];

export function fieldsForMethod(method: TypePaiement): MethodField[] {
  const base = MOYENS_PAIEMENT.find((item) => item.id === method);
  if (!base) return [];
  return MOBILE_METHODS.includes(method) ? CHAMPS_MOBILE : base.fields;
}

/** Champs obligatoires non renseignés pour le moyen de paiement courant. */
export function missingRequiredFields(method: TypePaiement, details: Record<string, unknown>): string[] {
  return fieldsForMethod(method)
    .filter((field) => field.required && !String(details[field.key] ?? '').trim())
    .map((field) => field.label);
}

const integer = new Intl.NumberFormat('fr-FR');
const decimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatFcfa = (value?: number) => `${integer.format(Math.round(value || 0))} FCFA`;

const artisanLabel = (artisan: ArtisanMinier | null) =>
  artisan
    ? artisan.raison_sociale || [artisan.nom, artisan.prenoms].filter(Boolean).join(' ') || 'Artisan'
    : 'Artisan inconnu';

/**
 * Charge utile du PDF de facture.
 *
 * Le contrat du service PDF utilise le vocabulaire de la facture (poids, prix unitaire au
 * kilogramme, pureté en pourcentage) alors que la vente est stockée en `quantite_grammes`,
 * `prix_kg_fcfa` et `purete_karat`. La correspondance était erronée : les champs transmis
 * n'existaient pas, la génération levait une `TypeError` et l'utilisateur n'obtenait qu'un
 * message d'erreur générique.
 */
export function buildInvoicePayload(
  facture: FactureDefinitive,
  paiement: PaiementArtisan,
  artisan: ArtisanMinier | null,
  vente: ArtisanGoldSale
) {
  return {
    facture,
    paiement,
    artisan: {
      nom: artisan?.nom || artisan?.raison_sociale || '',
      prenom: artisan?.prenoms || '',
      adresse: artisan?.adresse ?? undefined,
      telephone: artisan?.telephone,
      numero_carte: artisan?.numero_carte ?? undefined,
    },
    venteOr: {
      poids_grammes: vente.quantite_grammes,
      poids_onces: vente.quantite_grammes / TROY_OZ_GRAMS,
      prix_unitaire_fcfa: vente.prix_kg_fcfa,
      purete_pourcentage: Math.round((vente.purete_karat / 24) * 10_000) / 100,
    },
  };
}

export default function PaiementForm() {
  const navigate = useNavigate();
  const { venteId } = useParams();
  const { user } = useAuth();
  const canExecutePayment = hasSensitiveCapability(user, CAPABILITIES.COMPTOIR_PAYMENTS_EXECUTE)
    || hasSensitiveCapability(user, CAPABILITIES.FINANCE_EXECUTE);

  const [vente, setVente] = useState<ArtisanGoldSale | null>(null);
  const [artisan, setArtisan] = useState<ArtisanMinier | null>(null);
  const [facture, setFacture] = useState<FactureDefinitive | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [moyens, setMoyens] = useState<MoyenPaiement[]>([]);
  const [moyenId, setMoyenId] = useState<string>('');
  const [notes, setNotes] = useState('');

  const { alertState, showSuccess, showError, closeAlert } = useCustomAlert();
  const confirmation = useConfirmationDialog();

  useEffect(() => {
    if (!venteId) return;
    let mounted = true;

    const charger = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const venteData = await artisanGoldSalesService.getById(venteId);
        if (!mounted) return;
        if (!venteData) {
          // L'ancienne version sortait en silence : écran vide sans explication.
          setLoadError('Cette vente est introuvable ou a été supprimée.');
          return;
        }
        setVente(venteData);
        if (!await affiliationService.eligible(venteData.artisan_id)) {
          setLoadError('Ce titulaire doit disposer d’une carte activée et de droits d’adhésion valides avant un nouveau paiement.');
          return;
        }

        try {
          setArtisan(normaliserArtisan(await artisanMinierService.getById(venteData.artisan_id)));
        } catch {
          setArtisan(null);
        }

        // Les coordonnees viennent de la fiche de l'artisan : l'ecran de paiement
        // les choisit, il ne les saisit plus.
        try {
          const liste = (await artisanMoyenPaiementService.listerParArtisan(venteData.artisan_id))
            .filter((moyen) => moyen.actif && Boolean(moyen.verifie_le));
          if (!mounted) return;
          setMoyens(liste);
          setMoyenId(moyenParDefaut(liste)?.id || '');
        } catch {
          if (mounted) setMoyens([]);
        }

        const factureData = await artisanPaiementsService.getFactureByVenteId(venteId);

        if (!mounted) return;
        setFacture(factureData);
        if (!factureData) {
          setLoadError(
            'Aucune facture définitive n’est rattachée à cette vente. Validez la vente pour émettre la facture.'
          );
        }
      } catch {
        if (mounted) setLoadError('Impossible de charger le dossier de paiement.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void charger();
    return () => {
      mounted = false;
    };
  }, [venteId]);

  const moyenRetenu = useMemo(
    () => moyens.find((moyen) => moyen.id === moyenId) || null,
    [moyens, moyenId]
  );

  const typePaiement = (moyenRetenu?.type || 'virement_bancaire') as TypePaiement;

  const methode = useMemo(
    () => MOYENS_PAIEMENT.find((item) => item.id === typePaiement) || MOYENS_PAIEMENT[0],
    [typePaiement]
  );

  /** Coordonnees reportees telles quelles depuis la fiche, sans ressaisie. */
  const details = useMemo<Record<string, string>>(() => {
    if (!moyenRetenu) return {} as Record<string, string>;
    return {
      moyen_paiement_id: moyenRetenu.id || '',
      titulaire: moyenRetenu.titulaire,
      numero_telephone: moyenRetenu.numero_telephone || '',
      banque: moyenRetenu.banque || '',
      numero_compte: moyenRetenu.numero_compte || '',
      code_swift: moyenRetenu.code_swift || '',
    };
  }, [moyenRetenu]);

  const paiementCourant = (): PaiementArtisan =>
    ({
      facture_id: facture?.id,
      vente_or_id: venteId,
      artisan_id: vente?.artisan_id,
      type_paiement: typePaiement,
      montant_paye: facture?.montant_net_a_payer || 0,
      montant_taxes_retenues: facture?.montant_total_taxes || 0,
      details_paiement: details,
      moyen_paiement_id: moyenRetenu?.id,
      numero_facture: facture?.numero_facture,
      statut: 'en_attente',
      notes,
    }) as PaiementArtisan;

  const telechargerFacture = async () => {
    if (!facture || !vente) {
      showError('Le dossier est incomplet : facture ou vente manquante.');
      return;
    }
    try {
      const { telechargerFacturePaiementArtisan } = await import('@/services/factureArtisanPdfService');
      telechargerFacturePaiementArtisan(buildInvoicePayload(facture, paiementCourant(), artisan, vente));
    } catch {
      showError('La génération de la facture PDF a échoué.');
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return; // garde-fou contre la double soumission

    if (!facture?.id) {
      showError('Aucune facture définitive n’est rattachée à cette vente.');
      return;
    }
    if (!moyenRetenu?.id) {
      showError('Sélectionnez le moyen de paiement enregistré sur la fiche de l’artisan.');
      return;
    }
    if (!canExecutePayment) {
      showError('Une session AAL2 avec la capacité d’exécution du paiement est requise.');
      return;
    }
    if (facture.certification_dgi_status !== 'certified') {
      showError('La facture doit être certifiée par le canal DGI sécurisé avant le paiement.');
      return;
    }
    if (!Number.isSafeInteger(facture.version)) {
      showError('La version serveur de la facture est absente. Rechargez le dossier.');
      return;
    }

    setSubmitting(true);
    try {
      await artisanPaiementsService.creerPaiement({
        invoiceId: facture.id,
        expectedInvoiceStatus: facture.statut,
        expectedInvoiceVersion: facture.version!,
        paymentMethodId: moyenRetenu.id,
        idempotencyKey: createArtisanPaymentIdempotencyKey(),
        notes,
      });
      showSuccess('Paiement enregistré');

      const veutFacture = await confirmation.open({
        title: 'Télécharger la facture ?',
        message: 'Le paiement est enregistré. Vous pouvez télécharger la facture PDF maintenant.',
        confirmText: 'Télécharger',
        cancelText: 'Plus tard',
        severity: 'info',
      });
      if (veutFacture) await telechargerFacture();

      navigate('/artisan-minier/paiements');
    } catch (reason) {
      showError(messageErreurUtilisateur(reason));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <NationalDashboardLayout>
        <div className="sn-page">
          <p className="sn-empty">
            <Loader2 className="sn-spin" aria-hidden="true" /> Chargement du dossier de paiement…
          </p>
        </div>
      </NationalDashboardLayout>
    );
  }

  if (loadError || !vente || !facture) {
    return (
      <NationalDashboardLayout>
        <div className="sn-page">
          <CustomAlert {...alertState} onClose={closeAlert} />
          <PageHeader
            icon={Wallet}
            title="Paiement indisponible"
            subtitle="Le dossier ne peut pas être ouvert en l’état."
            breadcrumb={[
              { label: 'Artisans miniers', to: '/artisan-minier' },
              { label: 'Paiements des ventes', to: '/artisan-minier/paiements' },
              { label: 'Paiement' },
            ]}
          />
          <EmptyState
            title="Dossier de paiement incomplet"
            description={loadError || 'La facture définitive est absente.'}
            action={
              <button type="button" className="sn-btn sn-btn--primary" onClick={() => navigate('/artisan-minier/paiements')}>
                <ArrowLeft aria-hidden="true" /> Retour aux dossiers
              </button>
            }
          />
        </div>
      </NationalDashboardLayout>
    );
  }

  return (
    <NationalDashboardLayout>
      <div className="sn-page paiement-form">
        <CustomAlert {...alertState} onClose={closeAlert} />
        <confirmation.ConfirmationDialog />

        <PageHeader
          icon={Wallet}
          title="Règlement d’une vente d’or"
          subtitle={`Facture ${facture.numero_facture || 'en cours'} · ${artisanLabel(artisan)}`}
          breadcrumb={[
            { label: 'Artisans miniers', to: '/artisan-minier' },
            { label: 'Paiements des ventes', to: '/artisan-minier/paiements' },
            { label: 'Règlement' },
          ]}
          actions={
            <>
              <button type="button" className="sn-btn" onClick={() => navigate('/artisan-minier/paiements')}>
                <ArrowLeft aria-hidden="true" /> Dossiers
              </button>
              <button type="button" className="sn-btn" onClick={() => void telechargerFacture()}>
                <Download aria-hidden="true" /> Facture PDF
              </button>
            </>
          }
        />

        <div className="paiement-form__layout">
          <form className="paiement-form__main" onSubmit={handleSubmit}>
            <Section
              id="moyen"
              icon={Banknote}
              title="Moyen de paiement de l’artisan"
              description="Coordonnées de règlement de l’artisan."
            >
              {/* Les coordonnees etaient frappees ici, a chaque reglement : ressaisie du
                  numero a chaque fois, et rien ne garantissait que le compte credite
                  appartienne a l'artisan. */}
              {moyens.length === 0 ? (
                <EmptyState
                  title="Aucun moyen de paiement vérifié"
                  description="Cet artisan n’a pas de coordonnée active et vérifiée. Faites-la contrôler sur sa fiche avant de payer."
                  action={
                    <button
                      type="button"
                      className="sn-btn sn-btn--primary"
                      onClick={() => navigate(`/artisan-minier/${vente.artisan_id}/edit`)}
                    >
                      <UserRound aria-hidden="true" /> Ouvrir la fiche de l’artisan
                    </button>
                  }
                />
              ) : (
                <div className="paiement-form__methods" role="radiogroup" aria-label="Moyen de paiement">
                  {moyens.map((moyen) => {
                    const reference = MOYENS_PAIEMENT.find((item) => item.id === moyen.type);
                    const Logo = reference?.Logo;
                    return (
                      <label key={moyen.id} className={moyenId === moyen.id ? 'is-checked' : ''}>
                        <input
                          type="radio"
                          name="moyen-paiement"
                          value={moyen.id}
                          checked={moyenId === moyen.id}
                          onChange={() => setMoyenId(moyen.id || '')}
                        />
                        <span className="paiement-form__method-logo">{Logo ? <Logo /> : null}</span>
                        <span>
                          <strong>{LIBELLES_MOYEN[moyen.type]}</strong>
                          <small>
                            {moyen.titulaire} · {coordonneeMasquee(moyen)}
                          </small>
                        </span>
                        {moyen.est_principal && <em className="paiement-form__principal">Principal</em>}
                      </label>
                    );
                  })}
                </div>
              )}
            </Section>

            {moyenRetenu && (
              <Section
                id="coordonnees"
                icon={Landmark}
                title={`Coordonnées — ${methode.label}`}
                description="Banque, guichet et numéro de compte du bénéficiaire."
              >
                <dl className="paiement-form__coordonnees">
                  <div>
                    <dt>Titulaire</dt>
                    <dd>{moyenRetenu.titulaire}</dd>
                  </div>
                  {moyenRetenu.numero_telephone && (
                    <div>
                      <dt>Numéro</dt>
                      <dd>{moyenRetenu.numero_telephone}</dd>
                    </div>
                  )}
                  {moyenRetenu.banque && (
                    <div>
                      <dt>Banque</dt>
                      <dd>{moyenRetenu.banque}</dd>
                    </div>
                  )}
                  {moyenRetenu.numero_compte && (
                    <div>
                      <dt>Compte</dt>
                      <dd>{moyenRetenu.numero_compte}</dd>
                    </div>
                  )}
                  {moyenRetenu.code_swift && (
                    <div>
                      <dt>SWIFT</dt>
                      <dd>{moyenRetenu.code_swift}</dd>
                    </div>
                  )}
                </dl>
                <button
                  type="button"
                  className="sn-btn paiement-form__modifier-moyen"
                  onClick={() => navigate(`/artisan-minier/${vente.artisan_id}/edit`)}
                >
                  <UserRound aria-hidden="true" /> Corriger sur la fiche de l’artisan
                </button>
              </Section>
            )}

            <Section
              id="notes"
              icon={StickyNote}
              tone="slate"
              title="Observations"
              description="Contexte du règlement, pièces remises, remarques de contrôle."
            >
              <Field label="Notes internes" wide>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Conditions du règlement, personne présente, référence externe…"
                />
              </Field>
            </Section>

            <footer className="sn-form-actions">
              <button type="button" className="sn-btn" onClick={() => navigate('/artisan-minier/paiements')}>
                Annuler
              </button>
              <button
                type="submit"
                className="sn-btn sn-btn--primary"
                disabled={
                  submitting
                  || !moyenRetenu?.id
                  || !facture.id
                  || !canExecutePayment
                  || facture.certification_dgi_status !== 'certified'
                  || !Number.isSafeInteger(facture.version)
                }
                title={!canExecutePayment
                  ? 'Capacité sensible d’exécution du paiement requise'
                  : facture.certification_dgi_status !== 'certified'
                    ? 'Certification DGI sécurisée requise'
                    : undefined}
              >
                {submitting ? <Loader2 className="sn-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
                {submitting ? 'Enregistrement…' : 'Enregistrer le paiement'}
              </button>
            </footer>
          </form>

          <aside className="paiement-form__aside" aria-label="Facture et bénéficiaire">
            <section className="sn-card">
              <div className="sn-card__head">
                <div>
                  <h3>Facture définitive</h3>
                  <p className="sn-card__hint">{facture.numero_facture || 'Numéro en cours d’attribution'}</p>
                </div>
                <Badge tone="info">{facture.statut}</Badge>
              </div>
              {/* La facture certifiee DGI n'est pas encore emise : le dossier renvoie
                  au specimen, et le dit. */}
              <button
                type="button"
                className="sn-btn paiement-form__facture-lien"
                onClick={() => navigate(`/artisan-minier/ventes-or/${venteId}/facture`)}
              >
                <FileText aria-hidden="true" /> Voir la facture (spécimen)
              </button>
              <dl className="paiement-form__recap">
                <div>
                  <dt>Montant brut</dt>
                  <dd>{formatFcfa(facture.montant_brut)}</dd>
                </div>
                <div>
                  <dt>TVA ({facture.taux_tva || 0} %)</dt>
                  <dd>−{formatFcfa(facture.montant_taxe_tva)}</dd>
                </div>
                <div>
                  <dt>Retenue à la source ({facture.taux_retenue_source || 0} %)</dt>
                  <dd>−{formatFcfa(facture.montant_taxe_retenue_source)}</dd>
                </div>
                <div className="is-total">
                  <dt>Net à payer</dt>
                  <dd>{formatFcfa(facture.montant_net_a_payer)}</dd>
                </div>
              </dl>
              {!moyenRetenu && (
                <p className="paiement-form__blocker">
                  Aucun moyen de paiement sélectionné : le règlement ne peut pas être enregistré.
                </p>
              )}
              {facture.certification_dgi_status !== 'certified' && (
                <p className="paiement-form__blocker">
                  Paiement bloqué : la certification DGI doit être rattachée par le canal sécurisé.
                </p>
              )}
              {!canExecutePayment && (
                <p className="paiement-form__blocker">
                  Paiement en lecture seule : session AAL2 et capacité d’exécution requises.
                </p>
              )}
            </section>

            <section className="sn-card">
              <div className="sn-card__head">
                <div>
                  <h3>Bénéficiaire</h3>
                  <p className="sn-card__hint">Artisan destinataire du règlement.</p>
                </div>
              </div>
              <div className="paiement-form__beneficiaire">
                <p>
                  <UserRound aria-hidden="true" />
                  <strong>{artisanLabel(artisan)}</strong>
                </p>
                <ul>
                  <li><Receipt aria-hidden="true" /> Carte {artisan?.numero_carte || 'non renseignée'}</li>
                  <li><FileText aria-hidden="true" /> Vente {vente.numero_recu || '—'}</li>
                  <li><Banknote aria-hidden="true" /> {decimal.format(vente.quantite_grammes)} g déclarés</li>
                </ul>
              </div>
            </section>

            <Note tone="info" icon={Receipt}>
              Le montant réglé est celui de la facture définitive.
            </Note>
          </aside>
        </div>
      </div>
    </NationalDashboardLayout>
  );
}
