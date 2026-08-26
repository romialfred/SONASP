import { useCallback, useEffect, useMemo, useState } from 'react';
import { Scale, Plus, ShieldCheck, Archive, AlertTriangle, FileText, Clock, Layers } from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import {
  PageHeader, Section, Field, DataTable, Badge, Note, StatGrid, EmptyState,
  FormActions, SelectControl, type Column,
} from '@/components/ui/sn';
import { useAuth } from '@/contexts/AuthContext';
import { hasCapability, CAPABILITIES } from '@/lib/capabilities';
import { errorMessage } from '@/lib/errorMessage';
import {
  reglesFiscalesService, LIBELLES_TAXES, LIBELLES_ASSIETTES, LIBELLES_MODES,
  LIBELLES_STATUTS,
  type RegleFiscale, type CodeTaxe, type Assiette, type ModeCalcul, type BrouillonRegle,
} from '@/services/reglesFiscalesService';

const TONE_STATUT: Record<string, 'success' | 'warning' | 'neutral'> = {
  approuvee: 'success',
  projet: 'warning',
  abrogee: 'neutral',
};

const BROUILLON_INITIAL: BrouillonRegle = {
  code_taxe: 'tva',
  libelle: '',
  assiette: 'ca_ht',
  mode_calcul: 'taux',
  taux: null,
  seuil_min: null,
  seuil_max: null,
  unite_seuil: null,
  devise_seuil: null,
  categorie_acheteur: 'standard',
  date_effet: new Date().toISOString().slice(0, 10),
  reference_reglementaire: '',
  commentaire: '',
};

/** Le taux se saisit en pourcentage ; la base le conserve en fraction. */
function versFraction(pourcentage: string): number | null {
  const valeur = Number(pourcentage.replace(',', '.'));
  if (!Number.isFinite(valeur)) return null;
  return valeur / 100;
}

function versPourcentage(fraction: number | null): string {
  if (fraction === null) return '-';
  return `${(fraction * 100).toFixed(2).replace('.', ',')} %`;
}

function formatTranche(regle: RegleFiscale): string {
  if (regle.mode_calcul !== 'tranche') return '-';
  const min = regle.seuil_min ?? 0;
  const max = regle.seuil_max;
  const unite = regle.unite_seuil ? ` ${regle.unite_seuil}` : '';
  return max === null
    ? `à partir de ${min}${unite}`
    : `de ${min} à ${max}${unite}`;
}

export function ReglesFiscalesPage() {
  const { user } = useAuth();
  const [regles, setRegles] = useState<RegleFiscale[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [brouillon, setBrouillon] = useState<BrouillonRegle>(BROUILLON_INITIAL);
  const [tauxSaisi, setTauxSaisi] = useState('');
  const [enregistrement, setEnregistrement] = useState(false);

  const peutAdministrer = hasCapability(user, CAPABILITIES.TAX_RULES_MANAGE);

  const charger = useCallback(async () => {
    try {
      setChargement(true);
      setErreur(null);
      setRegles(await reglesFiscalesService.lister());
    } catch (error) {
      setErreur(errorMessage(error, 'Le référentiel fiscal n’a pas pu être chargé.'));
      setRegles([]);
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  const indicateurs = useMemo(() => {
    const approuvees = regles.filter((r) => r.statut === 'approuvee');
    const taxesCouvertes = new Set(approuvees.map((r) => r.code_taxe));
    return [
      { label: 'Règles enregistrées', value: String(regles.length), icon: FileText },
      { label: 'En vigueur', value: String(approuvees.length), icon: ShieldCheck, tone: 'green' as const },
      { label: 'En projet', value: String(regles.filter((r) => r.statut === 'projet').length), icon: Clock, tone: 'gold' as const },
      { label: 'Taxes couvertes', value: `${taxesCouvertes.size} / 5`, icon: Layers },
    ];
  }, [regles]);

  const taxesSansRegle = useMemo(() => {
    const couvertes = new Set(
      regles.filter((r) => r.statut === 'approuvee').map((r) => r.code_taxe),
    );
    return (Object.keys(LIBELLES_TAXES) as CodeTaxe[]).filter((code) => !couvertes.has(code));
  }, [regles]);

  const enregistrer = async () => {
    if (!brouillon.libelle.trim()) {
      setErreur('Un intitulé est nécessaire pour identifier la règle.');
      return;
    }
    if (brouillon.mode_calcul !== 'exoneration' && !tauxSaisi.trim()) {
      setErreur('Un taux est nécessaire, sauf pour une exonération.');
      return;
    }

    try {
      setEnregistrement(true);
      setErreur(null);
      await reglesFiscalesService.creer({
        ...brouillon,
        taux: brouillon.mode_calcul === 'exoneration' ? null : versFraction(tauxSaisi),
      });
      setMessage('Règle enregistrée en projet. Elle doit être approuvée par un autre acteur pour entrer en vigueur.');
      setFormulaireOuvert(false);
      setBrouillon(BROUILLON_INITIAL);
      setTauxSaisi('');
      await charger();
    } catch (error) {
      setErreur(errorMessage(error, 'La règle n’a pas pu être enregistrée.'));
    } finally {
      setEnregistrement(false);
    }
  };

  const approuver = async (regle: RegleFiscale) => {
    try {
      setErreur(null);
      await reglesFiscalesService.approuver(regle.id);
      setMessage(`La règle « ${regle.libelle} » est désormais en vigueur.`);
      await charger();
    } catch (error) {
      setErreur(errorMessage(error, 'L’approbation a été refusée.'));
    }
  };

  const abroger = async (regle: RegleFiscale) => {
    try {
      setErreur(null);
      await reglesFiscalesService.abroger(regle.id);
      setMessage(`La règle « ${regle.libelle} » est abrogée. Elle reste opposable aux opérations qu’elle a servi à calculer.`);
      await charger();
    } catch (error) {
      setErreur(errorMessage(error, 'L’abrogation a été refusée.'));
    }
  };

  const colonnes: Column<RegleFiscale>[] = [
    {
      key: 'code_taxe',
      header: 'Taxe',
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{LIBELLES_TAXES[r.code_taxe]}</div>
          <div className="sn-muted" style={{ fontSize: 12 }}>{r.libelle}</div>
        </div>
      ),
    },
    {
      key: 'assiette',
      header: 'Assiette',
      render: (r) => LIBELLES_ASSIETTES[r.assiette],
    },
    {
      key: 'mode_calcul',
      header: 'Mode',
      render: (r) => (
        <div>
          <div>{LIBELLES_MODES[r.mode_calcul]}</div>
          {r.mode_calcul === 'tranche' && (
            <div className="sn-muted" style={{ fontSize: 12 }}>{formatTranche(r)}</div>
          )}
        </div>
      ),
    },
    { key: 'taux', header: 'Taux', numeric: true, render: (r) => versPourcentage(r.taux) },
    {
      key: 'periode',
      header: 'Période',
      render: (r) => (
        <div>
          <div>à partir du {new Date(r.date_effet).toLocaleDateString('fr-FR')}</div>
          {r.date_fin && (
            <div className="sn-muted" style={{ fontSize: 12 }}>
              jusqu’au {new Date(r.date_fin).toLocaleDateString('fr-FR')}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'reference',
      header: 'Référence',
      render: (r) => r.reference_reglementaire || <span className="sn-muted">non renseignée</span>,
    },
    {
      key: 'statut',
      header: 'Statut',
      render: (r) => <Badge tone={TONE_STATUT[r.statut] ?? 'neutral'}>{LIBELLES_STATUTS[r.statut]}</Badge>,
    },
    {
      key: 'actions',
      header: 'Action',
      render: (r) => {
        if (!peutAdministrer) return <span className="sn-muted">-</span>;
        if (r.statut === 'projet') {
          return (
            <button type="button" className="sn-btn sn-btn--ghost" onClick={() => void approuver(r)}>
              <ShieldCheck aria-hidden="true" /> Approuver
            </button>
          );
        }
        if (r.statut === 'approuvee') {
          return (
            <button type="button" className="sn-btn sn-btn--ghost" onClick={() => void abroger(r)}>
              <Archive aria-hidden="true" /> Abroger
            </button>
          );
        }
        return <span className="sn-muted">-</span>;
      },
    },
  ];

  return (
    <NationalDashboardLayout>
      <PageHeader
        title="Règles fiscales"
        subtitle="Taux, assiettes et barèmes appliqués aux ventes, versionnés par date d’effet."
        icon={Scale}
        breadcrumb={[{ label: 'Conciliation', to: '/conciliation' }, { label: 'Règles fiscales' }]}
        actions={peutAdministrer ? (
          <button
            type="button"
            className="sn-btn sn-btn--primary"
            onClick={() => { setFormulaireOuvert((ouvert) => !ouvert); setMessage(null); }}
          >
            <Plus aria-hidden="true" /> Nouvelle règle
          </button>
        ) : undefined}
      />

      <StatGrid items={indicateurs} ariaLabel="État du référentiel fiscal" sober />

      {erreur && <Note tone="danger" icon={AlertTriangle}>{erreur}</Note>}
      {message && <Note tone="success">{message}</Note>}

      {taxesSansRegle.length > 0 && (
        <Note tone="warning" icon={AlertTriangle}>
          Aucune règle en vigueur pour : {taxesSansRegle.map((c) => LIBELLES_TAXES[c]).join(', ')}.
          Tant qu’un barème n’est pas approuvé, la conciliation calcule les écarts commerciaux
          mais laisse ces taxes de côté et le signale, plutôt que d’appliquer un taux supposé.
        </Note>
      )}

      {formulaireOuvert && (
        <Section id="nouvelle-regle" icon={Plus} title="Nouvelle règle" description="Elle sera enregistrée en projet : un autre acteur devra l’approuver pour qu’elle s’applique.">
          <div className="sn-grid sn-grid--2">
            <Field label="Taxe" required>
              <SelectControl
                value={brouillon.code_taxe}
                onChange={(v) => setBrouillon((b) => ({ ...b, code_taxe: v as CodeTaxe }))}
                ariaLabel="Taxe concernée"
              >
                {(Object.keys(LIBELLES_TAXES) as CodeTaxe[]).map((code) => (
                  <option key={code} value={code}>{LIBELLES_TAXES[code]}</option>
                ))}
              </SelectControl>
            </Field>

            <Field label="Intitulé" required hint="Ce qui identifiera la règle dans les calculs.">
              <input
                className="sn-input"
                value={brouillon.libelle}
                onChange={(e) => setBrouillon((b) => ({ ...b, libelle: e.target.value }))}
                placeholder="Redevance, tranche haute"
              />
            </Field>

            <Field label="Assiette" required hint="Ce sur quoi le taux s’applique.">
              <SelectControl
                value={brouillon.assiette}
                onChange={(v) => setBrouillon((b) => ({ ...b, assiette: v as Assiette }))}
                ariaLabel="Assiette"
              >
                {(Object.keys(LIBELLES_ASSIETTES) as Assiette[]).map((code) => (
                  <option key={code} value={code}>{LIBELLES_ASSIETTES[code]}</option>
                ))}
              </SelectControl>
            </Field>

            <Field label="Mode de calcul" required>
              <SelectControl
                value={brouillon.mode_calcul}
                onChange={(v) => setBrouillon((b) => ({ ...b, mode_calcul: v as ModeCalcul }))}
                ariaLabel="Mode de calcul"
              >
                {(Object.keys(LIBELLES_MODES) as ModeCalcul[]).map((code) => (
                  <option key={code} value={code}>{LIBELLES_MODES[code]}</option>
                ))}
              </SelectControl>
            </Field>

            {brouillon.mode_calcul !== 'exoneration' && (
              <Field label="Taux" required hint="En pourcentage. Le FNDL est évoqué à 1 %, à confirmer.">
                <input
                  className="sn-input"
                  inputMode="decimal"
                  value={tauxSaisi}
                  onChange={(e) => setTauxSaisi(e.target.value)}
                  placeholder="18"
                />
              </Field>
            )}

            <Field label="Date d’effet" required hint="Une opération antérieure conserve la règle qui lui était applicable.">
              <input
                type="date"
                className="sn-input"
                value={brouillon.date_effet}
                onChange={(e) => setBrouillon((b) => ({ ...b, date_effet: e.target.value }))}
              />
            </Field>

            {brouillon.mode_calcul === 'tranche' && (
              <>
                <Field label="Seuil bas" hint="Inclus. Vide signifie sans borne.">
                  <input
                    className="sn-input"
                    inputMode="decimal"
                    onChange={(e) => setBrouillon((b) => ({ ...b, seuil_min: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="1000"
                  />
                </Field>
                <Field label="Seuil haut" hint="Exclu. Vide signifie tranche ouverte.">
                  <input
                    className="sn-input"
                    inputMode="decimal"
                    onChange={(e) => setBrouillon((b) => ({ ...b, seuil_max: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="1300"
                  />
                </Field>
                <Field label="Unité du seuil" required hint="Ce que mesure le seuil.">
                  <input
                    className="sn-input"
                    onChange={(e) => setBrouillon((b) => ({ ...b, unite_seuil: e.target.value || null }))}
                    placeholder="USD/oz"
                  />
                </Field>
              </>
            )}

            <Field label="Référence réglementaire" wide hint="Texte, arrêté ou article qui fonde la règle.">
              <input
                className="sn-input"
                value={brouillon.reference_reglementaire ?? ''}
                onChange={(e) => setBrouillon((b) => ({ ...b, reference_reglementaire: e.target.value }))}
                placeholder="Arrêté n° …"
              />
            </Field>
          </div>

          <FormActions>
            <button type="button" className="sn-btn sn-btn--ghost" onClick={() => setFormulaireOuvert(false)}>
              Annuler
            </button>
            <button
              type="button"
              className="sn-btn sn-btn--primary"
              onClick={() => void enregistrer()}
              disabled={enregistrement}
            >
              {enregistrement ? 'Enregistrement…' : 'Enregistrer en projet'}
            </button>
          </FormActions>
        </Section>
      )}

      <Section id="regles-enregistrees" icon={Scale} title="Règles enregistrées" description="Deux règles ne peuvent jamais couvrir la même période pour une même taxe : la base le refuse.">
        {!chargement && regles.length === 0 ? (
          <EmptyState
            title="Aucune règle fiscale"
            description="Le référentiel est vide : aucun taux n’a été livré avec la plateforme. Les barèmes de TVA, de redevance et du FNDL se saisissent ici, avec leur référence réglementaire."
          />
        ) : (
          <DataTable
            columns={colonnes}
            rows={regles}
            loading={chargement}
            caption="Règles fiscales enregistrées"
            empty="Aucune règle"
          />
        )}
      </Section>
    </NationalDashboardLayout>
  );
}

export default ReglesFiscalesPage;
