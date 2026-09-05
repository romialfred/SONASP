import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, CalendarClock, FileSignature, Plus, RefreshCw, Scale, ShieldCheck,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, EmptyState, Note, PageHeader, Section, StatGrid } from '@/components/ui/sn';
import { useMineWorkspace } from '@/hooks/useMineWorkspace';
import { messageErreurUtilisateur } from '@/lib/presentError';
import { achatsIndustrielsService, type Societe } from '@/services/achatsIndustrielsService';
import {
  contratsService,
  ETATS_VIVANTS,
  formaterNombre,
  formaterQuantite,
  joursAvantEcheance,
  LIBELLES_PARTENAIRE,
  LIBELLES_STATUT_CONTRAT,
  LIBELLES_TYPE_CONTRAT,
  TONS_STATUT_CONTRAT,
  type Contrat,
  type PartenaireType,
  type StatutContrat,
} from '@/services/contratsService';
import './contrats.css';

/**
 * Registre des contrats de fourniture d'or.
 *
 * L'écran s'ouvre sur tous les états : c'est un registre, pas une file
 * d'attente. Les indicateurs portent sur l'ensemble et mènent au travail
 * qu'ils annoncent — un contrat qui approche de son terme demande une décision,
 * et le compteur qui l'annonce filtre la liste sur les contrats concernés.
 */

/** Un contrat vivant dont le terme approche appelle une décision de renouvellement. */
export const SEUIL_ECHEANCE_JOURS = 60;

export const echeanceProche = (contrat: Contrat) => {
  if (!ETATS_VIVANTS.includes(contrat.statut)) return false;
  const jours = joursAvantEcheance(contrat);
  return jours !== null && jours >= 0 && jours <= SEUIL_ECHEANCE_JOURS;
};

const formaterDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const date = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('fr-FR');
};

export function ContratsPage() {
  const navigate = useNavigate();
  const { isMine, companyId } = useMineWorkspace();

  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [tous, setTous] = useState<Contrat[]>([]);
  const [societes, setSocietes] = useState<Societe[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [filtreStatut, setFiltreStatut] = useState('all');
  const [filtrePartenaire, setFiltrePartenaire] = useState('all');
  const [filtreSociete, setFiltreSociete] = useState('all');
  const [recherche, setRecherche] = useState('');
  const [seulementEcheance, setSeulementEcheance] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const societeImposee = isMine ? companyId || '__mine_indisponible__' : filtreSociete;
      const [liste, ensemble, societesChargees] = await Promise.all([
        contratsService.lister({
          statut: filtreStatut,
          partenaireType: filtrePartenaire,
          societe: societeImposee,
          recherche,
        }),
        contratsService.lister(isMine ? { societe: societeImposee } : undefined),
        isMine ? Promise.resolve([]) : achatsIndustrielsService.societesProductrices(),
      ]);
      setContrats(liste);
      setTous(ensemble);
      setSocietes(societesChargees);
    } catch (raison) {
      setErreur(messageErreurUtilisateur(raison, 'Impossible de charger les contrats.'));
      setContrats([]);
      setTous([]);
    } finally {
      setChargement(false);
    }
  }, [companyId, filtreStatut, filtrePartenaire, filtreSociete, isMine, recherche]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const cumuls = useMemo(() => {
    const actifs = tous.filter((contrat) => contrat.statut === 'actif');
    return {
      total: tous.length,
      actifs: actifs.length,
      echeance: tous.filter(echeanceProche).length,
      suspendus: tous.filter((contrat) => contrat.statut === 'suspendu').length,
      enValidation: tous.filter((contrat) => [
        'soumis', 'revue_juridique', 'validation_metier', 'validation_financiere', 'approuve',
      ].includes(contrat.statut)).length,
      quantiteEngagee: actifs.reduce(
        (somme, contrat) => somme + Number(contrat.quantite_totale || 0), 0
      ),
    };
  }, [tous]);

  const affiches = useMemo(
    () => (seulementEcheance ? contrats.filter(echeanceProche) : contrats),
    [contrats, seulementEcheance]
  );

  const filtre = filtreStatut !== 'all' || filtrePartenaire !== 'all'
    || filtreSociete !== 'all' || recherche.trim() !== '' || seulementEcheance;

  const retirerFiltres = () => {
    setFiltreStatut('all');
    setFiltrePartenaire('all');
    setFiltreSociete('all');
    setRecherche('');
    setSeulementEcheance(false);
  };

  return (
    <NationalDashboardLayout>
      <div className="sn-page contrats-page">
        <PageHeader
          icon={FileSignature}
          title={isMine ? 'Contrats avec la SONASP' : 'Contrats de fourniture d’or'}
          subtitle={isMine
            ? 'Vos contrats actifs et les propositions transmises à la SONASP.'
            : 'Engagements pris avec les mines, les sites artisanaux et les orpailleurs.'}
          breadcrumb={[{ label: isMine ? 'Relations avec la SONASP' : 'Achats d’or' }, { label: 'Contrats' }]}
          info={{
            titre: 'Ce que porte un contrat',
            contenu: (
              <ul className="contrats-lexique">
                <li>Les quantités engagées, période par période, qui alimentent les plans d’achat.</li>
                <li>La teneur de référence, sa tolérance et le laboratoire qui tranche un écart.</li>
                <li>La méthode de fixation du prix et les conditions de règlement.</li>
                <li>Les manquements constatés, de part et d’autre, et leur traitement.</li>
              </ul>
            ),
          }}
          actions={
            <>
              <button type="button" className="sn-btn" onClick={() => void charger()} disabled={chargement}>
                <RefreshCw className={chargement ? 'sn-spin' : ''} aria-hidden="true" /> Actualiser
              </button>
              <button
                type="button" className="sn-btn sn-btn--primary"
                onClick={() => navigate('/contrats/nouveau')}
              >
                <Plus aria-hidden="true" /> {isMine ? 'Proposer un contrat' : 'Nouveau contrat'}
              </button>
            </>
          }
        />

        {erreur && <Note tone="danger" icon={AlertTriangle}>{erreur}</Note>}

        <StatGrid
          sober
          ariaLabel="Cumuls des contrats"
          items={[
            {
              label: 'Contrats enregistrés',
              value: formaterNombre(cumuls.total),
              icon: FileSignature,
              tone: 'neutral',
            },
            {
              label: 'Actifs',
              value: formaterNombre(cumuls.actifs),
              icon: ShieldCheck,
              tone: 'green',
              onClick: cumuls.actifs > 0
                ? () => { retirerFiltres(); setFiltreStatut('actif'); }
                : undefined,
            },
            {
              label: 'Terme dans 60 jours',
              value: formaterNombre(cumuls.echeance),
              icon: CalendarClock,
              tone: cumuls.echeance > 0 ? 'gold' : 'neutral',
              onClick: cumuls.echeance > 0
                ? () => { retirerFiltres(); setSeulementEcheance(true); }
                : undefined,
            },
            {
              label: 'En validation',
              value: formaterNombre(cumuls.enValidation),
              icon: Scale,
              tone: cumuls.enValidation > 0 ? 'blue' : 'neutral',
            },
            {
              label: 'Quantité engagée, contrats actifs',
              value: formaterQuantite(cumuls.quantiteEngagee),
              icon: FileSignature,
              tone: 'neutral',
            },
          ]}
        />

        <Section
          id="registre"
          icon={FileSignature}
          title="Registre des contrats"
          description="Chaque ligne mène au dossier complet du contrat."
        >
          <div className="contrats-filtres">
            <label className="sn-field">
              <span className="sn-field__label">Rechercher</span>
              <input
                type="search" value={recherche}
                onChange={(evenement) => setRecherche(evenement.target.value)}
                placeholder="Numéro ou intitulé"
              />
            </label>
            <label className="sn-field">
              <span className="sn-field__label">État</span>
              <select value={filtreStatut} onChange={(evenement) => setFiltreStatut(evenement.target.value)}>
                <option value="all">Tous les états</option>
                {(Object.keys(LIBELLES_STATUT_CONTRAT) as StatutContrat[]).map((statut) => (
                  <option key={statut} value={statut}>{LIBELLES_STATUT_CONTRAT[statut]}</option>
                ))}
              </select>
            </label>
            {!isMine && <label className="sn-field">
              <span className="sn-field__label">Catégorie de partenaire</span>
              <select
                value={filtrePartenaire}
                onChange={(evenement) => setFiltrePartenaire(evenement.target.value)}
              >
                <option value="all">Toutes les catégories</option>
                {(Object.keys(LIBELLES_PARTENAIRE) as PartenaireType[]).map((type) => (
                  <option key={type} value={type}>{LIBELLES_PARTENAIRE[type]}</option>
                ))}
              </select>
            </label>}
            {!isMine && <label className="sn-field">
              <span className="sn-field__label">Société minière</span>
              <select value={filtreSociete} onChange={(evenement) => setFiltreSociete(evenement.target.value)}>
                <option value="all">Toutes les sociétés</option>
                {societes.map((societe) => (
                  <option key={societe.id} value={societe.id}>{societe.name}</option>
                ))}
              </select>
            </label>}
          </div>

          {chargement ? (
            <p className="production-page__loading">Chargement des contrats…</p>
          ) : affiches.length === 0 ? (
            <EmptyState
              title={filtre ? 'Aucun contrat ne correspond' : 'Aucun contrat enregistré'}
              description={
                filtre && cumuls.total > 0
                  ? `${cumuls.total} contrat(s) existent sous d’autres critères.`
                  : isMine
                    ? 'Proposez un contrat à la SONASP ou consultez les engagements déjà conclus.'
                    : 'Un contrat fixe les quantités qu’un fournisseur s’engage à livrer, la teneur attendue et le prix. Il alimente ensuite les plans d’achat mensuels.'
              }
              action={filtre ? (
                <button type="button" className="sn-btn" onClick={retirerFiltres}>
                  Retirer les filtres
                </button>
              ) : (
                <button
                  type="button" className="sn-btn sn-btn--primary"
                  onClick={() => navigate('/contrats/nouveau')}
                >
                  <Plus aria-hidden="true" /> {isMine ? 'Proposer un contrat' : 'Établir un contrat'}
                </button>
              )}
            />
          ) : (
            <div className="sn-table-wrap">
              <table className="sn-table contrats-table">
                <thead>
                  <tr>
                    <th scope="col">Contrat</th>
                    <th scope="col">Partenaire</th>
                    <th scope="col">Catégorie</th>
                    <th scope="col">Type</th>
                    <th scope="col">Période</th>
                    <th scope="col" className="sn-table__num">Quantité engagée</th>
                    <th scope="col">État</th>
                  </tr>
                </thead>
                <tbody>
                  {affiches.map((contrat) => {
                    const jours = joursAvantEcheance(contrat);
                    return (
                      <tr
                        key={contrat.id}
                        className="is-clickable"
                        onClick={() => navigate(`/contrats/${contrat.id}`)}
                      >
                        <td>
                          <strong>{contrat.numero_contrat}</strong>
                          <small className="contrats-table__sous">{contrat.intitule}</small>
                        </td>
                        <td>
                          {contrat.mining_company?.name
                            || contrat.partenaire_libelle
                            || 'Partenaire non nommé'}
                        </td>
                        <td>{LIBELLES_PARTENAIRE[contrat.partenaire_type]}</td>
                        <td>{LIBELLES_TYPE_CONTRAT[contrat.type_contrat]}</td>
                        <td>
                          {formaterDate(contrat.date_debut)} au {formaterDate(contrat.date_fin)}
                          {echeanceProche(contrat) && jours !== null && (
                            <small className="contrats-table__alerte">
                              Terme dans {jours} jour(s)
                            </small>
                          )}
                        </td>
                        <td className="sn-table__num">
                          {formaterQuantite(contrat.quantite_totale, contrat.unite)}
                        </td>
                        <td>
                          <Badge tone={TONS_STATUT_CONTRAT[contrat.statut]}>
                            {LIBELLES_STATUT_CONTRAT[contrat.statut]}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5}>
                      {formaterNombre(affiches.length)} contrat(s) affiché(s)
                    </td>
                    <td className="sn-table__num">
                      {formaterQuantite(affiches.reduce(
                        (somme, contrat) => somme + Number(contrat.quantite_totale || 0), 0
                      ))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Section>

        {cumuls.suspendus > 0 && (
          <Note tone="warning" icon={AlertTriangle}>
            {cumuls.suspendus} contrat(s) suspendu(s) : aucune livraison ne s’impute dessus tant
            que la suspension n’est pas levée. Le montant reste dû pour ce qui a déjà été livré.
          </Note>
        )}
      </div>
    </NationalDashboardLayout>
  );
}

export default ContratsPage;
