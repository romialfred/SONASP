import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Scale, Plus, ShieldCheck, Archive, AlertTriangle, FileText, Clock,
  Calculator, CalendarDays, ArrowLeft,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import {
  PageHeader, Section, Field, DataTable, Note, EmptyState,
  FormActions, SelectControl, Tabs, TabPanel, type Column,
} from '@/components/ui/sn';
import { useAuth } from '@/contexts/AuthContext';
import { hasCapability, CAPABILITIES } from '@/lib/capabilities';
import { errorMessage } from '@/lib/errorMessage';
import {
  reglesFiscalesService, LIBELLES_TAXES, LIBELLES_ASSIETTES, LIBELLES_MODES,
  LIBELLES_PROFILS,
  type RegleFiscale, type CodeTaxe, type Assiette, type ModeCalcul,
  type ProfilVendeur, type BrouillonRegle,
} from '@/services/reglesFiscalesService';

type Onglet = 'vigueur' | 'projet' | 'historique';

/** Une règle approuvée cesse de s'appliquer dès que sa date de fin est atteinte. */
function estApplicable(regle: RegleFiscale, aujourdhui: string): boolean {
  return regle.statut === 'approuvee' && (!regle.date_fin || regle.date_fin > aujourdhui);
}

const BROUILLON_INITIAL: BrouillonRegle = {
  code_taxe: 'tva',
  libelle: '',
  assiette: 'ca_ht',
  mode_calcul: 'taux',
  profil_vendeur: 'tous',
  categorie_acheteur: 'standard',
  date_effet: new Date().toISOString().slice(0, 10),
  reference_reglementaire: '',
};

/** Saisies numériques du formulaire, conservées en texte tant qu'elles se tapent. */
interface SaisiesNumeriques {
  taux: string;
  montant: string;
  seuilBas: string;
  seuilHaut: string;
  unite: string;
}

const SAISIES_INITIALES: SaisiesNumeriques = {
  taux: '', montant: '', seuilBas: '', seuilHaut: '', unite: '',
};

function versNombre(saisie: string): number | null {
  const valeur = Number(saisie.replace(',', '.').trim());
  return Number.isFinite(valeur) ? valeur : null;
}

/** Le taux se saisit en pourcentage ; la base le conserve en fraction. */
function versFraction(pourcentage: string): number | null {
  const valeur = versNombre(pourcentage);
  return valeur === null ? null : valeur / 100;
}

function formatNombre(valeur: number): string {
  return valeur.toLocaleString('fr-FR');
}

function afficherValeur(regle: RegleFiscale): string {
  if (regle.mode_calcul === 'exoneration') return 'Exonérée';
  if (regle.mode_calcul === 'forfait') {
    return regle.montant_forfaitaire === null
      ? '-'
      : `${formatNombre(regle.montant_forfaitaire)} XOF`;
  }
  if (regle.taux === null) return '-';
  return `${(regle.taux * 100).toFixed(2).replace('.', ',')} %`;
}

function afficherTranche(regle: RegleFiscale): string | null {
  if (regle.mode_calcul !== 'tranche') return null;
  const unite = regle.unite_seuil ? ` ${regle.unite_seuil}` : '';
  if (regle.seuil_min !== null && regle.seuil_max !== null) {
    return `de ${formatNombre(regle.seuil_min)} à ${formatNombre(regle.seuil_max)}${unite}`;
  }
  if (regle.seuil_min !== null) return `à partir de ${formatNombre(regle.seuil_min)}${unite}`;
  if (regle.seuil_max !== null) return `jusqu’à ${formatNombre(regle.seuil_max)}${unite}`;
  return null;
}

function afficherDate(valeur: string): string {
  return new Date(valeur).toLocaleDateString('fr-FR');
}

export function ReglesFiscalesPage() {
  const { user } = useAuth();
  const [regles, setRegles] = useState<RegleFiscale[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<Onglet>('vigueur');
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [brouillon, setBrouillon] = useState<BrouillonRegle>(BROUILLON_INITIAL);
  const [saisies, setSaisies] = useState<SaisiesNumeriques>(SAISIES_INITIALES);
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

  const parStatut = useMemo(() => {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    return {
      vigueur: regles.filter((r) => estApplicable(r, aujourdhui)),
      projet: regles.filter((r) => r.statut === 'projet'),
      historique: regles.filter((r) => r.statut !== 'projet' && !estApplicable(r, aujourdhui)),
    };
  }, [regles]);

  const taxesSansRegle = useMemo(() => {
    const couvertes = new Set(parStatut.vigueur.map((r) => r.code_taxe));
    return (Object.keys(LIBELLES_TAXES) as CodeTaxe[]).filter((code) => !couvertes.has(code));
  }, [parStatut]);

  const fermerFormulaire = () => {
    setFormulaireOuvert(false);
    setBrouillon(BROUILLON_INITIAL);
    setSaisies(SAISIES_INITIALES);
  };

  const enregistrer = async () => {
    const mode = brouillon.mode_calcul;

    if (!brouillon.libelle.trim()) {
      setErreur('Un intitulé est nécessaire pour identifier la règle.');
      return;
    }
    if ((mode === 'taux' || mode === 'tranche') && versFraction(saisies.taux) === null) {
      setErreur('Un taux chiffré est nécessaire pour ce mode de calcul.');
      return;
    }
    if (mode === 'forfait' && versNombre(saisies.montant) === null) {
      setErreur('Un montant forfaitaire est nécessaire pour ce mode de calcul.');
      return;
    }
    if (mode === 'tranche') {
      if (!saisies.unite.trim()) {
        setErreur('Une tranche se rapporte à une unité mesurable.');
        return;
      }
      if (versNombre(saisies.seuilBas) === null && versNombre(saisies.seuilHaut) === null) {
        setErreur('Une tranche a besoin d’au moins une borne.');
        return;
      }
    }

    try {
      setEnregistrement(true);
      setErreur(null);
      await reglesFiscalesService.creer({
        ...brouillon,
        taux: mode === 'taux' || mode === 'tranche' ? versFraction(saisies.taux) : null,
        montant_forfaitaire: mode === 'forfait' ? versNombre(saisies.montant) : null,
        seuil_min: mode === 'tranche' ? versNombre(saisies.seuilBas) : null,
        seuil_max: mode === 'tranche' ? versNombre(saisies.seuilHaut) : null,
        unite_seuil: mode === 'tranche' ? saisies.unite.trim() : null,
      });
      setMessage('Règle enregistrée en projet. Un autre acteur doit l’approuver.');
      fermerFormulaire();
      setOnglet('projet');
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
      setMessage(`« ${regle.libelle} » est désormais en vigueur.`);
      await charger();
    } catch (error) {
      setErreur(errorMessage(error, 'L’approbation a été refusée.'));
    }
  };

  const abroger = async (regle: RegleFiscale) => {
    try {
      setErreur(null);
      await reglesFiscalesService.abroger(regle.id);
      setMessage(`« ${regle.libelle} » est abrogée. Elle reste opposable au passé.`);
      await charger();
    } catch (error) {
      setErreur(errorMessage(error, 'L’abrogation a été refusée.'));
    }
  };

  const colonnes = (courant: Onglet): Column<RegleFiscale>[] => {
    const communes: Column<RegleFiscale>[] = [
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
        key: 'profil_vendeur',
        header: 'Vendeur',
        render: (r) => LIBELLES_PROFILS[r.profil_vendeur] ?? r.profil_vendeur,
      },
      {
        key: 'assiette',
        header: 'Assiette',
        render: (r) => (
          <div>
            <div>{LIBELLES_ASSIETTES[r.assiette]}</div>
            {afficherTranche(r) && (
              <div className="sn-muted" style={{ fontSize: 12 }}>{afficherTranche(r)}</div>
            )}
          </div>
        ),
      },
      { key: 'taux', header: 'Valeur', numeric: true, render: afficherValeur },
      {
        key: 'date_effet',
        header: 'Effet',
        render: (r) => (
          <div>
            <div>{afficherDate(r.date_effet)}</div>
            {r.date_fin && (
              <div className="sn-muted" style={{ fontSize: 12 }}>
                jusqu’au {afficherDate(r.date_fin)}
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
    ];

    if (!peutAdministrer || courant === 'historique') return communes;

    return [...communes, {
      key: 'actions',
      header: 'Action',
      render: (r) => (courant === 'projet' ? (
        <button type="button" className="sn-btn sn-btn--ghost" onClick={() => void approuver(r)}>
          <ShieldCheck aria-hidden="true" /> Approuver
        </button>
      ) : (
        <button type="button" className="sn-btn sn-btn--ghost" onClick={() => void abroger(r)}>
          <Archive aria-hidden="true" /> Abroger
        </button>
      )),
    }];
  };

  const vides: Record<Onglet, { titre: string; texte: string }> = {
    vigueur: {
      titre: 'Aucune règle en vigueur',
      texte: 'Les règles approuvées s’afficheront ici.',
    },
    projet: {
      titre: 'Aucune règle en projet',
      texte: 'Une règle enregistrée attend ici son approbation.',
    },
    historique: {
      titre: 'Aucune règle retirée',
      texte: 'Les règles abrogées ou expirées restent consultables ici.',
    },
  };

  const modeTranche = brouillon.mode_calcul === 'tranche';
  const modeTaux = brouillon.mode_calcul === 'taux' || modeTranche;

  return (
    <NationalDashboardLayout>
      <PageHeader
        title="Règles fiscales"
        subtitle="Taux et barèmes appliqués aux ventes, versionnés par date d’effet."
        icon={Scale}
        breadcrumb={[{ label: 'Conciliation', to: '/conciliation' }, { label: 'Règles fiscales' }]}
        actions={peutAdministrer && !formulaireOuvert ? (
          <button
            type="button"
            className="sn-btn sn-btn--primary"
            onClick={() => { setFormulaireOuvert(true); setMessage(null); setErreur(null); }}
          >
            <Plus aria-hidden="true" /> Nouvelle règle
          </button>
        ) : undefined}
      />

      {erreur && <Note tone="danger" icon={AlertTriangle}>{erreur}</Note>}
      {message && <Note tone="success">{message}</Note>}

      {formulaireOuvert ? (
        <>
          <Section id="regle-identification" icon={FileText} title="Identification">
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

              <Field label="Vendeur concerné" required hint="À qui la règle s’applique.">
                <SelectControl
                  value={brouillon.profil_vendeur ?? 'tous'}
                  onChange={(v) => setBrouillon((b) => ({ ...b, profil_vendeur: v as ProfilVendeur }))}
                  ariaLabel="Profil du vendeur"
                >
                  {(Object.keys(LIBELLES_PROFILS) as ProfilVendeur[]).map((code) => (
                    <option key={code} value={code}>{LIBELLES_PROFILS[code]}</option>
                  ))}
                </SelectControl>
              </Field>

              <Field label="Intitulé" required wide hint="Nom lisible dans les tableaux et les calculs.">
                <input
                  className="sn-input"
                  value={brouillon.libelle}
                  onChange={(e) => setBrouillon((b) => ({ ...b, libelle: e.target.value }))}
                  placeholder="TVA des comptoirs d’achat"
                />
              </Field>
            </div>
          </Section>

          <Section id="regle-calcul" icon={Calculator} title="Calcul">
            <div className="sn-grid sn-grid--2">
              <Field label="Assiette" required hint="Base sur laquelle le taux s’applique.">
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

              {modeTaux && (
                <Field label="Taux" required hint="En pourcentage. Exemple : 1,5.">
                  <input
                    className="sn-input"
                    inputMode="decimal"
                    value={saisies.taux}
                    onChange={(e) => setSaisies((s) => ({ ...s, taux: e.target.value }))}
                    placeholder="1,5"
                  />
                </Field>
              )}

              {brouillon.mode_calcul === 'forfait' && (
                <Field label="Montant forfaitaire" required hint="Montant fixe, en francs CFA.">
                  <input
                    className="sn-input"
                    inputMode="decimal"
                    value={saisies.montant}
                    onChange={(e) => setSaisies((s) => ({ ...s, montant: e.target.value }))}
                    placeholder="250000"
                  />
                </Field>
              )}

              {modeTranche && (
                <>
                  <Field label="Seuil bas" hint="Borne incluse. Vide : sans limite.">
                    <input
                      className="sn-input"
                      inputMode="decimal"
                      value={saisies.seuilBas}
                      onChange={(e) => setSaisies((s) => ({ ...s, seuilBas: e.target.value }))}
                      placeholder="4000"
                    />
                  </Field>
                  <Field label="Seuil haut" hint="Borne exclue. Vide : tranche ouverte.">
                    <input
                      className="sn-input"
                      inputMode="decimal"
                      value={saisies.seuilHaut}
                      onChange={(e) => setSaisies((s) => ({ ...s, seuilHaut: e.target.value }))}
                      placeholder="4500"
                    />
                  </Field>
                  <Field label="Unité du seuil" required hint="Ce que mesure le seuil.">
                    <input
                      className="sn-input"
                      value={saisies.unite}
                      onChange={(e) => setSaisies((s) => ({ ...s, unite: e.target.value }))}
                      placeholder="USD/oz"
                    />
                  </Field>
                </>
              )}
            </div>
          </Section>

          <Section id="regle-application" icon={CalendarDays} title="Application">
            <div className="sn-grid sn-grid--2">
              <Field label="Date d’effet" required hint="Les opérations antérieures gardent leur règle.">
                <input
                  type="date"
                  className="sn-input"
                  value={brouillon.date_effet}
                  onChange={(e) => setBrouillon((b) => ({ ...b, date_effet: e.target.value }))}
                />
              </Field>

              <Field label="Référence réglementaire" hint="Texte ou arrêté qui fonde la règle.">
                <input
                  className="sn-input"
                  value={brouillon.reference_reglementaire ?? ''}
                  onChange={(e) => setBrouillon((b) => ({ ...b, reference_reglementaire: e.target.value }))}
                  placeholder="Arrêté n° …"
                />
              </Field>
            </div>

            <FormActions>
              <button type="button" className="sn-btn sn-btn--ghost" onClick={fermerFormulaire}>
                <ArrowLeft aria-hidden="true" /> Annuler
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
        </>
      ) : (
        <>
          {!chargement && peutAdministrer && parStatut.projet.length > 0 && onglet !== 'projet' && (
            <Note tone="info" icon={Clock}>
              {parStatut.projet.length} règle(s) en projet attendent une approbation.
            </Note>
          )}

          {!chargement && taxesSansRegle.length > 0 && (
            <Note tone="warning" icon={AlertTriangle}>
              Sans règle en vigueur : {taxesSansRegle.map((c) => LIBELLES_TAXES[c]).join(', ')}.
              La conciliation les signale plutôt que de supposer un taux.
            </Note>
          )}

          <Tabs<Onglet>
            value={onglet}
            onChange={setOnglet}
            ariaLabel="État des règles fiscales"
            options={[
              { value: 'vigueur', label: 'En vigueur', icon: ShieldCheck, count: parStatut.vigueur.length },
              { value: 'projet', label: 'En projet', icon: Clock, count: parStatut.projet.length },
              { value: 'historique', label: 'Historique', icon: Archive, count: parStatut.historique.length },
            ]}
          />

          <TabPanel value={onglet}>
            {!chargement && parStatut[onglet].length === 0 ? (
              <EmptyState title={vides[onglet].titre} description={vides[onglet].texte} />
            ) : (
              <DataTable
                columns={colonnes(onglet)}
                rows={parStatut[onglet]}
                loading={chargement}
                caption="Règles fiscales"
                empty="Aucune règle"
              />
            )}
          </TabPanel>
        </>
      )}
    </NationalDashboardLayout>
  );
}

export default ReglesFiscalesPage;
