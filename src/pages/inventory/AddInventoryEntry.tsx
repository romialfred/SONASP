import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Boxes,
  Building2,
  Calculator,
  FileCheck2,
  FlaskConical,
  Loader2,
  Save,
  Scale,
  X,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, Field, Note, PageHeader, Section } from '@/components/ui/sn';
import { CustomAlert } from '@/components/ui/CustomAlert';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import { addInventoryEntry, type GoldInventoryEntry } from '@/services/inventoryService';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errorMessage';
import { GRAMMES_PAR_ONCE } from './inventoryOverviewData';
import './add-inventory-entry.css';

const decimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const decimal3 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export interface Expedition {
  id: string;
  reference_number: string;
  shipment_date: string;
  total_bullion_grams: number;
  total_pure_gold_grams: number;
  total_pure_gold_oz: number;
  production_count: number;
  mining_company_id: string | null;
  refinerie: string | null;
}

export interface Raffinerie {
  id: string;
  name: string;
  location: string | null;
  country: string | null;
}

export interface SaisieEntree {
  entry_date: string;
  shipment_id: string;
  mining_company_id: string;
  refinery_id: string;
  weight_before_melting_grams: string;
  weight_after_melting_grams: string;
  fineness_percentage: string;
  silver_percentage: string;
  metal_retained_percentage: string;
  certificate_number: string;
  notes: string;
}

export const SAISIE_VIDE: SaisieEntree = {
  entry_date: new Date().toISOString().slice(0, 10),
  shipment_id: '',
  mining_company_id: '',
  refinery_id: '',
  weight_before_melting_grams: '',
  weight_after_melting_grams: '',
  fineness_percentage: '',
  silver_percentage: '',
  metal_retained_percentage: '',
  certificate_number: '',
  notes: '',
};

const nombre = (valeur: string) => {
  const converti = Number(String(valeur).replace(',', '.'));
  return Number.isFinite(converti) ? converti : 0;
};

export interface Calculs {
  impuretes: number | null;
  orFinGrammes: number;
  orFinOnces: number;
  rendement: number | null;
  ecartOnces: number | null;
  ecartPourcentage: number | null;
}

/**
 * Grandeurs dérivées de la saisie.
 *
 * Tout ce qui suppose une division renvoie `null` quand le dénominateur manque :
 * un rendement de 0 % sur une pesée vide se lirait comme une perte totale.
 */
export function calculer(saisie: SaisieEntree, expedition: Expedition | null): Calculs {
  const avant = nombre(saisie.weight_before_melting_grams);
  const apres = nombre(saisie.weight_after_melting_grams);
  const titre = nombre(saisie.fineness_percentage);
  const argent = nombre(saisie.silver_percentage);
  const retenu = nombre(saisie.metal_retained_percentage);

  const orFinGrammes = apres > 0 && titre > 0 ? (apres * titre * (retenu > 0 ? retenu / 100 : 1)) / 100 : 0;
  const orFinOnces = orFinGrammes / GRAMMES_PAR_ONCE;
  const attenduOnces = expedition ? Number(expedition.total_pure_gold_oz || 0) : null;

  return {
    impuretes: titre > 0 || argent > 0 ? Math.max(0, 100 - (titre + argent)) : null,
    orFinGrammes,
    orFinOnces,
    rendement: avant > 0 ? (apres / avant) * 100 : null,
    ecartOnces: attenduOnces === null || attenduOnces <= 0 ? null : orFinOnces - attenduOnces,
    ecartPourcentage:
      attenduOnces === null || attenduOnces <= 0 ? null : ((orFinOnces - attenduOnces) / attenduOnces) * 100,
  };
}

/** Contrôles bloquants, dans l'ordre où ils sont annoncés. */
export function valider(saisie: SaisieEntree): string | null {
  if (!saisie.shipment_id) return 'Sélectionnez l’expédition réceptionnée.';
  if (!saisie.entry_date) return 'Renseignez la date d’entrée en stock.';
  if (nombre(saisie.weight_before_melting_grams) <= 0) return 'La masse avant fonte doit être supérieure à zéro.';
  if (nombre(saisie.weight_after_melting_grams) <= 0) return 'La masse après fonte doit être supérieure à zéro.';
  if (nombre(saisie.weight_after_melting_grams) > nombre(saisie.weight_before_melting_grams)) {
    return 'La masse après fonte ne peut pas dépasser la masse avant fonte.';
  }
  const titre = nombre(saisie.fineness_percentage);
  if (titre <= 0 || titre > 100) return 'Le titre en or doit être compris entre 0 et 100 %.';
  const argent = nombre(saisie.silver_percentage);
  if (argent < 0 || argent > 100) return 'La teneur en argent doit être comprise entre 0 et 100 %.';
  if (titre + argent > 100) return 'La somme du titre en or et de la teneur en argent dépasse 100 %.';
  const retenu = nombre(saisie.metal_retained_percentage);
  if (retenu <= 0 || retenu > 100) return 'Le métal restitué doit être compris entre 0 et 100 %.';
  return null;
}

export function AddInventoryEntry() {
  const navigate = useNavigate();
  const { alertState, showSuccess, showError, closeAlert } = useCustomAlert();

  const [saisie, setSaisie] = useState<SaisieEntree>(SAISIE_VIDE);
  const [expeditions, setExpeditions] = useState<Expedition[]>([]);
  const [raffineries, setRaffineries] = useState<Raffinerie[]>([]);
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const definir = <C extends keyof SaisieEntree>(champ: C, valeur: SaisieEntree[C]) =>
    setSaisie((courant) => ({ ...courant, [champ]: valeur }));

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const [lots, usines] = await Promise.all([
        supabase
          .from('freight_shipments')
          .select(
            'id, reference_number, shipment_date, total_bullion_grams, total_pure_gold_grams, total_pure_gold_oz, production_count, mining_company_id, destination_refinery:refineries(name)'
          )
          .in('status', ['received_at_refinery', 'processing', 'processed'])
          .order('shipment_date', { ascending: false }),
        supabase.from('refineries').select('id, name, location, country').eq('is_active', true).order('name'),
      ]);

      if (lots.error) throw lots.error;

      setExpeditions(
        (lots.data || []).map((ligne) => {
          const destination = ligne.destination_refinery as { name?: string } | Array<{ name?: string }> | null;
          return {
            id: ligne.id,
            reference_number: ligne.reference_number,
            shipment_date: ligne.shipment_date,
            total_bullion_grams: Number(ligne.total_bullion_grams || 0),
            total_pure_gold_grams: Number(ligne.total_pure_gold_grams || 0),
            total_pure_gold_oz: Number(ligne.total_pure_gold_oz || 0),
            production_count: Number(ligne.production_count || 0),
            mining_company_id: ligne.mining_company_id ?? null,
            refinerie: (Array.isArray(destination) ? destination[0]?.name : destination?.name) || null,
          };
        })
      );
      setRaffineries(usines.error ? [] : usines.data || []);
    } catch (raison) {
      setErreur(errorMessage(raison, 'Impossible de charger les expéditions réceptionnées.'));
      setExpeditions([]);
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  const expedition = useMemo(
    () => expeditions.find((lot) => lot.id === saisie.shipment_id) || null,
    [expeditions, saisie.shipment_id]
  );

  /**
   * La masse avant fonte et la société minière découlent de l'expédition.
   * La société n'était jamais enregistrée : le stock ne pouvait pas être ventilé
   * par mine, et l'écran national devait le reconstituer par jointures.
   */
  useEffect(() => {
    if (!expedition) return;
    setSaisie((courant) => ({
      ...courant,
      mining_company_id: expedition.mining_company_id || '',
      weight_before_melting_grams:
        courant.weight_before_melting_grams || String(expedition.total_bullion_grams || ''),
    }));
  }, [expedition]);

  const calculs = calculer(saisie, expedition);
  const messageValidation = valider(saisie);

  const soumettre = async (evenement: FormEvent) => {
    evenement.preventDefault();
    if (messageValidation) {
      showError(messageValidation);
      return;
    }

    setEnregistrement(true);
    try {
      const entree: GoldInventoryEntry = {
        entry_date: saisie.entry_date,
        freight_shipment_id: saisie.shipment_id,
        weight_before_melting_grams: nombre(saisie.weight_before_melting_grams),
        weight_after_melting_grams: nombre(saisie.weight_after_melting_grams),
        fineness_percentage: nombre(saisie.fineness_percentage),
        metal_retained_percentage: nombre(saisie.metal_retained_percentage),
        variance_with_export_invoice_oz: calculs.ecartOnces ?? undefined,
        notes: saisie.notes || undefined,
        certificate_number: saisie.certificate_number || undefined,
        transaction_type: 'entry',
        // Renseignés désormais : la teneur en argent et la raffinerie étaient
        // saisies puis abandonnées à l'enregistrement.
        silver_percentage: nombre(saisie.silver_percentage) || undefined,
        refinery_id: saisie.refinery_id || undefined,
        mining_company_id: saisie.mining_company_id || undefined,
      };

      const resultat = await addInventoryEntry(entree);
      if (!resultat.success) throw resultat.error;

      showSuccess('Entrée de stock enregistrée.');
      navigate('/inventory');
    } catch (raison) {
      showError(errorMessage(raison, 'Impossible d’enregistrer l’entrée de stock.'));
    } finally {
      setEnregistrement(false);
    }
  };

  return (
    <NationalDashboardLayout>
      <div className="sn-page entree-stock">
        <CustomAlert {...alertState} onClose={closeAlert} />

        <PageHeader
          icon={Boxes}
          title="Nouvelle entrée de stock"
          subtitle="Réception d’un lot raffiné et intégration au stock national."
          breadcrumb={[{ label: 'Suivi des stocks', to: '/inventory' }, { label: 'Nouvelle entrée' }]}
          actions={
            <button type="button" className="sn-btn" onClick={() => navigate('/inventory')}>
              <X aria-hidden="true" /> Retour au stock
            </button>
          }
        />

        {erreur && (
          <Note tone="danger" icon={AlertTriangle}>
            {erreur}
          </Note>
        )}

        {chargement ? (
          <p className="entree-stock__chargement">
            <Loader2 className="sn-spin" aria-hidden="true" /> Chargement des expéditions…
          </p>
        ) : (
          <div className="entree-stock__grille">
            <form className="entree-stock__principal" onSubmit={soumettre}>
              <Section
                id="origine"
                icon={Building2}
                title="Origine du lot"
                description="Expédition réceptionnée et date d’entrée en stock."
              >
                <div className="entree-stock__ligne is-deux">
                  <Field label="Expédition réceptionnée" required>
                    <select
                      value={saisie.shipment_id}
                      onChange={(event) => definir('shipment_id', event.target.value)}
                      required
                    >
                      <option value="">Sélectionner une expédition</option>
                      {expeditions.map((lot) => (
                        <option key={lot.id} value={lot.id}>
                          {lot.reference_number} — {decimal.format(lot.total_pure_gold_oz)} oz attendues
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Date d’entrée en stock" required>
                    <input
                      type="date"
                      value={saisie.entry_date}
                      max={new Date().toISOString().slice(0, 10)}
                      onChange={(event) => definir('entry_date', event.target.value)}
                      required
                    />
                  </Field>
                </div>

                {expeditions.length === 0 && (
                  <Note tone="warning" icon={AlertTriangle}>
                    Aucune expédition n’est au stade « reçue » ou « raffinée ». Une entrée de stock
                    se rattache à un lot expédié.
                  </Note>
                )}
              </Section>

              <Section
                id="pesees"
                icon={Scale}
                title="Pesées"
                description="Masses relevées avant et après fonte, en grammes."
              >
                <div className="entree-stock__ligne is-trois">
                  <Field
                    label="Masse avant fonte (g)"
                    required
                    hint={expedition ? 'Reprise du lot, modifiable' : 'Sélectionnez d’abord une expédition'}
                  >
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={saisie.weight_before_melting_grams}
                      onChange={(event) => definir('weight_before_melting_grams', event.target.value)}
                      required
                    />
                  </Field>
                  <Field label="Masse après fonte (g)" required>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={saisie.weight_after_melting_grams}
                      onChange={(event) => definir('weight_after_melting_grams', event.target.value)}
                      required
                    />
                  </Field>
                  <div className="sn-field">
                    <span className="sn-field__label">Rendement de fonte</span>
                    <div className="sn-readonly">
                      <Calculator aria-hidden="true" />
                      <output>
                        {calculs.rendement === null ? '—' : `${decimal.format(calculs.rendement)} %`}
                      </output>
                    </div>
                  </div>
                </div>
              </Section>

              <Section
                id="titre"
                icon={FlaskConical}
                title="Titre et restitution"
                description="Résultats d’essai de la raffinerie et part de métal restituée."
              >
                <div className="entree-stock__ligne is-quatre">
                  <Field label="Titre en or (%)" required>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={saisie.fineness_percentage}
                      onChange={(event) => definir('fineness_percentage', event.target.value)}
                      required
                    />
                  </Field>
                  <Field label="Teneur en argent (%)">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={saisie.silver_percentage}
                      onChange={(event) => definir('silver_percentage', event.target.value)}
                    />
                  </Field>
                  <div className="sn-field">
                    <span className="sn-field__label">Impuretés</span>
                    <div className="sn-readonly">
                      <Calculator aria-hidden="true" />
                      <output>
                        {calculs.impuretes === null ? '—' : `${decimal.format(calculs.impuretes)} %`}
                      </output>
                    </div>
                    <small>100 − (or + argent)</small>
                  </div>
                  <Field label="Métal restitué (%)" required hint="Part rendue par la raffinerie">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={saisie.metal_retained_percentage}
                      onChange={(event) => definir('metal_retained_percentage', event.target.value)}
                      required
                    />
                  </Field>
                </div>
              </Section>

              <Section
                id="justificatifs"
                icon={FileCheck2}
                title="Justificatifs"
                description="Raffinerie ayant traité le lot et référence du certificat d’essai."
              >
                <div className="entree-stock__ligne is-deux">
                  <Field label="Raffinerie" hint="Établissement ayant réalisé l’essai">
                    <select
                      value={saisie.refinery_id}
                      onChange={(event) => definir('refinery_id', event.target.value)}
                    >
                      <option value="">Non renseignée</option>
                      {raffineries.map((usine) => (
                        <option key={usine.id} value={usine.id}>
                          {usine.name}
                          {usine.country ? ` — ${usine.country}` : ''}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="N° de certificat d’essai">
                    <input
                      value={saisie.certificate_number}
                      onChange={(event) => definir('certificate_number', event.target.value)}
                      placeholder="Référence portée sur le certificat"
                    />
                  </Field>
                </div>

                <Field label="Observations" wide>
                  <textarea
                    value={saisie.notes}
                    onChange={(event) => definir('notes', event.target.value)}
                    placeholder="Conditions de réception, réserves, écarts constatés…"
                  />
                </Field>
              </Section>

              <footer className="sn-form-actions">
                <button type="button" className="sn-btn" onClick={() => navigate('/inventory')}>
                  Annuler
                </button>
                <button
                  type="submit"
                  className="sn-btn sn-btn--primary"
                  disabled={enregistrement || Boolean(messageValidation)}
                >
                  {enregistrement ? <Loader2 className="sn-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
                  {enregistrement ? 'Enregistrement…' : 'Enregistrer l’entrée'}
                </button>
              </footer>
            </form>

            <aside className="entree-stock__volet" aria-label="Contrôle de l’entrée">
              <section className="entree-stock__carte entree-stock__resultat">
                <h3>Or fin intégré</h3>
                <p className="entree-stock__valeur">{decimal.format(calculs.orFinOnces)} oz</p>
                <p className="entree-stock__sous-valeur">{decimal3.format(calculs.orFinGrammes)} g</p>
                <p className="entree-stock__note">
                  Masse après fonte × titre × métal restitué. C’est cette quantité qui entre au
                  stock national.
                </p>
              </section>

              <section className="entree-stock__carte">
                <h3>Écart à l’expédition</h3>
                {calculs.ecartOnces === null ? (
                  /* Sans quantité attendue au lot, il n'y a pas d'écart à annoncer. */
                  <p className="entree-stock__valeur">—</p>
                ) : (
                  <>
                    <p
                      className={`entree-stock__valeur${calculs.ecartOnces >= 0 ? ' is-favorable' : ' is-defavorable'}`}
                    >
                      {calculs.ecartOnces >= 0 ? '+' : ''}
                      {decimal.format(calculs.ecartOnces)} oz
                    </p>
                    <p className="entree-stock__sous-valeur">
                      {calculs.ecartPourcentage !== null &&
                        `${calculs.ecartPourcentage >= 0 ? '+' : ''}${decimal.format(calculs.ecartPourcentage)} % de l’attendu`}
                    </p>
                  </>
                )}
                <p className="entree-stock__note">
                  Différence entre l’or fin constaté et la quantité déclarée à l’expédition.
                </p>
              </section>

              {expedition && (
                <section className="entree-stock__carte">
                  <h3>Lot sélectionné</h3>
                  <p className="entree-stock__lot">
                    <strong>{expedition.reference_number}</strong>
                    <Badge tone="neutral">{expedition.production_count} production(s)</Badge>
                  </p>
                  <dl className="entree-stock__faits">
                    <div>
                      <dt>Doré expédié</dt>
                      <dd>{decimal3.format(expedition.total_bullion_grams)} g</dd>
                    </div>
                    <div>
                      <dt>Or fin attendu</dt>
                      <dd>{decimal.format(expedition.total_pure_gold_oz)} oz</dd>
                    </div>
                    <div>
                      <dt>Destination</dt>
                      <dd>{expedition.refinerie || '—'}</dd>
                    </div>
                    <div>
                      <dt>Expédié le</dt>
                      <dd>
                        {expedition.shipment_date
                          ? new Date(expedition.shipment_date).toLocaleDateString('fr-FR')
                          : '—'}
                      </dd>
                    </div>
                  </dl>
                </section>
              )}

              {messageValidation && (
                <p className="entree-stock__blocage">
                  <AlertTriangle aria-hidden="true" /> {messageValidation}
                </p>
              )}
            </aside>
          </div>
        )}
      </div>
    </NationalDashboardLayout>
  );
}

export default AddInventoryEntry;
