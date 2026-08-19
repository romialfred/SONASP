import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Banknote,
  Boxes,
  Calculator,
  Coins,
  Gem,
  Loader2,
  Save,
  Scale,
  Sparkles,
  StickyNote,
  UserRound,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import {
  Badge,
  Field,
  Note,
  PageHeader,
  Section,
  Segmented,
} from '@/components/ui/sn';
import { LiveGoldPricePanel } from '@/components/prices/LiveGoldPricePanel';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import { CustomAlert } from '@/components/ui/CustomAlert';
import { artisanGoldSalesService, type ArtisanStatistics } from '@/services/artisanGoldSalesService';
import { artisanMinierService, type ArtisanMinier } from '@/services/artisanMinierService';
import { TROY_OZ_GRAMS } from '@/constants/goldConstants';
import './vente-or-form.css';

type TypeOr = 'poudre' | 'lingot' | 'pepites' | 'bijoux' | 'autre';
type Statut = 'en_attente' | 'validee' | 'payee' | 'annulee';

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

const INITIAL_FORM_DATA: VenteOrFormData = {
  artisan_id: '',
  date_vente: new Date().toISOString().split('T')[0],
  type_or: 'lingot',
  quantite_grammes: 0,
  purete_karat: 22,
  purete_pourcentage: 91.67,
  prix_unitaire_fcfa: 0,
  numero_recu: '',
  observations: '',
  statut: 'en_attente',
};

const TYPE_OR_OPTIONS: Array<{ value: TypeOr; label: string; description: string; icon: typeof Coins }> = [
  { value: 'poudre', label: 'Poudre', description: 'Or alluvionnaire non fondu', icon: Sparkles },
  { value: 'lingot', label: 'Lingot', description: 'Or fondu et moulé', icon: Boxes },
  { value: 'pepites', label: 'Pépites', description: 'Or natif brut', icon: Gem },
  { value: 'bijoux', label: 'Bijoux', description: 'Or travaillé', icon: Coins },
  { value: 'autre', label: 'Autre', description: 'Forme non répertoriée', icon: Coins },
];

const STATUT_OPTIONS: Array<{ value: Statut; label: string }> = [
  { value: 'en_attente', label: 'En attente' },
  { value: 'validee', label: 'Validée' },
];

/** Titres légaux courants ; la saisie libre en pourcentage reste possible. */
const KARAT_PRESETS = [18, 20, 21, 22, 24];

/** Statuts verrouillant la modification d'une vente. */
export const STATUTS_VERROUILLES: Statut[] = ['validee', 'payee'];

const TVA_TAUX = 18;
const TAXE_DEV_COMM_TAUX = 1;

const integer = new Intl.NumberFormat('fr-FR');
const decimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatFcfa = (value: number) => `${integer.format(Math.round(value || 0))} FCFA`;

export const karatToPercentage = (karat: number) => Math.round((karat / 24) * 10_000) / 100;
export const percentageToKarat = (percentage: number) => Math.round((percentage / 100) * 24 * 100) / 100;

export const artisanDisplayName = (artisan: ArtisanMinier) => {
  const base = artisan.raison_sociale || [artisan.nom, artisan.prenoms].filter(Boolean).join(' ') || 'Artisan';
  return artisan.numero_carte ? `${base} (${artisan.numero_carte})` : base;
};

export default function VenteOrForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const [form, setForm] = useState<VenteOrFormData>(INITIAL_FORM_DATA);
  const [artisans, setArtisans] = useState<ArtisanMinier[]>([]);
  const [artisanStats, setArtisanStats] = useState<ArtisanStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [saving, setSaving] = useState(false);
  const { alertState, showSuccess, showError, closeAlert } = useCustomAlert();

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    const load = async () => {
      try {
        const data = await artisanMinierService.getAll();
        if (mounted) setArtisans((data || []).filter((artisan: ArtisanMinier) => artisan.actif !== false));
      } catch {
        if (mounted) showError('Impossible de charger la liste des artisans');
      }

      if (isEditMode && id) {
        try {
          const vente = await artisanGoldSalesService.getById(id);
          if (!mounted) return;
          if (!vente) {
            showError('Vente introuvable');
          } else if (STATUTS_VERROUILLES.includes(vente.statut as Statut)) {
            showError('Impossible de modifier une vente validée ou payée');
            setTimeout(() => navigate(`/artisan-minier/ventes-or/${id}`), 1500);
          } else {
            setForm({
              artisan_id: vente.artisan_id,
              date_vente: (vente.date_vente || '').split('T')[0],
              type_or: vente.type_or as TypeOr,
              quantite_grammes: vente.quantite_grammes,
              purete_karat: vente.purete_karat,
              purete_pourcentage: karatToPercentage(vente.purete_karat),
              // Le prix est stocké au kilogramme et saisi au gramme.
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
  }, [id, isEditMode]);

  useEffect(() => {
    if (!form.artisan_id) {
      setArtisanStats(null);
      return;
    }
    let mounted = true;
    setLoadingStats(true);
    artisanGoldSalesService
      .getArtisanStatistics(form.artisan_id)
      .then((stats) => mounted && setArtisanStats(stats))
      .catch(() => mounted && setArtisanStats(null))
      .finally(() => mounted && setLoadingStats(false));
    return () => {
      mounted = false;
    };
  }, [form.artisan_id]);

  const selectedArtisan = useMemo(
    () => artisans.find((artisan) => artisan.id === form.artisan_id) || null,
    [artisans, form.artisan_id]
  );

  /**
   * Détail fiscal calculé par la **même** fonction que l'enregistrement.
   * L'ancienne version affichait le montant brut sous le libellé « Montant total »,
   * alors que la vente enregistrée valait brut + TVA + taxe de développement : le
   * montant présenté était inférieur de 19 % à celui écrit en base.
   */
  const taxes = useMemo(
    () =>
      artisanGoldSalesService.calculateTaxes(
        form.quantite_grammes,
        form.prix_unitaire_fcfa * 1000,
        TVA_TAUX,
        TAXE_DEV_COMM_TAUX
      ),
    [form.prix_unitaire_fcfa, form.quantite_grammes]
  );

  const quantiteOnces = form.quantite_grammes / TROY_OZ_GRAMS;
  const orFin = (form.quantite_grammes * form.purete_pourcentage) / 100;

  const setValue = <K extends keyof VenteOrFormData>(key: K, value: VenteOrFormData[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const handleKarat = (karat: number) =>
    setForm((current) => ({ ...current, purete_karat: karat, purete_pourcentage: karatToPercentage(karat) }));

  const handlePourcentage = (pourcentage: number) => {
    const borne = Math.min(100, Math.max(0, pourcentage));
    setForm((current) => ({
      ...current,
      purete_pourcentage: borne,
      purete_karat: percentageToKarat(borne),
    }));
  };

  const validate = (): string | null => {
    if (!form.artisan_id) return 'Sélectionnez l’artisan vendeur.';
    if (!form.date_vente) return 'La date de vente est obligatoire.';
    if (form.quantite_grammes <= 0) return 'La quantité doit être supérieure à zéro.';
    if (form.prix_unitaire_fcfa <= 0) return 'Le prix au gramme doit être supérieur à zéro.';
    if (form.purete_pourcentage <= 0 || form.purete_pourcentage > 100)
      return 'La pureté doit être comprise entre 0 et 100 %.';
    return null;
  };

  const validationError = validate();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return; // garde-fou contre la double soumission

    const message = validate();
    if (message) {
      showError(message);
      return;
    }

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
        tva_taux: TVA_TAUX,
        tva_montant_fcfa: taxes.tva_montant_fcfa,
        taxe_dev_comm_taux: TAXE_DEV_COMM_TAUX,
        taxe_dev_comm_montant_fcfa: taxes.taxe_dev_comm_montant_fcfa,
        montant_total_fcfa: taxes.montant_total_fcfa,
        numero_recu: form.numero_recu,
        observations: form.observations,
        statut: form.statut,
      };

      if (isEditMode && id) {
        await artisanGoldSalesService.update(id, payload);
        showSuccess('Vente mise à jour avec succès');
      } else {
        await artisanGoldSalesService.create(payload);
        showSuccess('Vente enregistrée avec succès');
      }
      setTimeout(() => navigate('/artisan-minier/ventes-or'), 1200);
    } catch (reason) {
      showError(reason instanceof Error ? reason.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <NationalDashboardLayout>
      <div className="sn-page vente-form">
        <CustomAlert {...alertState} onClose={closeAlert} />

        <PageHeader
          icon={Coins}
          title={isEditMode ? 'Modifier la vente d’or' : 'Enregistrer une vente d’or'}
          subtitle="Déclaration d’une collecte auprès d’un artisan minier, taxes calculées automatiquement."
          breadcrumb={[
            { label: 'Artisans miniers', to: '/artisan-minier' },
            { label: "Ventes d'or", to: '/artisan-minier/ventes-or' },
            { label: isEditMode ? 'Modification' : 'Nouvelle vente' },
          ]}
          actions={
            <button type="button" className="sn-btn" onClick={() => navigate('/artisan-minier/ventes-or')}>
              <ArrowLeft aria-hidden="true" /> Retour au registre
            </button>
          }
        />

        {loading ? (
          <div className="vente-form__loading">
            <Loader2 className="sn-spin" aria-hidden="true" /> Chargement du formulaire…
          </div>
        ) : (
          <div className="vente-form__layout">
            <form className="vente-form__main" onSubmit={handleSubmit}>
              <Section
                id="vendeur"
                icon={UserRound}
                tone="emerald"
                title="Vendeur et déclaration"
                description="Artisan à l’origine de la collecte et références du reçu."
              >
                <div className="vente-form__row is-vendeur">
                  <Field label="Artisan vendeur" required>
                    <select
                      value={form.artisan_id}
                      onChange={(event) => setValue('artisan_id', event.target.value)}
                      required
                    >
                      <option value="">Sélectionner un artisan</option>
                      {artisans.map((artisan) => (
                        <option key={artisan.id} value={artisan.id}>
                          {artisanDisplayName(artisan)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Date de vente" required>
                    <input
                      type="date"
                      value={form.date_vente}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(event) => setValue('date_vente', event.target.value)}
                      required
                    />
                  </Field>
                  <Field label="N° de reçu">
                    <input
                      value={form.numero_recu}
                      onChange={(event) => setValue('numero_recu', event.target.value)}
                      placeholder="REC-2026-000…"
                    />
                  </Field>
                </div>

                <div className="vente-form__statut">
                  <span className="sn-field__label">Statut de la déclaration</span>
                  <Segmented
                    name="statut-vente"
                    value={form.statut}
                    options={STATUT_OPTIONS}
                    onChange={(statut) => setValue('statut', statut)}
                    ariaLabel="Statut de la déclaration"
                  />
                </div>
              </Section>

              <Section
                id="or"
                icon={Scale}
                tone="amber"
                title="Nature et titre de l’or"
                description="Forme collectée, quantité pesée et titre du métal."
              >
                <fieldset className="vente-form__types">
                  <legend className="sn-field__label">Type d’or <i aria-hidden="true">*</i></legend>
                  <div className="sn-choices">
                    {TYPE_OR_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      return (
                        <label key={option.value} className={form.type_or === option.value ? 'is-checked' : ''}>
                          <input
                            type="radio"
                            name="type-or"
                            value={option.value}
                            checked={form.type_or === option.value}
                            onChange={() => setValue('type_or', option.value)}
                          />
                          <span className="sn-choices__icon"><Icon aria-hidden="true" /></span>
                          <span>
                            <strong>{option.label}</strong>
                            <small>{option.description}</small>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="vente-form__row is-or">
                  <Field label="Quantité (grammes)" required>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.quantite_grammes || ''}
                      onChange={(event) => setValue('quantite_grammes', Number(event.target.value))}
                      required
                    />
                  </Field>
                  <Field label="Pureté (%)" required>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={form.purete_pourcentage}
                      onChange={(event) => handlePourcentage(Number(event.target.value))}
                      required
                    />
                  </Field>
                  <div className="sn-field">
                    <span className="sn-field__label">Titre courant</span>
                    <div className="vente-form__karats" role="group" aria-label="Titre en carats">
                      {KARAT_PRESETS.map((karat) => (
                        <button
                          key={karat}
                          type="button"
                          className={Math.round(form.purete_karat) === karat ? 'is-active' : ''}
                          onClick={() => handleKarat(karat)}
                        >
                          {karat} K
                        </button>
                      ))}
                    </div>
                    <small>{decimal.format(form.purete_karat)} carats · {decimal.format(orFin)} g d’or fin</small>
                  </div>
                </div>
              </Section>

              <Section
                id="valorisation"
                icon={Banknote}
                tone="blue"
                title="Valorisation"
                description="Prix négocié et détail fiscal appliqué à la déclaration."
              >
                <div className="vente-form__row is-prix">
                  <Field label="Prix au gramme (FCFA)" required>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={form.prix_unitaire_fcfa || ''}
                      onChange={(event) => setValue('prix_unitaire_fcfa', Number(event.target.value))}
                      required
                    />
                  </Field>
                  <div className="sn-field">
                    <span className="sn-field__label">Équivalent au kilogramme</span>
                    <div className="sn-readonly">
                      <Calculator aria-hidden="true" />
                      <output>{formatFcfa(form.prix_unitaire_fcfa * 1000)}</output>
                    </div>
                  </div>
                  <div className="sn-field">
                    <span className="sn-field__label">Quantité en onces troy</span>
                    <div className="sn-readonly">
                      <Scale aria-hidden="true" />
                      <output>{decimal.format(quantiteOnces)} oz</output>
                    </div>
                  </div>
                </div>

                <Note tone="info" icon={Calculator}>
                  Le montant enregistré comprend la TVA ({TVA_TAUX} %) et la taxe de développement
                  communal ({TAXE_DEV_COMM_TAUX} %). Le détail est récapitulé à droite.
                </Note>
              </Section>

              <Section
                id="observations"
                icon={StickyNote}
                tone="slate"
                title="Observations"
                description="Contexte de la collecte, remarques de contrôle."
              >
                <Field label="Observations" wide>
                  <textarea
                    value={form.observations}
                    onChange={(event) => setValue('observations', event.target.value)}
                    placeholder="Conditions de la collecte, contrôle qualité, remarques…"
                  />
                </Field>
              </Section>

              <footer className="sn-form-actions">
                <button type="button" className="sn-btn" onClick={() => navigate('/artisan-minier/ventes-or')}>
                  Annuler
                </button>
                <button type="submit" className="sn-btn sn-btn--primary" disabled={saving || Boolean(validationError)}>
                  {saving ? <Loader2 className="sn-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
                  {saving ? 'Enregistrement…' : isEditMode ? 'Mettre à jour la vente' : 'Enregistrer la vente'}
                </button>
              </footer>
            </form>

            <aside className="vente-form__aside" aria-label="Récapitulatif et contexte">
              <section className="sn-card vente-form__recap">
                <div className="sn-card__head">
                  <div>
                    <h3>Récapitulatif</h3>
                    <p className="sn-card__hint">Mis à jour en direct, identique au montant enregistré.</p>
                  </div>
                </div>
                <dl className="vente-form__recap-list">
                  <div>
                    <dt>Montant brut</dt>
                    <dd>{formatFcfa(taxes.montant_brut_fcfa)}</dd>
                  </div>
                  <div>
                    <dt>TVA ({TVA_TAUX} %)</dt>
                    <dd>{formatFcfa(taxes.tva_montant_fcfa)}</dd>
                  </div>
                  <div>
                    <dt>Taxe de développement ({TAXE_DEV_COMM_TAUX} %)</dt>
                    <dd>{formatFcfa(taxes.taxe_dev_comm_montant_fcfa)}</dd>
                  </div>
                  <div className="is-total">
                    <dt>Montant total</dt>
                    <dd>{formatFcfa(taxes.montant_total_fcfa)}</dd>
                  </div>
                </dl>
                {validationError && (
                  <p className="vente-form__blocker">{validationError}</p>
                )}
              </section>

              <section className="sn-card vente-form__artisan">
                <div className="sn-card__head">
                  <div>
                    <h3>Artisan sélectionné</h3>
                    <p className="sn-card__hint">Historique de collecte du vendeur.</p>
                  </div>
                </div>
                {!selectedArtisan ? (
                  <p className="sn-empty">Sélectionnez un artisan pour afficher son historique.</p>
                ) : (
                  <div className="vente-form__artisan-body">
                    <p className="vente-form__artisan-name">
                      <strong>{artisanDisplayName(selectedArtisan)}</strong>
                      <Badge tone={selectedArtisan.actif === false ? 'danger' : 'success'}>
                        {selectedArtisan.actif === false ? 'Inactif' : 'Actif'}
                      </Badge>
                    </p>
                    <p className="vente-form__artisan-meta">
                      {selectedArtisan.region || '—'} · {selectedArtisan.telephone || 'Téléphone non renseigné'}
                    </p>

                    {loadingStats ? (
                      <p className="sn-empty">Chargement de l’historique…</p>
                    ) : artisanStats ? (
                      <ul className="vente-form__stats">
                        <li>
                          <span>Ventes déclarées</span>
                          <b>{integer.format(artisanStats.nombre_ventes_total)}</b>
                        </li>
                        <li>
                          <span>Quantité cumulée</span>
                          <b>{decimal.format(artisanStats.quantite_totale_grammes)} g</b>
                        </li>
                        <li>
                          <span>Chiffre d’affaires</span>
                          <b>{formatFcfa(artisanStats.chiffre_affaires_total)}</b>
                        </li>
                        <li>
                          <span>Dernière vente</span>
                          <b>
                            {artisanStats.date_derniere_vente
                              ? new Date(artisanStats.date_derniere_vente).toLocaleDateString('fr-FR')
                              : 'Aucune'}
                          </b>
                        </li>
                      </ul>
                    ) : (
                      <p className="sn-empty">Aucun historique disponible.</p>
                    )}
                  </div>
                )}
              </section>

              <LiveGoldPricePanel />
            </aside>
          </div>
        )}
      </div>
    </NationalDashboardLayout>
  );
}
