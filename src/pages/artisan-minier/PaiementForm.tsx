import { FormEvent, useEffect, useMemo, useState } from 'react';
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
  type FactureDefinitive,
  type PaiementArtisan,
} from '@/services/artisanPaiementsService';
import { artisanGoldSalesService, type ArtisanGoldSale } from '@/services/artisanGoldSalesService';
import { artisanMinierService, type ArtisanMinier } from '@/services/artisanMinierService';
import { telechargerFacturePaiementArtisan } from '@/services/factureArtisanPdfService';
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
      adresse: artisan?.adresse,
      telephone: artisan?.telephone,
      numero_carte: artisan?.numero_carte,
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

  const [vente, setVente] = useState<ArtisanGoldSale | null>(null);
  const [artisan, setArtisan] = useState<ArtisanMinier | null>(null);
  const [facture, setFacture] = useState<FactureDefinitive | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [typePaiement, setTypePaiement] = useState<TypePaiement>('virement_bancaire');
  const [details, setDetails] = useState<Record<string, string>>({ type_compte: 'courant', devise: 'FCFA' });
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

        try {
          setArtisan(await artisanMinierService.getById(venteData.artisan_id));
        } catch {
          setArtisan(null);
        }

        let factureData = await artisanPaiementsService.getFactureByVenteId(venteId);
        if (!factureData && venteData.statut === 'validee') {
          const taxes = await artisanPaiementsService.calculerTaxes(venteData.montant_total_fcfa, 18, 1.5);
          factureData = await artisanPaiementsService.creerFactureDefinitive({
            vente_or_id: venteId,
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
            emise_par: user?.id,
          });
        }

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
  }, [user?.id, venteId]);

  const methode = useMemo(
    () => MOYENS_PAIEMENT.find((item) => item.id === typePaiement) || MOYENS_PAIEMENT[0],
    [typePaiement]
  );
  const champs = useMemo(() => fieldsForMethod(typePaiement), [typePaiement]);
  const manquants = useMemo(() => missingRequiredFields(typePaiement, details), [details, typePaiement]);

  const changerMethode = (method: TypePaiement) => {
    setTypePaiement(method);
    // Les détails d'un moyen ne valent pas pour un autre : on repart d'un état propre.
    setDetails(method === 'virement_bancaire' ? { type_compte: 'courant', devise: 'FCFA' } : {});
  };

  const paiementCourant = (): PaiementArtisan =>
    ({
      facture_id: facture?.id,
      vente_or_id: venteId,
      artisan_id: vente?.artisan_id,
      type_paiement: typePaiement,
      montant_paye: facture?.montant_net_a_payer || 0,
      montant_taxes_retenues: facture?.montant_total_taxes || 0,
      details_paiement: details,
      statut: 'en_attente',
      date_paiement: new Date().toISOString(),
      traite_par: user?.id,
      notes,
    }) as PaiementArtisan;

  const telechargerFacture = () => {
    if (!facture || !vente) {
      showError('Le dossier est incomplet : facture ou vente manquante.');
      return;
    }
    try {
      telechargerFacturePaiementArtisan(buildInvoicePayload(facture, paiementCourant(), artisan, vente));
    } catch {
      showError('La génération de la facture PDF a échoué.');
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return; // garde-fou contre la double soumission

    if (!facture) {
      showError('Aucune facture définitive n’est rattachée à cette vente.');
      return;
    }
    if (manquants.length > 0) {
      showError(`Champs obligatoires manquants : ${manquants.join(', ')}.`);
      return;
    }

    setSubmitting(true);
    try {
      await artisanPaiementsService.creerPaiement(paiementCourant());
      showSuccess('Paiement enregistré');

      const veutFacture = await confirmation.open({
        title: 'Télécharger la facture ?',
        message: 'Le paiement est enregistré. Vous pouvez télécharger la facture PDF maintenant.',
        confirmText: 'Télécharger',
        cancelText: 'Plus tard',
        severity: 'info',
      });
      if (veutFacture) telechargerFacture();

      navigate('/artisan-minier/paiements');
    } catch {
      showError("L'enregistrement du paiement a échoué. Aucune écriture n'a été effectuée.");
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
              <button type="button" className="sn-btn" onClick={telechargerFacture}>
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
              tone="emerald"
              title="Moyen de paiement"
              description="Le formulaire s’adapte au canal retenu : seuls les champs utiles sont demandés."
            >
              <div className="paiement-form__methods" role="radiogroup" aria-label="Moyen de paiement">
                {MOYENS_PAIEMENT.map((item) => {
                  const Logo = item.Logo;
                  return (
                    <label key={item.id} className={typePaiement === item.id ? 'is-checked' : ''}>
                      <input
                        type="radio"
                        name="moyen-paiement"
                        value={item.id}
                        checked={typePaiement === item.id}
                        onChange={() => changerMethode(item.id)}
                      />
                      <span className="paiement-form__method-logo"><Logo /></span>
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.description}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
            </Section>

            <Section
              id="coordonnees"
              icon={Landmark}
              tone="blue"
              title={`Coordonnées — ${methode.label}`}
              description="Informations nécessaires à l’exécution du règlement."
            >
              {champs.length === 0 ? (
                <p className="sn-empty">Aucune information complémentaire requise.</p>
              ) : (
                <div className="paiement-form__grid">
                  {champs.map((champ) => (
                    <Field
                      key={champ.key}
                      label={champ.label}
                      required={champ.required}
                      hint={champ.hint}
                      wide={champ.wide}
                    >
                      {champ.type === 'select' ? (
                        <select
                          value={details[champ.key] || champ.options?.[0]?.value || ''}
                          onChange={(event) => setDetails((current) => ({ ...current, [champ.key]: event.target.value }))}
                        >
                          {champ.options?.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={champ.type === 'date' ? 'date' : 'text'}
                          value={details[champ.key] || ''}
                          placeholder={champ.placeholder}
                          onChange={(event) => setDetails((current) => ({ ...current, [champ.key]: event.target.value }))}
                          required={champ.required}
                        />
                      )}
                    </Field>
                  ))}
                </div>
              )}
            </Section>

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
              <button type="submit" className="sn-btn sn-btn--primary" disabled={submitting || manquants.length > 0}>
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
              {manquants.length > 0 && (
                <p className="paiement-form__blocker">
                  À compléter : {manquants.join(', ')}.
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
              Le montant réglé est celui de la facture définitive : il ne peut pas être
              modifié depuis cet écran.
            </Note>
          </aside>
        </div>
      </div>
    </NationalDashboardLayout>
  );
}
