import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Gavel, Plus, RefreshCw, Scale, Send, Truck,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, EmptyState, Note, PageHeader, Section, StatGrid } from '@/components/ui/sn';
import { useMineWorkspace } from '@/hooks/useMineWorkspace';
import { messageErreurUtilisateur } from '@/lib/presentError';
import { achatsIndustrielsService, type Societe } from '@/services/achatsIndustrielsService';
import {
  LIBELLES_REGIME,
  LIBELLES_STATUT_REQUISITION,
  LIBELLES_TYPE_REQUISITION,
  requisitionsService,
  TONS_STATUT_REQUISITION,
  type RegimeJuridique,
  type Requisition,
  type StatutRequisition,
} from '@/services/requisitionsService';
import { formaterNombre, formaterQuantite } from '@/services/contratsService';
import '@/pages/contrats/contrats.css';
import './requisitions.css';

/**
 * Registre des réquisitions de production d'or.
 *
 * Le régime juridique est affiché sur chaque ligne, parce que c'est lui qui
 * décide de ce que la mine peut faire : accuser réception ne vaut pas accord,
 * et un régime non qualifié interdit d'aller plus loin.
 */

/** Étapes où la pièce attend une décision ou un geste de la SONASP. */
export const ETATS_EN_COURS: StatutRequisition[] = [
  'brouillon', 'verification_juridique', 'validation_metier', 'validation_direction',
  'autorisee', 'notifiee', 'accusee', 'contestee', 'executoire',
  'enlevement_planifie', 'en_cours_enlevement', 'collectee', 'en_analyse', 'acceptee',
];

const formaterDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const date = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('fr-FR');
};

export function RequisitionsPage() {
  const navigate = useNavigate();
  const { isMine, companyId } = useMineWorkspace();

  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [toutes, setToutes] = useState<Requisition[]>([]);
  const [societes, setSocietes] = useState<Societe[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [filtreStatut, setFiltreStatut] = useState('all');
  const [filtreSociete, setFiltreSociete] = useState('all');
  const [filtreRegime, setFiltreRegime] = useState('all');

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const societeImposee = isMine ? companyId || '__mine_indisponible__' : filtreSociete;
      const [liste, ensemble, societesChargees] = await Promise.all([
        requisitionsService.lister({
          statut: filtreStatut, societe: societeImposee, regime: filtreRegime,
        }),
        requisitionsService.lister(isMine ? { societe: societeImposee } : undefined),
        isMine ? Promise.resolve([]) : achatsIndustrielsService.societesProductrices(),
      ]);
      setRequisitions(liste);
      setToutes(ensemble);
      setSocietes(societesChargees);
    } catch (raison) {
      setErreur(messageErreurUtilisateur(raison, 'Impossible de charger les réquisitions.'));
      setRequisitions([]);
      setToutes([]);
    } finally {
      setChargement(false);
    }
  }, [companyId, filtreStatut, filtreSociete, filtreRegime, isMine]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const cumuls = useMemo(() => ({
    total: toutes.length,
    enCours: toutes.filter((piece) => ETATS_EN_COURS.includes(piece.statut)).length,
    aQualifier: toutes.filter((piece) => piece.regime_juridique === 'a_qualifier'
      && piece.statut !== 'annulee').length,
    aNotifier: toutes.filter((piece) => piece.statut === 'autorisee').length,
    aEnlever: toutes.filter((piece) =>
      ['executoire', 'enlevement_planifie', 'en_cours_enlevement'].includes(piece.statut)).length,
    quantite: toutes.reduce((somme, piece) => somme + Number(piece.quantite_oz || 0), 0),
  }), [toutes]);

  const filtre = filtreStatut !== 'all' || filtreSociete !== 'all' || filtreRegime !== 'all';

  const retirerFiltres = () => {
    setFiltreStatut('all');
    setFiltreSociete('all');
    setFiltreRegime('all');
  };

  return (
    <NationalDashboardLayout>
      <div className="sn-page contrats-page requisitions-page">
        <PageHeader
          icon={Gavel}
          title={isMine ? 'Réquisitions reçues' : 'Réquisitions de production'}
          subtitle={isMine
            ? 'Demandes émises par la SONASP : consultez le dossier puis approuvez ou contestez avec un commentaire.'
            : 'Mesures portant sur tout ou partie de la production d’une mine, sur fondement juridique.'}
          breadcrumb={[{ label: isMine ? 'Relations avec la SONASP' : 'Achats d’or' }, { label: 'Réquisitions' }]}
          info={{
            titre: 'Trois régimes, qui ne se confondent pas',
            contenu: (
              <ul className="contrats-lexique">
                <li>
                  <b>Exécutoire sans accord</b> : l’acte habilitant suffit. La mine accuse
                  réception et peut formuler des observations ; son accord n’est pas requis.
                </li>
                <li>
                  <b>Accord requis</b> : le cadre applicable subordonne l’exécution à l’accord de
                  la mine. Sans cet accord, la réquisition ne devient pas exécutoire.
                </li>
                <li>
                  <b>À qualifier</b> : le régime reste à établir. La réquisition ne peut être ni
                  autorisée ni rendue exécutoire en l’état.
                </li>
              </ul>
            ),
          }}
          actions={
            <>
              <button type="button" className="sn-btn" onClick={() => void charger()} disabled={chargement}>
                <RefreshCw className={chargement ? 'sn-spin' : ''} aria-hidden="true" /> Actualiser
              </button>
              {!isMine && <button
                type="button" className="sn-btn sn-btn--primary"
                onClick={() => navigate('/requisitions/nouvelle')}
              >
                <Plus aria-hidden="true" /> Nouvelle réquisition
              </button>}
            </>
          }
        />

        {erreur && <Note tone="danger" icon={AlertTriangle}>{erreur}</Note>}

        <StatGrid
          sober
          ariaLabel="Cumuls des réquisitions"
          items={[
            {
              label: 'Réquisitions enregistrées',
              value: formaterNombre(cumuls.total),
              icon: Gavel,
              tone: 'neutral',
            },
            {
              label: 'En cours de traitement',
              value: formaterNombre(cumuls.enCours),
              icon: Scale,
              tone: cumuls.enCours > 0 ? 'blue' : 'neutral',
            },
            {
              label: 'Régime à qualifier',
              value: formaterNombre(cumuls.aQualifier),
              icon: AlertTriangle,
              tone: cumuls.aQualifier > 0 ? 'red' : 'neutral',
              onClick: cumuls.aQualifier > 0
                ? () => { retirerFiltres(); setFiltreRegime('a_qualifier'); }
                : undefined,
            },
            {
              label: 'À notifier',
              value: formaterNombre(cumuls.aNotifier),
              icon: Send,
              tone: cumuls.aNotifier > 0 ? 'gold' : 'neutral',
              onClick: cumuls.aNotifier > 0
                ? () => { retirerFiltres(); setFiltreStatut('autorisee'); }
                : undefined,
            },
            {
              label: 'Enlèvement à conduire',
              value: formaterNombre(cumuls.aEnlever),
              icon: Truck,
              tone: cumuls.aEnlever > 0 ? 'gold' : 'neutral',
            },
          ]}
        />

        {!isMine && cumuls.aQualifier > 0 && (
          <Note tone="danger" icon={AlertTriangle}>
            {formaterNombre(cumuls.aQualifier)} réquisition(s) portent un régime juridique non
            qualifié. Elles ne peuvent être ni autorisées, ni rendues exécutoires tant que le
            fondement n’est pas établi.
          </Note>
        )}

        <Section
          id="registre"
          icon={Gavel}
          title="Registre des réquisitions"
          description="Chaque ligne mène au dossier complet, de l’acte juridique au paiement."
        >
          <div className="contrats-filtres">
            <label className="sn-field">
              <span className="sn-field__label">État</span>
              <select value={filtreStatut} onChange={(evenement) => setFiltreStatut(evenement.target.value)}>
                <option value="all">Tous les états</option>
                {(Object.keys(LIBELLES_STATUT_REQUISITION) as StatutRequisition[]).map((statut) => (
                  <option key={statut} value={statut}>{LIBELLES_STATUT_REQUISITION[statut]}</option>
                ))}
              </select>
            </label>
            <label className="sn-field">
              <span className="sn-field__label">Régime juridique</span>
              <select value={filtreRegime} onChange={(evenement) => setFiltreRegime(evenement.target.value)}>
                <option value="all">Tous les régimes</option>
                {(Object.keys(LIBELLES_REGIME) as RegimeJuridique[]).map((regime) => (
                  <option key={regime} value={regime}>{LIBELLES_REGIME[regime]}</option>
                ))}
              </select>
            </label>
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
            <p className="production-page__loading">Chargement des réquisitions…</p>
          ) : requisitions.length === 0 ? (
            <EmptyState
              title={filtre ? 'Aucune réquisition ne correspond' : 'Aucune réquisition enregistrée'}
              description={
                filtre && cumuls.total > 0
                  ? `${cumuls.total} réquisition(s) existent sous d’autres critères.`
                  : isMine
                    ? 'Aucune réquisition ne vous a encore été notifiée par la SONASP.'
                    : 'Une réquisition porte sur tout ou partie de la production d’une mine et se fonde sur un acte juridique habilitant, versé au dossier.'
              }
              action={filtre ? (
                <button type="button" className="sn-btn" onClick={retirerFiltres}>
                  Retirer les filtres
                </button>
              ) : isMine ? undefined : (
                <button
                  type="button" className="sn-btn sn-btn--primary"
                  onClick={() => navigate('/requisitions/nouvelle')}
                >
                  <Plus aria-hidden="true" /> Préparer une réquisition
                </button>
              )}
            />
          ) : (
            <div className="sn-table-wrap">
              <table className="sn-table requisitions-table">
                <thead>
                  <tr>
                    <th scope="col">Référence</th>
                    <th scope="col">Mine</th>
                    <th scope="col">Portée</th>
                    <th scope="col">Régime</th>
                    <th scope="col">Acte</th>
                    <th scope="col" className="sn-table__num">Quantité</th>
                    <th scope="col">État</th>
                  </tr>
                </thead>
                <tbody>
                  {requisitions.map((piece) => (
                    <tr
                      key={piece.id}
                      className="is-clickable"
                      onClick={() => navigate(`/requisitions/${piece.id}`)}
                    >
                      <td>
                        <strong>{piece.reference}</strong>
                        <small className="contrats-table__sous">{piece.objet}</small>
                      </td>
                      <td>{piece.mining_company?.name || 'Site non rattaché'}</td>
                      <td>{LIBELLES_TYPE_REQUISITION[piece.type_requisition]}</td>
                      <td>
                        <Badge
                          tone={piece.regime_juridique === 'a_qualifier' ? 'danger'
                            : piece.regime_juridique === 'accord_requis' ? 'warning' : 'info'}
                        >
                          {piece.regime_juridique === 'a_qualifier' ? 'À qualifier'
                            : piece.regime_juridique === 'accord_requis' ? 'Accord requis'
                              : 'Exécutoire'}
                        </Badge>
                      </td>
                      <td>
                        {piece.reference_acte || '—'}
                        {piece.date_signature_acte && (
                          <small className="contrats-table__sous">
                            {formaterDate(piece.date_signature_acte)}
                          </small>
                        )}
                      </td>
                      <td className="sn-table__num">
                        {piece.type_requisition === 'pourcentage'
                          ? `${piece.pourcentage_production} %`
                          : formaterQuantite(piece.quantite_oz, piece.unite)}
                      </td>
                      <td>
                        <Badge tone={TONS_STATUT_REQUISITION[piece.statut]}>
                          {LIBELLES_STATUT_REQUISITION[piece.statut]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5}>{formaterNombre(requisitions.length)} réquisition(s)</td>
                    <td className="sn-table__num">
                      {formaterQuantite(requisitions.reduce(
                        (somme, piece) => somme + Number(piece.quantite_oz || 0), 0
                      ))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Section>
      </div>
    </NationalDashboardLayout>
  );
}

export default RequisitionsPage;
