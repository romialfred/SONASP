import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Scale, Plus, ShieldCheck, Archive, AlertTriangle, FileText, Clock,
  Calculator, CalendarDays, ArrowLeft, MoreVertical, Eye, Search,
  SlidersHorizontal, X, LayoutGrid, Rows3, Receipt, Coins, Landmark,
  Banknote, Building2,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import {
  PageHeader, Section, Field, DataTable, Note, EmptyState, StatGrid, Badge,
  FormActions, SelectControl, Segmented, Tabs, TabPanel, type Column, type StatTone,
} from '@/components/ui/sn';
import { useAuth } from '@/contexts/AuthContext';
import { hasCapability, CAPABILITIES } from '@/lib/capabilities';
import { errorMessage } from '@/lib/errorMessage';
import {
  reglesFiscalesService, LIBELLES_TAXES, LIBELLES_ASSIETTES, LIBELLES_MODES,
  LIBELLES_PROFILS, LIBELLES_STATUTS,
  type RegleFiscale, type CodeTaxe, type Assiette, type ModeCalcul,
  type ProfilVendeur, type BrouillonRegle,
} from '@/services/reglesFiscalesService';
import './regles-fiscales.css';

type Onglet = 'vigueur' | 'projet' | 'historique';
type Vue = 'tuiles' | 'tableau';

/** Chaque taxe porte son icône et sa teinte, pour se reconnaître d'un coup d'œil. */
const SIGNES_TAXES: Record<CodeTaxe, { icone: typeof Receipt; teinte: string }> = {
  tva: { icone: Receipt, teinte: '' },
  royalties: { icone: Coins, teinte: 'is-gold' },
  fndl: { icone: Landmark, teinte: 'is-violet' },
  retenue_source: { icone: Banknote, teinte: 'is-neutral' },
  taxe_communale: { icone: Building2, teinte: 'is-neutral' },
};

const TON_STATUT: Record<string, 'success' | 'warning' | 'neutral'> = {
  approuvee: 'success',
  projet: 'warning',
  abrogee: 'neutral',
};

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

interface Filtres {
  recherche: string;
  taxe: CodeTaxe | 'toutes';
  vendeur: ProfilVendeur | 'tous_profils';
}

const FILTRES_INITIAUX: Filtres = { recherche: '', taxe: 'toutes', vendeur: 'tous_profils' };

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
      ? '—'
      : `${formatNombre(regle.montant_forfaitaire)} XOF`;
  }
  if (regle.taux === null) return '—';
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

function afficherDate(valeur: string | null): string {
  return valeur ? new Date(valeur).toLocaleDateString('fr-FR') : '—';
}

/**
 * Menu d'actions d'une tuile. Il se ferme au clic extérieur et à la touche
 * Échap, sans quoi il resterait ouvert derrière la tuile suivante.
 */
function MenuRegle({ actions }: { actions: { cle: string; libelle: string; icone: typeof Eye; faire: () => void }[] }) {
  const [ouvert, setOuvert] = useState(false);
  const conteneur = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouvert) return undefined;
    const auClic = (event: MouseEvent) => {
      if (!conteneur.current?.contains(event.target as Node)) setOuvert(false);
    };
    const auClavier = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOuvert(false);
    };
    document.addEventListener('mousedown', auClic);
    document.addEventListener('keydown', auClavier);
    return () => {
      document.removeEventListener('mousedown', auClic);
      document.removeEventListener('keydown', auClavier);
    };
  }, [ouvert]);

  return (
    <div className="rf-menu" ref={conteneur}>
      <button
        type="button"
        className="sn-btn sn-btn--ghost sn-btn--icon"
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-label="Actions sur la règle"
        onClick={() => setOuvert((o) => !o)}
      >
        <MoreVertical aria-hidden="true" />
      </button>
      {ouvert && (
        <div className="rf-menu__liste" role="menu">
          {actions.map(({ cle, libelle, icone: Icone, faire }) => (
            <button
              key={cle}
              type="button"
              role="menuitem"
              onClick={() => { setOuvert(false); faire(); }}
            >
              <Icone aria-hidden="true" /> {libelle}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ReglesFiscalesPage() {
  const { user } = useAuth();
  const [regles, setRegles] = useState<RegleFiscale[]>([]);
  const [noms, setNoms] = useState<Record<string, string>>({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<Onglet>('vigueur');
  const [vue, setVue] = useState<Vue>('tuiles');
  const [filtres, setFiltres] = useState<Filtres>(FILTRES_INITIAUX);
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const [detail, setDetail] = useState<RegleFiscale | null>(null);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [brouillon, setBrouillon] = useState<BrouillonRegle>(BROUILLON_INITIAL);
  const [saisies, setSaisies] = useState<SaisiesNumeriques>(SAISIES_INITIALES);
  const [enregistrement, setEnregistrement] = useState(false);

  const peutAdministrer = hasCapability(user, CAPABILITIES.TAX_RULES_MANAGE);

  const charger = useCallback(async () => {
    try {
      setChargement(true);
      setErreur(null);
      const lignes = await reglesFiscalesService.lister();
      setRegles(lignes);

      const acteurs = lignes.flatMap((r) => [r.cree_par, r.approuve_par, r.abroge_par]);
      // Le nom des acteurs est un agrément : son absence ne doit pas vider la liste.
      try {
        setNoms(await reglesFiscalesService.nomsActeurs(acteurs.filter((id): id is string => !!id)));
      } catch {
        setNoms({});
      }
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

  // Une confirmation s'efface d'elle-même : elle n'a pas à encombrer l'écran
  // jusqu'au rechargement suivant.
  useEffect(() => {
    if (!message) return undefined;
    const minuteur = window.setTimeout(() => setMessage(null), 6000);
    return () => window.clearTimeout(minuteur);
  }, [message]);

  const parStatut = useMemo(() => {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    return {
      vigueur: regles.filter((r) => estApplicable(r, aujourdhui)),
      projet: regles.filter((r) => r.statut === 'projet'),
      historique: regles.filter((r) => r.statut !== 'projet' && !estApplicable(r, aujourdhui)),
    };
  }, [regles]);

  const derniereMaj = useMemo(() => {
    if (regles.length === 0) return null;
    const recente = [...regles].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
    const acteur = recente.abroge_par ?? recente.approuve_par ?? recente.cree_par;
    return { date: recente.updated_at, par: acteur ? noms[acteur] : undefined };
  }, [regles, noms]);

  const filtresActifs =
    (filtres.taxe !== 'toutes' ? 1 : 0) + (filtres.vendeur !== 'tous_profils' ? 1 : 0);

  const visibles = useMemo(() => {
    const terme = filtres.recherche.trim().toLowerCase();
    return parStatut[onglet].filter((r) => {
      if (filtres.taxe !== 'toutes' && r.code_taxe !== filtres.taxe) return false;
      if (filtres.vendeur !== 'tous_profils' && r.profil_vendeur !== filtres.vendeur) return false;
      if (!terme) return true;
      return [
        LIBELLES_TAXES[r.code_taxe],
        r.libelle,
        LIBELLES_PROFILS[r.profil_vendeur] ?? r.profil_vendeur,
        LIBELLES_ASSIETTES[r.assiette],
        r.reference_reglementaire ?? '',
      ].some((champ) => champ.toLowerCase().includes(terme));
    });
  }, [parStatut, onglet, filtres]);

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
      setDetail(null);
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
      setDetail(null);
      await charger();
    } catch (error) {
      setErreur(errorMessage(error, 'L’abrogation a été refusée.'));
    }
  };

  /** Actions ouvertes sur une règle, selon son état et l'habilitation du lecteur. */
  const actionsPour = (regle: RegleFiscale) => {
    const actions = [
      { cle: 'voir', libelle: 'Voir le détail', icone: Eye, faire: () => setDetail(regle) },
    ];
    if (!peutAdministrer) return actions;
    if (regle.statut === 'projet') {
      actions.push({ cle: 'approuver', libelle: 'Approuver', icone: ShieldCheck, faire: () => void approuver(regle) });
    } else if (estApplicable(regle, new Date().toISOString().slice(0, 10))) {
      actions.push({ cle: 'abroger', libelle: 'Abroger', icone: Archive, faire: () => void abroger(regle) });
    }
    return actions;
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
    {
      key: 'actions',
      header: 'Action',
      render: (r) => <MenuRegle actions={actionsPour(r)} />,
    },
  ];

  const vides: Record<Onglet, { titre: string; texte: string }> = {
    vigueur: {
      titre: 'Aucune règle en vigueur',
      texte: 'Les règles approuvées s’affichent ici.',
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

  const indicateurs = [
    {
      label: 'Règles en vigueur',
      value: String(parStatut.vigueur.length),
      hint: 'Actives à ce jour',
      icon: ShieldCheck,
      tone: 'green' as StatTone,
      onClick: () => setOnglet('vigueur'),
    },
    {
      label: 'En projet',
      value: String(parStatut.projet.length),
      hint: 'En attente d’approbation',
      icon: Clock,
      tone: 'gold' as StatTone,
      onClick: () => setOnglet('projet'),
    },
    {
      label: 'Historique',
      value: String(parStatut.historique.length),
      hint: 'Abrogées ou expirées',
      icon: Archive,
      tone: 'violet' as StatTone,
      onClick: () => setOnglet('historique'),
    },
    {
      label: 'Dernière mise à jour',
      value: derniereMaj ? afficherDate(derniereMaj.date) : '—',
      hint: derniereMaj?.par ? `Par ${derniereMaj.par}` : 'Aucune écriture',
      icon: CalendarDays,
      tone: 'blue' as StatTone,
    },
  ];

  const modeTranche = brouillon.mode_calcul === 'tranche';
  const modeTaux = brouillon.mode_calcul === 'taux' || modeTranche;

  const rendreTuile = (regle: RegleFiscale) => {
    const { icone: Icone, teinte } = SIGNES_TAXES[regle.code_taxe];
    const inactive = onglet === 'historique';
    const tranche = afficherTranche(regle);

    return (
      <article key={regle.id} className={`rf-tuile${inactive ? ' is-inactive' : ''}`}>
        <div className="rf-tuile__haut">
          <span className={`rf-tuile__icone ${teinte}`.trim()}>
            <Icone aria-hidden="true" />
          </span>
          <div className="rf-tuile__titre">
            <h3>{LIBELLES_TAXES[regle.code_taxe]}</h3>
            <p title={regle.libelle}>{regle.libelle}</p>
          </div>
          <div className="rf-tuile__valeur">
            <span>Valeur</span>
            <strong>{afficherValeur(regle)}</strong>
          </div>
          <MenuRegle actions={actionsPour(regle)} />
        </div>

        <dl className="rf-tuile__faits">
          <div className="rf-fait">
            <dt>Vendeur</dt>
            <dd>{LIBELLES_PROFILS[regle.profil_vendeur] ?? regle.profil_vendeur}</dd>
          </div>
          <div className="rf-fait">
            <dt>Assiette</dt>
            <dd>{LIBELLES_ASSIETTES[regle.assiette]}{tranche ? `, ${tranche}` : ''}</dd>
          </div>
          <div className="rf-fait">
            <dt>Effet</dt>
            <dd>
              {afficherDate(regle.date_effet)}
              {regle.date_fin ? ` → ${afficherDate(regle.date_fin)}` : ''}
            </dd>
          </div>
        </dl>

        <div className="rf-tuile__pied">
          {onglet === 'vigueur' ? (
            <span className="sn-muted" style={{ fontSize: 11.5 }}>
              {regle.reference_reglementaire || 'Référence non renseignée'}
            </span>
          ) : (
            <Badge tone={TON_STATUT[regle.statut] ?? 'neutral'}>{LIBELLES_STATUTS[regle.statut]}</Badge>
          )}
          <button
            type="button"
            className="sn-btn sn-btn--ghost sn-btn--sm"
            onClick={() => setDetail(regle)}
          >
            <Eye aria-hidden="true" /> Voir
          </button>
        </div>
      </article>
    );
  };

  return (
    <NationalDashboardLayout>
      <div className="sn-page">
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
            {/* Le référentiel ne se signale que lorsqu'il est vide : une fois des
                règles saisies, l'écran les montre au lieu de les commenter. */}
            {!chargement && regles.length === 0 && (
              <Note tone="warning" icon={AlertTriangle}>
                Aucune règle n’est enregistrée. La conciliation calcule les écarts commerciaux
                et laisse les taxes de côté.
              </Note>
            )}

            <StatGrid items={indicateurs} ariaLabel="État du référentiel fiscal" sober />

            <div className="rf-barre">
              <Tabs<Onglet>
                value={onglet}
                onChange={setOnglet}
                ariaLabel="État des règles fiscales"
                variant="pill"
                options={[
                  { value: 'vigueur', label: 'En vigueur', count: parStatut.vigueur.length },
                  { value: 'projet', label: 'En projet', count: parStatut.projet.length },
                  { value: 'historique', label: 'Historique', count: parStatut.historique.length },
                ]}
              />

              <div className="rf-barre__filtres">
                <div className="sn-search rf-barre__recherche">
                  <Search aria-hidden="true" />
                  <input
                    value={filtres.recherche}
                    onChange={(e) => setFiltres((f) => ({ ...f, recherche: e.target.value }))}
                    placeholder="Rechercher une règle, une taxe, un vendeur…"
                    aria-label="Rechercher une règle fiscale"
                  />
                </div>

                <button
                  type="button"
                  className={`sn-btn sn-btn--sm${filtresActifs > 0 ? ' is-filtered' : ''}`}
                  onClick={() => setFiltresOuverts(true)}
                >
                  <SlidersHorizontal aria-hidden="true" />
                  Filtres{filtresActifs > 0 ? ` (${filtresActifs})` : ''}
                </button>

                <Segmented<Vue>
                  name="vue-regles"
                  value={vue}
                  onChange={setVue}
                  ariaLabel="Mode d’affichage"
                  options={[
                    { value: 'tuiles', label: 'Tuiles', icon: LayoutGrid },
                    { value: 'tableau', label: 'Tableau', icon: Rows3 },
                  ]}
                />
              </div>
            </div>

            <TabPanel value={onglet}>
              {!chargement && visibles.length === 0 ? (
                <EmptyState
                  title={parStatut[onglet].length === 0 ? vides[onglet].titre : 'Aucun résultat'}
                  description={
                    parStatut[onglet].length === 0
                      ? vides[onglet].texte
                      : 'Aucune règle ne correspond à la recherche ni aux filtres.'
                  }
                  action={
                    parStatut[onglet].length > 0 ? (
                      <button
                        type="button"
                        className="sn-btn sn-btn--sm"
                        onClick={() => setFiltres(FILTRES_INITIAUX)}
                      >
                        Réinitialiser
                      </button>
                    ) : undefined
                  }
                />
              ) : vue === 'tuiles' ? (
                <div className="rf-tuiles">{visibles.map(rendreTuile)}</div>
              ) : (
                <DataTable
                  columns={colonnes}
                  rows={visibles}
                  loading={chargement}
                  caption="Règles fiscales"
                  empty="Aucune règle"
                />
              )}
            </TabPanel>
          </>
        )}

        {filtresOuverts && (
          <div className="sn-drawer" role="dialog" aria-modal="true" aria-label="Filtres du référentiel">
            <div className="sn-drawer__backdrop" aria-hidden="true" onClick={() => setFiltresOuverts(false)} />
            <div className="sn-drawer__panel">
              <header>
                <h3><SlidersHorizontal aria-hidden="true" /> Filtres</h3>
                <button type="button" aria-label="Fermer les filtres" onClick={() => setFiltresOuverts(false)}>
                  <X aria-hidden="true" />
                </button>
              </header>

              <div className="sn-drawer__body">
                <Field label="Taxe">
                  <SelectControl
                    value={filtres.taxe}
                    onChange={(v) => setFiltres((f) => ({ ...f, taxe: v as Filtres['taxe'] }))}
                    ariaLabel="Filtrer par taxe"
                  >
                    <option value="toutes">Toutes les taxes</option>
                    {(Object.keys(LIBELLES_TAXES) as CodeTaxe[]).map((code) => (
                      <option key={code} value={code}>{LIBELLES_TAXES[code]}</option>
                    ))}
                  </SelectControl>
                </Field>

                <Field label="Vendeur">
                  <SelectControl
                    value={filtres.vendeur}
                    onChange={(v) => setFiltres((f) => ({ ...f, vendeur: v as Filtres['vendeur'] }))}
                    ariaLabel="Filtrer par vendeur"
                  >
                    <option value="tous_profils">Tous les profils</option>
                    {(Object.keys(LIBELLES_PROFILS) as ProfilVendeur[]).map((code) => (
                      <option key={code} value={code}>{LIBELLES_PROFILS[code]}</option>
                    ))}
                  </SelectControl>
                </Field>
              </div>

              <footer>
                <button
                  type="button"
                  className="sn-btn sn-btn--ghost"
                  onClick={() => setFiltres(FILTRES_INITIAUX)}
                >
                  Réinitialiser
                </button>
                <button
                  type="button"
                  className="sn-btn sn-btn--primary"
                  onClick={() => setFiltresOuverts(false)}
                >
                  Appliquer
                </button>
              </footer>
            </div>
          </div>
        )}

        {detail && (
          <div className="sn-drawer" role="dialog" aria-modal="true" aria-label="Détail de la règle">
            <div className="sn-drawer__backdrop" aria-hidden="true" onClick={() => setDetail(null)} />
            <div className="sn-drawer__panel">
              <header>
                <h3><Scale aria-hidden="true" /> {LIBELLES_TAXES[detail.code_taxe]}</h3>
                <button type="button" aria-label="Fermer le détail" onClick={() => setDetail(null)}>
                  <X aria-hidden="true" />
                </button>
              </header>

              <div className="sn-drawer__body">
                <dl className="rf-detail">
                  <div className="rf-detail__ligne">
                    <dt>Intitulé</dt>
                    <dd>{detail.libelle}</dd>
                  </div>
                  <div className="rf-detail__ligne">
                    <dt>Statut</dt>
                    <dd><Badge tone={TON_STATUT[detail.statut] ?? 'neutral'}>{LIBELLES_STATUTS[detail.statut]}</Badge></dd>
                  </div>
                  <div className="rf-detail__ligne">
                    <dt>Vendeur concerné</dt>
                    <dd>{LIBELLES_PROFILS[detail.profil_vendeur] ?? detail.profil_vendeur}</dd>
                  </div>
                  <div className="rf-detail__ligne">
                    <dt>Assiette</dt>
                    <dd>{LIBELLES_ASSIETTES[detail.assiette]}</dd>
                  </div>
                  <div className="rf-detail__ligne">
                    <dt>Mode de calcul</dt>
                    <dd>{LIBELLES_MODES[detail.mode_calcul]}{afficherTranche(detail) ? `, ${afficherTranche(detail)}` : ''}</dd>
                  </div>
                  <div className="rf-detail__ligne">
                    <dt>Valeur</dt>
                    <dd>{afficherValeur(detail)}</dd>
                  </div>
                  <div className="rf-detail__ligne">
                    <dt>Période</dt>
                    <dd>
                      à partir du {afficherDate(detail.date_effet)}
                      {detail.date_fin ? `, jusqu’au ${afficherDate(detail.date_fin)}` : ''}
                    </dd>
                  </div>
                  <div className="rf-detail__ligne">
                    <dt>Référence réglementaire</dt>
                    <dd>{detail.reference_reglementaire || 'non renseignée'}</dd>
                  </div>
                  {detail.commentaire && (
                    <div className="rf-detail__ligne">
                      <dt>Commentaire</dt>
                      <dd>{detail.commentaire}</dd>
                    </div>
                  )}
                  <div className="rf-detail__ligne">
                    <dt>Saisie</dt>
                    <dd>
                      {afficherDate(detail.cree_le)}
                      {detail.cree_par && noms[detail.cree_par] ? ` par ${noms[detail.cree_par]}` : ''}
                    </dd>
                  </div>
                  {detail.approuve_le && (
                    <div className="rf-detail__ligne">
                      <dt>Approbation</dt>
                      <dd>
                        {afficherDate(detail.approuve_le)}
                        {detail.approuve_par && noms[detail.approuve_par] ? ` par ${noms[detail.approuve_par]}` : ''}
                      </dd>
                    </div>
                  )}
                  {detail.abroge_le && (
                    <div className="rf-detail__ligne">
                      <dt>Abrogation</dt>
                      <dd>
                        {afficherDate(detail.abroge_le)}
                        {detail.abroge_par && noms[detail.abroge_par] ? ` par ${noms[detail.abroge_par]}` : ''}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {peutAdministrer && (
                <footer>
                  <button type="button" className="sn-btn sn-btn--ghost" onClick={() => setDetail(null)}>
                    Fermer
                  </button>
                  {detail.statut === 'projet' && (
                    <button type="button" className="sn-btn sn-btn--primary" onClick={() => void approuver(detail)}>
                      <ShieldCheck aria-hidden="true" /> Approuver
                    </button>
                  )}
                  {estApplicable(detail, new Date().toISOString().slice(0, 10)) && (
                    <button type="button" className="sn-btn" onClick={() => void abroger(detail)}>
                      <Archive aria-hidden="true" /> Abroger
                    </button>
                  )}
                </footer>
              )}
            </div>
          </div>
        )}
      </div>
    </NationalDashboardLayout>
  );
}

export default ReglesFiscalesPage;
