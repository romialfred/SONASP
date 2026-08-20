import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSignature, RefreshCw, Send, XCircle } from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, EmptyState, Note, PageHeader, Section, StatGrid } from '@/components/ui/sn';
import { errorMessage } from '@/lib/errorMessage';
import {
  achatsIndustrielsService,
  LIBELLES_STATUT_DEMANDE,
  type DemandeAchat,
  type Societe,
  type StatutDemande,
} from '@/services/achatsIndustrielsService';
import { francs, onces } from './PlansAchatPage';
import './achats.css';

/**
 * Demandes d'achat adressées aux sociétés minières.
 *
 * L'écran sert les deux côtés du circuit. Ce qu'un utilisateur voit ne dépend
 * pas d'un filtre écrit ici : les politiques RLS ne renvoient à un représentant
 * de mine que les demandes de sa société, et jamais celles restées en brouillon.
 * Le masquage des boutons n'est qu'un confort de lecture — l'habilitation est
 * vérifiée par la fonction appelée.
 */

const entier = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TONS: Record<StatutDemande, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  brouillon: 'neutral',
  validee_interne: 'info',
  soumise: 'warning',
  approuvee: 'success',
  rejetee: 'danger',
  modification_demandee: 'info',
  expiree: 'neutral',
  annulee: 'danger',
};

const ETAPES: Array<{ cle: string; libelle: string }> = [
  { cle: 'brouillon', libelle: 'Préparée' },
  { cle: 'soumise', libelle: 'Transmise à la mine' },
  { cle: 'approuvee', libelle: 'Réponse de la mine' },
  { cle: 'facturee', libelle: 'Facture émise' },
];

export const formaterDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const date = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('fr-FR');
};

export function DemandesAchatPage() {
  const [demandes, setDemandes] = useState<DemandeAchat[]>([]);
  const [societes, setSocietes] = useState<Societe[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [action, setAction] = useState<string | null>(null);

  const [filtreStatut, setFiltreStatut] = useState('soumise');
  const [filtreSociete, setFiltreSociete] = useState('all');

  const [reponse, setReponse] = useState<{
    demande: DemandeAchat;
    decision: 'rejetee' | 'modification_demandee';
    motif: string;
  } | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const [liste, societesChargees] = await Promise.all([
        achatsIndustrielsService.listerDemandes({ statut: filtreStatut, societe: filtreSociete }),
        achatsIndustrielsService.societesProductrices(),
      ]);
      setDemandes(liste);
      setSocietes(societesChargees);
    } catch (raison) {
      setErreur(errorMessage(raison, 'Impossible de charger les demandes d’achat.'));
      setDemandes([]);
    } finally {
      setChargement(false);
    }
  }, [filtreStatut, filtreSociete]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const cumuls = useMemo(() => ({
    total: demandes.length,
    quantite: demandes.reduce((somme, demande) => somme + Number(demande.quantite_demandee_oz || 0), 0),
    montant: demandes.reduce((somme, demande) => somme + Number(demande.montant_estime_fcfa || 0), 0),
    enAttente: demandes.filter((demande) => demande.statut === 'soumise').length,
  }), [demandes]);

  const repondre = async (
    demande: DemandeAchat,
    decision: 'approuvee' | 'rejetee' | 'modification_demandee',
    motif?: string
  ) => {
    setAction(demande.id);
    setErreur(null);
    setMessage(null);
    try {
      const resultat = await achatsIndustrielsService.repondreDemande(demande.id, decision, motif);
      setMessage(
        decision === 'approuvee'
          ? `Demande ${demande.numero_demande} approuvée. Facture ${resultat?.r_numero_facture ?? '—'} émise.`
          : `Réponse enregistrée pour la demande ${demande.numero_demande}.`
      );
      setReponse(null);
      await charger();
    } catch (raison) {
      setErreur(errorMessage(raison, 'La réponse n’a pas pu être enregistrée.'));
    } finally {
      setAction(null);
    }
  };

  const etapeCourante = (demande: DemandeAchat) => {
    if (['approuvee'].includes(demande.statut)) return 3;
    if (['rejetee', 'modification_demandee', 'expiree', 'annulee'].includes(demande.statut)) return 2;
    if (demande.statut === 'soumise') return 1;
    return 0;
  };

  return (
    <NationalDashboardLayout>
      <div className="sn-page achats-page">
        <PageHeader
          icon={FileSignature}
          title="Demandes d’achat"
          subtitle="Propositions adressées aux sociétés minières, et leurs réponses."
          breadcrumb={[{ label: 'Achats industriels' }, { label: 'Demandes' }]}
          info={{
            titre: 'Ce que voit chaque partie',
            contenu:
              'Une société minière ne reçoit que les demandes qui la concernent, et jamais celles restées en brouillon.',
          }}
          actions={
            <button type="button" className="sn-btn" onClick={() => void charger()} disabled={chargement}>
              <RefreshCw className={chargement ? 'sn-spin' : ''} aria-hidden="true" /> Actualiser
            </button>
          }
        />

        {erreur && <Note tone="danger" icon={AlertTriangle}>{erreur}</Note>}
        {message && !erreur && <Note icon={CheckCircle2}>{message}</Note>}

        <StatGrid
          sober
          ariaLabel="Cumuls des demandes"
          items={[
            { label: 'Demandes', value: entier.format(cumuls.total), icon: FileSignature, tone: 'neutral' },
            { label: 'En attente de réponse', value: entier.format(cumuls.enAttente), icon: Send, tone: 'gold' },
            { label: 'Quantité demandée', value: onces(cumuls.quantite), icon: FileSignature, tone: 'gold' },
            { label: 'Montant estimé', value: francs(cumuls.montant), icon: FileSignature, tone: 'neutral' },
          ]}
        />

        <Section
          id="demandes"
          icon={FileSignature}
          title="Suivi des demandes"
          description="Filtrez par état ou par société pour retrouver un dossier."
        >
          <div className="sn-grid sn-grid--3" style={{ marginBottom: 14 }}>
            <label className="sn-field">
              <span className="sn-field__label">État</span>
              <select value={filtreStatut} onChange={(evenement) => setFiltreStatut(evenement.target.value)}>
                <option value="all">Tous les états</option>
                {(Object.keys(LIBELLES_STATUT_DEMANDE) as StatutDemande[]).map((statut) => (
                  <option key={statut} value={statut}>{LIBELLES_STATUT_DEMANDE[statut]}</option>
                ))}
              </select>
            </label>
            <label className="sn-field">
              <span className="sn-field__label">Société minière</span>
              <select value={filtreSociete} onChange={(evenement) => setFiltreSociete(evenement.target.value)}>
                <option value="all">Toutes les sociétés</option>
                {societes.map((societe) => (
                  <option key={societe.id} value={societe.id}>{societe.name}</option>
                ))}
              </select>
            </label>
          </div>

          {chargement ? (
            <p className="production-page__loading">Chargement des demandes…</p>
          ) : demandes.length === 0 ? (
            <EmptyState
              title="Aucune demande"
              description="Aucune demande ne correspond aux critères retenus."
            />
          ) : (
            <div className="sn-table-wrap">
              <table className="sn-table">
                <thead>
                  <tr>
                    <th scope="col">Demande</th>
                    <th scope="col">Société</th>
                    <th scope="col">Période</th>
                    <th scope="col" className="is-right">Quantité</th>
                    <th scope="col" className="is-right">Prix / oz</th>
                    <th scope="col" className="is-right">Montant estimé</th>
                    <th scope="col">Échéance de réponse</th>
                    <th scope="col">État</th>
                    <th scope="col">Réponse</th>
                  </tr>
                </thead>
                <tbody>
                  {demandes.map((demande) => (
                    <tr key={demande.id}>
                      <td>
                        <strong>{demande.numero_demande}</strong>
                        <ul className="achats-fil" style={{ marginTop: 6 }}>
                          {ETAPES.map((etape, index) => (
                            <li
                              key={etape.cle}
                              className={
                                index < etapeCourante(demande) ? 'est-faite'
                                  : index === etapeCourante(demande)
                                    ? (['rejetee', 'annulee', 'expiree'].includes(demande.statut)
                                        ? 'est-bloquee' : 'est-courante')
                                    : undefined
                              }
                            >
                              {etape.libelle}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td>{demande.mining_company?.name || '—'}</td>
                      <td>{formaterDate(demande.periode_debut)} → {formaterDate(demande.periode_fin)}</td>
                      <td className="is-right">{decimal.format(Number(demande.quantite_demandee_oz))} oz</td>
                      <td className="is-right">{entier.format(Number(demande.prix_once_fcfa))}</td>
                      <td className="is-right">{francs(demande.montant_estime_fcfa)}</td>
                      <td>{formaterDate(demande.date_limite_reponse)}</td>
                      <td>
                        <Badge tone={TONS[demande.statut]}>{LIBELLES_STATUT_DEMANDE[demande.statut]}</Badge>
                        {demande.motif_rejet && (
                          <span className="achats-erreur-ligne">{demande.motif_rejet}</span>
                        )}
                        {demande.motif_modification && (
                          <span className="achats-erreur-ligne">{demande.motif_modification}</span>
                        )}
                      </td>
                      <td>
                        {demande.statut === 'soumise' ? (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button
                              type="button" className="sn-btn sn-btn--primary"
                              style={{ height: 28, fontSize: 11 }}
                              onClick={() => void repondre(demande, 'approuvee')}
                              disabled={action !== null}
                            >
                              <CheckCircle2 aria-hidden="true" /> Approuver
                            </button>
                            <button
                              type="button" className="sn-btn sn-btn--danger"
                              style={{ height: 28, fontSize: 11 }}
                              onClick={() => setReponse({ demande, decision: 'rejetee', motif: '' })}
                              disabled={action !== null}
                            >
                              <XCircle aria-hidden="true" /> Rejeter
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11.5, color: 'var(--sn-muted)' }}>
                            {formaterDate(demande.date_reponse)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {reponse && (
          <div className="achats-fenetre" role="dialog" aria-modal="true" aria-label="Motiver la réponse">
            <div className="achats-fenetre__voile" aria-hidden="true" onClick={() => setReponse(null)} />
            <div className="achats-fenetre__panneau">
              <header>
                <h3><XCircle aria-hidden="true" /> Rejeter la demande {reponse.demande.numero_demande}</h3>
                <button type="button" aria-label="Fermer" onClick={() => setReponse(null)}>
                  <XCircle aria-hidden="true" />
                </button>
              </header>

              <div className="achats-fenetre__corps">
                <Note tone="info" icon={AlertTriangle}>
                  Un rejet sans motif ne se discute pas : il se refuse. Le motif est transmis à la SONASP et
                  conservé à l’historique.
                </Note>
                <label className="sn-field sn-field--wide">
                  <span className="sn-field__label">Motif du rejet</span>
                  <textarea
                    rows={4} value={reponse.motif}
                    placeholder="Stock déjà engagé, prix inférieur au cours, période incorrecte…"
                    onChange={(evenement) => setReponse((r) => (r ? { ...r, motif: evenement.target.value } : r))}
                  />
                </label>
              </div>

              <footer>
                <button type="button" className="sn-btn" onClick={() => setReponse(null)}>Annuler</button>
                <button
                  type="button" className="sn-btn sn-btn--danger"
                  disabled={reponse.motif.trim().length < 5 || action !== null}
                  onClick={() => void repondre(reponse.demande, reponse.decision, reponse.motif)}
                >
                  Confirmer le rejet
                </button>
              </footer>
            </div>
          </div>
        )}
      </div>
    </NationalDashboardLayout>
  );
}

export default DemandesAchatPage;
