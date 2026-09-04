import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  Boxes,
  Coins,
  Gem,
  Loader2,
  RefreshCw,
  Save,
  Scale,
  Shapes,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, Breadcrumb, Field, Segmented } from '@/components/ui/sn';
import { CustomAlert } from '@/components/ui/CustomAlert';
import { TROY_OZ_GRAMS } from '@/constants/goldConstants';
import { useAuth } from '@/contexts/AuthContext';
import { ecartAuCours, useCoursOr } from '@/hooks/useCoursOr';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import { isComptoirScopedUser } from '@/lib/comptoirAccess';
import {
  artisanGoldSalesService,
  type ArtisanStatistics,
} from '@/services/artisanGoldSalesService';
import { artisanMinierService, type ArtisanMinier } from '@/services/artisanMinierService';
import { tauxAchatService, type TauxAchat } from '@/services/tauxAchatService';
import { genererNumeroRecu } from '@/services/venteRecuNumberService';
import './vente-or-form.css';

type TypeOr = 'poudre' | 'lingot' | 'pepites' | 'bijoux' | 'autre';
type Statut = 'en_attente' | 'validee' | 'payee' | 'annulee';
type ValidationKey =
  | 'artisan_id'
  | 'date_vente'
  | 'type_or'
  | 'quantite_grammes'
  | 'purete_pourcentage'
  | 'prix_unitaire_fcfa'
  | 'statut';

interface VenteOrFormData {
  artisan_id: string;
  date_vente: string;
  type_or: TypeOr;
  quantite_grammes: number;
  purete_karat: number;
  purete_pourcentage: number;
  /** Prix au gramme ; converti au kilogramme à l'enregistrement. */
  prix_unitaire_fcfa: number;
  numero_recu: string;
  observations: string;
  statut: Statut;
}

const dateAujourdhui = () => {
  const maintenant = new Date();
  const decalage = maintenant.getTimezoneOffset() * 60_000;
  return new Date(maintenant.getTime() - decalage).toISOString().slice(0, 10);
};

const INITIAL_FORM_DATA: VenteOrFormData = {
  artisan_id: '',
  date_vente: dateAujourdhui(),
  type_or: 'pepites',
  quantite_grammes: 0,
  purete_karat: 22,
  purete_pourcentage: 91.67,
  prix_unitaire_fcfa: 0,
  numero_recu: '',
  observations: '',
  statut: 'en_attente',
};

const TYPE_OR_OPTIONS: Array<{
  value: TypeOr;
  label: string;
  description: string;
  icon: typeof Coins;
}> = [
  { value: 'poudre', label: 'Poudre', description: 'Or alluvionnaire non fondu', icon: Sparkles },
  { value: 'lingot', label: 'Lingot', description: 'Or fondu et moulé', icon: Boxes },
  { value: 'pepites', label: 'Pépites', description: 'Or natif brut', icon: Gem },
  { value: 'bijoux', label: 'Bijoux', description: 'Or travaillé ou usagé', icon: Coins },
  { value: 'autre', label: 'Autre', description: 'Forme non répertoriée', icon: Shapes },
];

const STATUT_OPTIONS: Array<{ value: Statut; label: string }> = [
  { value: 'en_attente', label: 'En attente' },
  { value: 'validee', label: 'Validée' },
];

const KARAT_PRESETS = [18, 20, 21, 22, 24] as const;

/** Statuts verrouillant la modification d'une vente. */
export const STATUTS_VERROUILLES: Statut[] = ['validee', 'payee'];

const integer = new Intl.NumberFormat('fr-FR');
const decimal = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const usd = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const dateFr = new Intl.DateTimeFormat('fr-FR');
const dateHeureFr = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const formatFcfa = (value: number) => `${integer.format(Math.round(value || 0))} FCFA`;
const formatDate = (value: string | null | undefined) => {
  if (!value) return '—';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? '—' : dateFr.format(date);
};

export const karatToPercentage = (karat: number) => Math.round((karat / 24) * 10_000) / 100;
export const percentageToKarat = (percentage: number) =>
  Math.round((percentage / 100) * 24 * 100) / 100;

export const artisanDisplayName = (artisan: ArtisanMinier) => {
  const base =
    artisan.raison_sociale ||
    [artisan.nom, artisan.prenoms].filter(Boolean).join(' ') ||
    'Artisan';
  return artisan.numero_carte ? `${base} (${artisan.numero_carte})` : base;
};

export function validerVenteOr(form: VenteOrFormData): Partial<Record<ValidationKey, string>> {
  const erreurs: Partial<Record<ValidationKey, string>> = {};
  if (!form.artisan_id) erreurs.artisan_id = 'Sélectionnez l’artisan vendeur.';

  const date = new Date(`${form.date_vente}T00:00:00`);
  if (!form.date_vente) erreurs.date_vente = 'La date de vente est obligatoire.';
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date_vente) || Number.isNaN(date.getTime()))
    erreurs.date_vente = 'Saisissez une date valide.';
  else if (form.date_vente > dateAujourdhui())
    erreurs.date_vente = 'La date de vente ne peut pas être future.';

  if (!TYPE_OR_OPTIONS.some((option) => option.value === form.type_or))
    erreurs.type_or = 'Sélectionnez une nature d’or valide.';
  if (!(form.quantite_grammes > 0))
    erreurs.quantite_grammes = 'La quantité doit être supérieure à zéro.';
  if (!(form.purete_pourcentage > 0 && form.purete_pourcentage <= 100))
    erreurs.purete_pourcentage = 'La pureté doit être comprise entre 0 et 100 %.';
  else if (Math.abs(karatToPercentage(form.purete_karat) - form.purete_pourcentage) > 0.02)
    erreurs.purete_pourcentage = 'La pureté et le nombre de carats sont incohérents.';
  if (!(form.prix_unitaire_fcfa > 0))
    erreurs.prix_unitaire_fcfa = 'Le prix au gramme doit être supérieur à zéro.';
  if (!STATUT_OPTIONS.some((option) => option.value === form.statut))
    erreurs.statut = 'Sélectionnez un statut valide.';
  return erreurs;
}

function FormSection({
  number,
  title,
  description,
  className = '',
  children,
}: {
  number: number;
  title: string;
  description: string;
  className?: string;
  children: ReactNode;
}) {
  const id = `vente-form-section-${number}`;
  return (
    <section className={`vente-form__section ${className}`.trim()} aria-labelledby={id}>
      <header className="vente-form__section-head">
        <span aria-hidden="true">{number}</span>
        <div>
          <h2 id={id}>{title}</h2>
          <p>{description}</p>
        </div>
      </header>
      <div className="vente-form__section-body">{children}</div>
    </section>
  );
}

export default function VenteOrForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isComptoir = isComptoirScopedUser(user);
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const {
    cours,
    tauxUsdXof,
    prixGrammeFcfa,
    derniereMaj,
    chargement: coursEnCours,
    erreur: coursErreur,
    actualiser: actualiserCours,
  } = useCoursOr();
  const { alertState, showSuccess, showError, closeAlert } = useCustomAlert();

  const [form, setForm] = useState<VenteOrFormData>(INITIAL_FORM_DATA);
  const [artisans, setArtisans] = useState<ArtisanMinier[]>([]);
  const [artisanStats, setArtisanStats] = useState<ArtisanStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [saving, setSaving] = useState(false);
  const [numeroEnCours, setNumeroEnCours] = useState(!isEditMode);
  const [numeroErreur, setNumeroErreur] = useState<string | null>(null);
  const [coursActualise, setCoursActualise] = useState(false);
  const [prixInitialise, setPrixInitialise] = useState(false);
  const [taux, setTaux] = useState<TauxAchat | null>(null);
  const [tauxErreur, setTauxErreur] = useState<string | null>(null);
  const [tauxEnCours, setTauxEnCours] = useState(true);
  const [soumis, setSoumis] = useState(false);
  const [touches, setTouches] = useState<Partial<Record<ValidationKey, boolean>>>({});
  const savingRef = useRef(false);
  const navigationTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (navigationTimerRef.current !== null) {
      window.clearTimeout(navigationTimerRef.current);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    const load = async () => {
      try {
        const data = await artisanMinierService.getAll();
        if (mounted) {
          const artisansActifs = (data || []).filter((artisan) => artisan.actif !== false);
          // Le type genere par Supabase conserve certains champs historiques
          // comme nullables, tandis que le modele d'affichage les expose comme
          // optionnels. Cette conversion reste volontairement a la frontiere UI.
          setArtisans(artisansActifs as unknown as ArtisanMinier[]);
        }
      } catch {
        if (mounted) showError('Impossible de charger la liste des artisans');
      }

      if (isEditMode && id) {
        try {
          const vente = await artisanGoldSalesService.getById(id);
          if (!mounted) return;
          if (!vente) showError('Vente introuvable');
          else if (STATUTS_VERROUILLES.includes(vente.statut as Statut)) {
            showError('Impossible de modifier une vente validée ou payée');
            navigationTimerRef.current = window.setTimeout(
              () => navigate(`/artisan-minier/ventes-or/${id}`),
              1500,
            );
          } else {
            setForm({
              artisan_id: vente.artisan_id,
              date_vente: (vente.date_vente || '').split('T')[0],
              type_or: vente.type_or as TypeOr,
              quantite_grammes: vente.quantite_grammes,
              purete_karat: vente.purete_karat,
              purete_pourcentage: karatToPercentage(vente.purete_karat),
              prix_unitaire_fcfa: vente.prix_kg_fcfa / 1000,
              numero_recu: vente.numero_recu || '',
              observations: vente.observations || '',
              statut: vente.statut as Statut,
            });
          }
        } catch {
          if (mounted) showError('Impossible de charger la vente');
        }
      }

      if (mounted) setLoading(false);
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [id, isEditMode, navigate]);

  useEffect(() => {
    if (isEditMode || prixInitialise || prixGrammeFcfa === null) return;
    setPrixInitialise(true);
    setForm((courant) =>
      courant.prix_unitaire_fcfa > 0
        ? courant
        : { ...courant, prix_unitaire_fcfa: Math.round(prixGrammeFcfa) },
    );
  }, [isEditMode, prixInitialise, prixGrammeFcfa]);

  useEffect(() => {
    if (isEditMode) return;
    let mounted = true;
    setNumeroEnCours(true);
    genererNumeroRecu()
      .then((numero) => {
        if (!mounted) return;
        setForm((courant) => ({ ...courant, numero_recu: numero }));
        setNumeroErreur(null);
      })
      .catch(() => {
        if (mounted) setNumeroErreur('La référence n’a pas pu être générée.');
      })
      .finally(() => {
        if (mounted) setNumeroEnCours(false);
      });
    return () => {
      mounted = false;
    };
  }, [isEditMode]);

  useEffect(() => {
    if (!form.artisan_id) {
      setArtisanStats(null);
      return;
    }
    let mounted = true;
    setLoadingStats(true);
    artisanGoldSalesService
      .getArtisanStatistics(form.artisan_id)
      .then((stats) => {
        if (mounted) setArtisanStats(stats);
      })
      .catch(() => {
        if (mounted) setArtisanStats(null);
      })
      .finally(() => {
        if (mounted) setLoadingStats(false);
      });
    return () => {
      mounted = false;
    };
  }, [form.artisan_id]);

  useEffect(() => {
    if (!form.date_vente) return;
    let actif = true;
    setTauxEnCours(true);
    setTaux(null);
    tauxAchatService
      .pourAchat('artisan', form.date_vente)
      .then((resolu) => {
        if (actif) {
          setTaux(resolu);
          setTauxErreur(null);
        }
      })
      .catch(() => {
        if (actif) setTauxErreur('Les taux applicables n’ont pas pu être lus.');
      })
      .finally(() => {
        if (actif) setTauxEnCours(false);
      });
    return () => {
      actif = false;
    };
  }, [form.date_vente]);

  const selectedArtisan = useMemo(
    () => artisans.find((artisan) => artisan.id === form.artisan_id) || null,
    [artisans, form.artisan_id],
  );

  const taxes = useMemo(
    () =>
      artisanGoldSalesService.calculateTaxes(
        form.quantite_grammes,
        form.prix_unitaire_fcfa * 1000,
        taux?.tvaPourcent ?? 0,
        taux?.taxeCommunalePourcent ?? 0,
      ),
    [form.prix_unitaire_fcfa, form.quantite_grammes, taux],
  );
  const errors = useMemo(() => validerVenteOr(form), [form]);
  const taxesSansRegle = taux?.taxesSansRegle ?? [];
  const ecart = ecartAuCours(form.prix_unitaire_fcfa, prixGrammeFcfa);
  const quantiteOnces = form.quantite_grammes / TROY_OZ_GRAMS;
  const orFin = (form.quantite_grammes * form.purete_pourcentage) / 100;
  const prixOnceFcfa = cours && tauxUsdXof ? cours.price * tauxUsdXof : null;

  const erreurVisible = (key: ValidationKey) => (soumis || touches[key] ? errors[key] : undefined);
  const marquerTouche = (key: ValidationKey) =>
    setTouches((courant) => ({ ...courant, [key]: true }));
  const setValue = <K extends keyof VenteOrFormData>(key: K, value: VenteOrFormData[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const handleKarat = (karat: number) => {
    setForm((current) => ({
      ...current,
      purete_karat: karat,
      purete_pourcentage: karatToPercentage(karat),
    }));
    marquerTouche('purete_pourcentage');
  };

  const handlePourcentage = (pourcentage: number) => {
    const borne = Math.min(100, Math.max(0, pourcentage));
    setForm((current) => ({
      ...current,
      purete_pourcentage: borne,
      purete_karat: percentageToKarat(borne),
    }));
  };

  const handleRefreshCours = async () => {
    setCoursActualise(true);
    try {
      await actualiserCours();
    } finally {
      setCoursActualise(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (savingRef.current) return;
    setSoumis(true);

    const premierMessage = Object.values(errors)[0];
    if (premierMessage) {
      showError(premierMessage);
      return;
    }
    if (numeroEnCours || (!isEditMode && !form.numero_recu)) {
      showError(numeroErreur || 'La référence de vente est en cours de génération.');
      return;
    }
    if (tauxEnCours || tauxErreur || !taux) {
      showError(tauxErreur || 'Les règles fiscales sont en cours de chargement.');
      return;
    }
    if (taxesSansRegle.length > 0) {
      showError(
        `Aucune règle fiscale en vigueur pour : ${taxesSansRegle.join(', ')}. ` +
          'Renseignez le barème avant d’enregistrer cette vente.',
      );
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const payload = {
        artisan_id: form.artisan_id,
        date_vente: form.date_vente,
        type_or: form.type_or,
        quantite_grammes: form.quantite_grammes,
        purete_karat: Math.round(form.purete_karat),
        prix_kg_fcfa: form.prix_unitaire_fcfa * 1000,
        montant_brut_fcfa: taxes.montant_brut_fcfa,
        tva_taux: taux.tvaPourcent ?? 0,
        tva_montant_fcfa: taxes.tva_montant_fcfa,
        taxe_dev_comm_taux: taux.taxeCommunalePourcent ?? 0,
        taxe_dev_comm_montant_fcfa: taxes.taxe_dev_comm_montant_fcfa,
        montant_total_fcfa: taxes.montant_total_fcfa,
        observations: form.observations.trim(),
        statut: form.statut,
      };

      let venteId = id;
      if (isEditMode && id) {
        const vente = await artisanGoldSalesService.update(id, payload);
        venteId = vente.id;
        showSuccess('Vente mise à jour avec succès');
      } else {
        const vente = await artisanGoldSalesService.create({
          ...payload,
          numero_recu: form.numero_recu,
        });
        venteId = vente.id;
        showSuccess('Vente enregistrée avec succès');
      }
      navigationTimerRef.current = window.setTimeout(
        () => navigate(venteId ? `/artisan-minier/ventes-or/${venteId}` : '/artisan-minier/ventes-or'),
        900,
      );
    } catch (reason) {
      showError(reason instanceof Error ? reason.message : "Erreur lors de l’enregistrement");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const titreAction = isEditMode
    ? `Mettre à jour ${isComptoir ? 'l’achat' : 'la vente'}`
    : `Enregistrer ${isComptoir ? 'l’achat' : 'la vente'}`;

  return (
    <NationalDashboardLayout>
      <main className="sn-page vente-form">
        <CustomAlert {...alertState} onClose={closeAlert} />

        <header className="vente-form__top">
          <Breadcrumb
            entries={[
              {
                label: isComptoir ? 'Comptoir' : 'Artisans miniers',
                to: isComptoir ? '/portail-comptoir' : '/artisan-minier',
              },
              { label: isComptoir ? "Achats d’or" : "Ventes d’or", to: '/artisan-minier/ventes-or' },
              { label: isEditMode ? 'Modification' : isComptoir ? 'Nouvel achat' : 'Nouvelle vente' },
            ]}
          />

          <div className="vente-form__heading">
            <span className="vente-form__heading-icon"><Scale aria-hidden="true" /></span>
            <div>
              <h1>
                {isEditMode
                  ? `Modifier ${isComptoir ? 'l’achat' : 'la vente'} d’or`
                  : `Enregistrer ${isComptoir ? 'un achat' : 'une vente'} d’or`}
              </h1>
              <p>Collecte auprès d’un orpailleur rattaché, taxes calculées automatiquement.</p>
            </div>
          </div>

          <section className="vente-form__reference" aria-label="Référence de la vente">
            <span>N° DE VENTE</span>
            <strong>
              {numeroEnCours ? <Loader2 className="sn-spin" aria-label="Génération de la référence" /> : null}
              {form.numero_recu || '—'}
            </strong>
            <small>{numeroErreur || 'Référence unique de la vente'}</small>
          </section>

          <button
            type="button"
            className="vente-form__back"
            onClick={() => navigate('/artisan-minier/ventes-or')}
          >
            <ArrowLeft aria-hidden="true" /> Retour au registre
          </button>
        </header>

        {loading ? (
          <div className="vente-form__loading">
            <Loader2 className="sn-spin" aria-hidden="true" /> Chargement du formulaire…
          </div>
        ) : (
          <div className="vente-form__layout">
            <form className="vente-form__main" onSubmit={handleSubmit} noValidate>
              <FormSection
                number={1}
                title="VENDEUR ET DÉCLARATION"
                description="Informations sur l’artisan vendeur et la transaction"
                className="vente-form__section--seller"
              >
                <div className="vente-form__seller-grid">
                  <Field label="Artisan vendeur" required error={erreurVisible('artisan_id')}>
                    <select
                      value={form.artisan_id}
                      aria-invalid={Boolean(erreurVisible('artisan_id'))}
                      onBlur={() => marquerTouche('artisan_id')}
                      onChange={(event) => setValue('artisan_id', event.target.value)}
                    >
                      <option value="">Sélectionner un artisan</option>
                      {artisans.map((artisan) => (
                        <option key={artisan.id} value={artisan.id}>
                          {artisanDisplayName(artisan)}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Date de vente" required error={erreurVisible('date_vente')}>
                    <input
                      type="date"
                      value={form.date_vente}
                      max={dateAujourdhui()}
                      aria-invalid={Boolean(erreurVisible('date_vente'))}
                      onBlur={() => marquerTouche('date_vente')}
                      onChange={(event) => setValue('date_vente', event.target.value)}
                    />
                  </Field>

                  <div className="vente-form__status-field">
                    <span className="sn-field__label">
                      Statut de la déclaration <i aria-hidden="true">*</i>
                    </span>
                    <Segmented
                      name="statut-vente"
                      value={form.statut}
                      options={STATUT_OPTIONS}
                      onChange={(statut) => setValue('statut', statut)}
                      ariaLabel="Statut de la déclaration"
                    />
                    {erreurVisible('statut') && <small className="is-error">{erreurVisible('statut')}</small>}
                  </div>
                </div>
              </FormSection>

              <FormSection
                number={2}
                title="NATURE ET QUALITÉ DE L’OR"
                description="Caractéristiques de l’or collecté"
                className="vente-form__section--gold"
              >
                <div className="vente-form__nature-grid">
                  <fieldset className="vente-form__fieldset vente-form__types">
                    <legend className="sn-field__label">
                      Type d’or <i aria-hidden="true">*</i>
                    </legend>
                    <div className="vente-form__type-grid">
                      {TYPE_OR_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        return (
                          <label
                            key={option.value}
                            className={form.type_or === option.value ? 'is-active' : ''}
                          >
                            <input
                              type="radio"
                              name="type-or"
                              value={option.value}
                              checked={form.type_or === option.value}
                              onChange={() => setValue('type_or', option.value)}
                            />
                            <span><Icon aria-hidden="true" /></span>
                            <strong>{option.label}</strong>
                            <small>{option.description}</small>
                          </label>
                        );
                      })}
                    </div>
                    {erreurVisible('type_or') && <small className="is-error">{erreurVisible('type_or')}</small>}
                  </fieldset>

                  <fieldset className="vente-form__fieldset vente-form__quality">
                    <legend className="sn-field__label">
                      Qualité de l’or <i aria-hidden="true">*</i>
                    </legend>
                    <div className="vente-form__quality-grid">
                      {KARAT_PRESETS.map((karat) => (
                        <button
                          key={karat}
                          type="button"
                          aria-label={`Choisir la qualité ${karat} carats`}
                          className={Math.abs(form.purete_karat - karat) < 0.01 ? 'is-active' : ''}
                          onClick={() => handleKarat(karat)}
                        >
                          <strong>{karat} K</strong>
                          <small>{karatToPercentage(karat)}%</small>
                        </button>
                      ))}
                    </div>
                    <output className="vente-form__fine-gold">
                      {decimal.format(form.purete_karat)} carats&nbsp; • &nbsp;{decimal.format(orFin)} g d’or fin
                    </output>
                  </fieldset>
                </div>

                <div className="vente-form__gold-fields">
                  <Field
                    label="Quantité (grammes)"
                    required
                    error={erreurVisible('quantite_grammes')}
                  >
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="20000"
                      value={form.quantite_grammes || ''}
                      aria-invalid={Boolean(erreurVisible('quantite_grammes'))}
                      onBlur={() => marquerTouche('quantite_grammes')}
                      onChange={(event) => setValue('quantite_grammes', Number(event.target.value))}
                    />
                  </Field>

                  <Field label="Pureté (%)" required error={erreurVisible('purete_pourcentage')}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={form.purete_pourcentage}
                      aria-invalid={Boolean(erreurVisible('purete_pourcentage'))}
                      onBlur={() => marquerTouche('purete_pourcentage')}
                      onChange={(event) => handlePourcentage(Number(event.target.value))}
                    />
                  </Field>

                  <div className="vente-form__quick-karats">
                    <span className="sn-field__label">Pureté courante</span>
                    <div>
                      {KARAT_PRESETS.map((karat) => (
                        <button
                          key={karat}
                          type="button"
                          aria-label={`Pureté courante ${karat} carats`}
                          className={Math.abs(form.purete_karat - karat) < 0.01 ? 'is-active' : ''}
                          onClick={() => handleKarat(karat)}
                        >
                          {karat} K
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </FormSection>

              <FormSection
                number={3}
                title="VALORISATION"
                description="Évaluation et valorisation de l’or"
                className="vente-form__section--valuation"
              >
                <div className="vente-form__valuation-grid">
                  <Field
                    label="Prix au gramme (FCFA)"
                    required
                    error={erreurVisible('prix_unitaire_fcfa')}
                    hint={
                      coursErreur ||
                      (prixGrammeFcfa === null
                        ? 'Cours du marché indisponible.'
                        : `Cours du marché : ${integer.format(Math.round(prixGrammeFcfa))} FCFA/g`)
                    }
                  >
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={form.prix_unitaire_fcfa || ''}
                      aria-invalid={Boolean(erreurVisible('prix_unitaire_fcfa'))}
                      onBlur={() => marquerTouche('prix_unitaire_fcfa')}
                      onChange={(event) => setValue('prix_unitaire_fcfa', Number(event.target.value))}
                    />
                  </Field>

                  <div className="sn-field">
                    <span className="sn-field__label">Écart au cours</span>
                    <div
                      className={`vente-form__readonly vente-form__ecart ${
                        ecart === null ? '' : ecart < 0 ? 'is-negative' : 'is-positive'
                      }`}
                    >
                      {ecart !== null && ecart < 0 ? (
                        <ArrowDownRight aria-hidden="true" />
                      ) : (
                        <ArrowUpRight aria-hidden="true" />
                      )}
                      <output>{ecart === null ? '—' : `${ecart >= 0 ? '+' : ''}${decimal.format(ecart)} %`}</output>
                    </div>
                  </div>

                  <div className="sn-field">
                    <span className="sn-field__label">Équivalent au kilogramme</span>
                    <div className="vente-form__readonly">
                      <Banknote aria-hidden="true" />
                      <output>{formatFcfa(form.prix_unitaire_fcfa * 1000)}</output>
                    </div>
                  </div>

                  <div className="sn-field">
                    <span className="sn-field__label">Quantité en onces troy</span>
                    <div className="vente-form__readonly">
                      <output>{decimal.format(quantiteOnces)} oz</output>
                    </div>
                  </div>
                </div>
              </FormSection>

              <FormSection
                number={4}
                title="OBSERVATIONS"
                description="Contexte de la collecte et remarques"
                className="vente-form__section--observations"
              >
                <Field label="Observations">
                  <textarea
                    rows={3}
                    maxLength={1000}
                    placeholder="Ajouter une note sur cette vente…"
                    value={form.observations}
                    onChange={(event) => setValue('observations', event.target.value)}
                  />
                </Field>
              </FormSection>

              <footer className="vente-form__actions">
                <button
                  type="button"
                  className="vente-form__cancel"
                  onClick={() => navigate('/artisan-minier/ventes-or')}
                >
                  Annuler
                </button>
                <button type="submit" className="vente-form__submit" disabled={saving}>
                  {saving ? <Loader2 className="sn-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
                  {saving ? 'Enregistrement…' : titreAction}
                </button>
              </footer>
            </form>

            <aside className="vente-form__aside" aria-label="Récapitulatif et contexte">
              <section className="vente-form__aside-card vente-form__financial" aria-labelledby="recap-title">
                <header>
                  <span><Banknote aria-hidden="true" /></span>
                  <h2 id="recap-title">RÉCAPITULATIF FINANCIER</h2>
                </header>
                <dl>
                  <div><dt>Montant brut</dt><dd>{formatFcfa(taxes.montant_brut_fcfa)}</dd></div>
                  <div>
                    <dt>TVA ({decimal.format(taux?.tvaPourcent ?? 0)} %)</dt>
                    <dd>{formatFcfa(taxes.tva_montant_fcfa)}</dd>
                  </div>
                  <div>
                    <dt>Taxe de développement ({decimal.format(taux?.taxeCommunalePourcent ?? 0)} %)</dt>
                    <dd>{formatFcfa(taxes.taxe_dev_comm_montant_fcfa)}</dd>
                  </div>
                  <div className="is-total"><dt>MONTANT TOTAL</dt><dd>{formatFcfa(taxes.montant_total_fcfa)}</dd></div>
                </dl>
                {tauxEnCours && <p className="vente-form__aside-note">Chargement des règles fiscales…</p>}
                {tauxErreur && <p className="vente-form__aside-error" role="alert">{tauxErreur}</p>}
                {taxesSansRegle.length > 0 && (
                  <p className="vente-form__aside-error" role="alert">
                    Barème manquant : {taxesSansRegle.join(', ')}
                  </p>
                )}
              </section>

              <section className="vente-form__aside-card vente-form__artisan" aria-labelledby="artisan-title">
                <header>
                  <span><UserRound aria-hidden="true" /></span>
                  <h2 id="artisan-title">ARTISAN SÉLECTIONNÉ</h2>
                </header>
                {selectedArtisan ? (
                  <div className="vente-form__artisan-body">
                    <h3>{artisanDisplayName(selectedArtisan)}</h3>
                    <Badge tone="success">Actif</Badge>
                    <p>
                      {[selectedArtisan.commune || selectedArtisan.region, selectedArtisan.telephone]
                        .filter(Boolean)
                        .join(' · ') || 'Coordonnées non renseignées'}
                    </p>
                    {loadingStats ? (
                      <div className="vente-form__stats-loading">
                        <Loader2 className="sn-spin" aria-hidden="true" /> Chargement…
                      </div>
                    ) : (
                      <dl>
                        <div><dt>Ventes déclarées</dt><dd>{artisanStats?.nombre_ventes_total ?? 0}</dd></div>
                        <div>
                          <dt>Quantité cumulée</dt>
                          <dd>{decimal.format(artisanStats?.quantite_totale_grammes ?? 0)} g</dd>
                        </div>
                        <div>
                          <dt>Chiffre d’affaires</dt>
                          <dd>{formatFcfa(artisanStats?.chiffre_affaires_total ?? 0)}</dd>
                        </div>
                        <div>
                          <dt>Dernière vente</dt>
                          <dd>{formatDate(artisanStats?.date_derniere_vente)}</dd>
                        </div>
                      </dl>
                    )}
                  </div>
                ) : (
                  <p className="vente-form__artisan-empty">
                    Sélectionnez un artisan pour afficher son historique réel.
                  </p>
                )}
              </section>

              <section className="vente-form__aside-card vente-form__course" aria-labelledby="course-title">
                <header>
                  <span><Scale aria-hidden="true" /></span>
                  <h2 id="course-title">COURS DE L’OR</h2>
                  <button
                    type="button"
                    aria-label="Actualiser le cours de l’or"
                    onClick={() => void handleRefreshCours()}
                    disabled={coursActualise || coursEnCours}
                  >
                    <RefreshCw className={coursActualise || coursEnCours ? 'sn-spin' : ''} aria-hidden="true" />
                  </button>
                </header>
                <div className="vente-form__course-body">
                  <p className="vente-form__course-price">
                    {cours ? usd.format(cours.price) : '—'} <small>USD / oz</small>
                  </p>
                  <p className="vente-form__variation">
                    {typeof cours?.changePercent24h === 'number'
                      ? `Variation 24 h : ${cours.changePercent24h >= 0 ? '+' : ''}${decimal.format(cours.changePercent24h)} %`
                      : 'Variation non communiquée par la source'}
                  </p>
                  {coursErreur && <p className="vente-form__course-error">{coursErreur}</p>}
                  <dl>
                    <div><dt>Par once</dt><dd>{prixOnceFcfa === null ? '—' : formatFcfa(prixOnceFcfa)}</dd></div>
                    <div><dt>Par gramme</dt><dd>{prixGrammeFcfa === null ? '—' : formatFcfa(prixGrammeFcfa)}</dd></div>
                  </dl>
                  <footer>
                    Dernière mise à jour : {derniereMaj ? dateHeureFr.format(derniereMaj) : '—'}
                  </footer>
                </div>
              </section>
            </aside>
          </div>
        )}
      </main>
    </NationalDashboardLayout>
  );
}
