import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, FolderOpen } from 'lucide-react';
import { Badge, EmptyState, Note, Section, Segmented, type BadgeTone } from '@/components/ui/sn';
import { errorMessage } from '@/lib/errorMessage';
import {
  ETAPES_DOSSIER, LIBELLES_ETAPES, dossierService,
  type DocumentDossier, type DossierComplet as Dossier,
  type EtapeDossier, type EvenementDossier, type TypeDossier,
} from '@/services/dossierService';
import './dossier.css';

/**
 * Le dossier complet d'un maillon de la chaîne : la chaîne elle-même, la
 * chronologie de chaque étape, les documents organisés par étape, et le suivi
 * des comptes. Le serveur assemble sous la RLS de l'appelant : une étape hors
 * périmètre revient vide, et la section le dit plutôt que de la taire.
 */

const ETAPE_PAR_ANCRE: Record<TypeDossier, EtapeDossier> = {
  production: 'production',
  requisition: 'enlevement',
  achat: 'vente_locale',
  expedition: 'expedition',
  analyse: 'analyse',
  conciliation: 'conciliation',
  vente: 'vente',
  paiement: 'paiement',
};

type Volet = 'chronologie' | 'documents' | 'comptes';

function dateCourte(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

function montant(valeur: number | null | undefined, devise = 'USD'): string {
  if (valeur === null || valeur === undefined) return '—';
  return `${valeur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${devise}`;
}

function taille(octets: number | null | undefined): string | null {
  if (!octets || octets <= 0) return null;
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

const TON_STATUT: Record<string, BadgeTone> = {
  validee: 'success', approved: 'success', completed: 'success', executee: 'success',
  emise: 'info', en_attente: 'warning', pending: 'warning', en_attente_analyse: 'warning',
  annulee: 'neutral', cancelled: 'neutral', rejected: 'danger', rejetee: 'danger',
};

function tonStatut(statut: string | null | undefined): BadgeTone {
  return (statut && TON_STATUT[statut]) || 'neutral';
}

export function DossierComplet({ type, id }: { type: TypeDossier; id: string }) {
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [volet, setVolet] = useState<Volet>('chronologie');
  const [ouvertureEnCours, setOuvertureEnCours] = useState<string | null>(null);
  const [erreurDocument, setErreurDocument] = useState<string | null>(null);

  useEffect(() => {
    let actif = true;
    setChargement(true);
    setErreur(null);
    dossierService.charger(type, id)
      .then((resultat) => { if (actif) setDossier(resultat); })
      .catch((raison) => {
        if (actif) setErreur(errorMessage(raison, 'Le dossier complet n’a pas pu être chargé.'));
      })
      .finally(() => { if (actif) setChargement(false); });
    return () => { actif = false; };
  }, [type, id]);

  const etapeCourante = ETAPE_PAR_ANCRE[type];

  /** Les maillons présents dans la chaîne, dans l'ordre du workflow. */
  const maillons = useMemo(() => {
    const c = dossier?.chaine;
    if (!c) return [];
    const liste: Array<{ etape: EtapeDossier; reference: string | null; statut: string | null }> = [];
    if (c.productions?.length) {
      liste.push({
        etape: 'production',
        reference: c.productions.length === 1
          ? (c.productions[0].reference as string | null)
          : `${c.productions.length} lots`,
        statut: c.productions.length === 1 ? (c.productions[0].statut as string | null) : null,
      });
    }
    if (c.requisition) liste.push({ etape: 'enlevement', reference: c.requisition.reference ?? null, statut: c.requisition.statut ?? null });
    if (c.achats?.length) {
      liste.push({
        etape: 'vente_locale',
        reference: c.achats.length === 1 ? (c.achats[0].reference as string | null) : `${c.achats.length} achats`,
        statut: c.achats.length === 1 ? (c.achats[0].statut as string | null) : null,
      });
    }
    if (c.expeditions?.length) {
      liste.push({
        etape: 'expedition',
        reference: c.expeditions.length === 1 ? (c.expeditions[0].reference as string | null) : `${c.expeditions.length} expéditions`,
        statut: c.expeditions.length === 1 ? (c.expeditions[0].statut as string | null) : null,
      });
    }
    if (c.analyses?.length) {
      liste.push({
        etape: 'analyse',
        reference: c.analyses.length === 1 ? (c.analyses[0].reference as string | null) : `${c.analyses.length} certificats`,
        statut: c.analyses.length === 1 ? (c.analyses[0].statut as string | null) : null,
      });
    }
    if (c.conciliation) liste.push({ etape: 'conciliation', reference: c.conciliation.reference ?? null, statut: c.conciliation.statut ?? null });
    if (c.vente) liste.push({ etape: 'vente', reference: c.vente.reference ?? null, statut: c.vente.statut ?? null });
    if (c.paiements?.length) {
      liste.push({ etape: 'paiement', reference: `${c.paiements.length} paiement${c.paiements.length > 1 ? 's' : ''}`, statut: null });
    }
    return liste;
  }, [dossier]);

  const evenementsParEtape = useMemo(() => {
    const groupes = new Map<EtapeDossier, EvenementDossier[]>();
    (dossier?.chronologie ?? []).forEach((evenement) => {
      const liste = groupes.get(evenement.etape) ?? [];
      liste.push(evenement);
      groupes.set(evenement.etape, liste);
    });
    return ETAPES_DOSSIER.filter((etape) => groupes.has(etape))
      .map((etape) => ({ etape, evenements: groupes.get(etape) as EvenementDossier[] }));
  }, [dossier]);

  const documentsParEtape = useMemo(() => {
    const groupes = new Map<EtapeDossier, DocumentDossier[]>();
    (dossier?.documents ?? []).forEach((document) => {
      const liste = groupes.get(document.etape) ?? [];
      liste.push(document);
      groupes.set(document.etape, liste);
    });
    return ETAPES_DOSSIER.filter((etape) => groupes.has(etape))
      .map((etape) => ({ etape, documents: groupes.get(etape) as DocumentDossier[] }));
  }, [dossier]);

  const ouvrirDocument = useCallback(async (document: DocumentDossier) => {
    try {
      setOuvertureEnCours(document.id);
      setErreurDocument(null);
      const url = await dossierService.urlPourDocument(document);
      if (!url) {
        setErreurDocument('Cette pièce est une référence sans fichier : elle ne peut pas être ouverte.');
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (raison) {
      setErreurDocument(errorMessage(raison, 'Le document n’a pas pu être ouvert.'));
    } finally {
      setOuvertureEnCours(null);
    }
  }, []);

  const comptes = dossier?.comptes;
  const soldeApresConciliation = useMemo(() => {
    if (!comptes || comptes.montant_vente === undefined) return null;
    const definitif = comptes.montant_vente + (comptes.ecart_conciliation ?? 0);
    return definitif - (comptes.avances_recues ?? 0);
  }, [comptes]);

  return (
    <Section
      id="dossier-complet"
      icon={FolderOpen}
      title="Dossier complet"
      description="La chaîne entière de ce dossier : chronologie, documents et comptes, étape par étape. Chaque acteur ne voit que son périmètre."
    >
      {chargement && <p className="dossier__attente" role="status">Assemblage du dossier…</p>}
      {erreur && <Note tone="danger" icon={AlertTriangle}>{erreur}</Note>}

      {!chargement && !erreur && dossier && (
        <>
          {maillons.length > 0 && (
            <ol className="dossier__chaine" aria-label="Maillons de la chaîne">
              {maillons.map((maillon) => (
                <li
                  key={maillon.etape}
                  className={maillon.etape === etapeCourante ? 'dossier__maillon dossier__maillon--courant' : 'dossier__maillon'}
                >
                  <span className="dossier__maillon-etape">{LIBELLES_ETAPES[maillon.etape]}</span>
                  <span className="dossier__maillon-reference">{maillon.reference ?? '—'}</span>
                  {maillon.statut && <Badge tone={tonStatut(maillon.statut)}>{maillon.statut}</Badge>}
                </li>
              ))}
            </ol>
          )}

          <div className="dossier__volets">
            <Segmented
              name="dossier-volet"
              value={volet}
              onChange={(valeur) => setVolet(valeur as Volet)}
              ariaLabel="Volet du dossier"
              options={[
                { value: 'chronologie', label: `Chronologie (${dossier.chronologie.length})` },
                { value: 'documents', label: `Documents (${dossier.documents.length})` },
                { value: 'comptes', label: 'Comptes' },
              ]}
            />
          </div>

          {volet === 'chronologie' && (
            evenementsParEtape.length === 0 ? (
              <EmptyState
                title="Aucun événement visible"
                description="Aucun événement de la chaîne n’est dans votre périmètre pour ce dossier."
              />
            ) : (
              <div className="dossier__chronologie">
                {evenementsParEtape.map(({ etape, evenements }) => (
                  <div key={etape} className="dossier__groupe">
                    <h4 className="dossier__groupe-titre">{LIBELLES_ETAPES[etape]}</h4>
                    <ol className="dossier__evenements">
                      {evenements.map((evenement, index) => (
                        <li key={`${etape}-${index}`} className="dossier__evenement">
                          <span className="dossier__puce" aria-hidden="true" />
                          <div>
                            <div className="dossier__evenement-entete">
                              <strong>{evenement.titre}</strong>
                              <time dateTime={evenement.date ?? undefined}>{dateCourte(evenement.date)}</time>
                            </div>
                            {evenement.detail && <p className="dossier__evenement-detail">{evenement.detail}</p>}
                            {evenement.acteur && <p className="dossier__evenement-acteur">{evenement.acteur}</p>}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )
          )}

          {volet === 'documents' && (
            <>
              {erreurDocument && <Note tone="danger" icon={AlertTriangle}>{erreurDocument}</Note>}
              {documentsParEtape.length === 0 ? (
                <EmptyState
                  title="Aucun document visible"
                  description="Aucune pièce de la chaîne n’est dans votre périmètre pour ce dossier."
                />
              ) : (
                <div className="dossier__documents">
                  {documentsParEtape.map(({ etape, documents }) => (
                    <div key={etape} className="dossier__groupe">
                      <h4 className="dossier__groupe-titre">{LIBELLES_ETAPES[etape]}</h4>
                      <ul className="dossier__pieces">
                        {documents.map((document) => {
                          const meta = [taille(document.taille), document.date ? dateCourte(document.date) : null]
                            .filter(Boolean).join(' · ');
                          return (
                            <li key={`${document.source}-${document.id}-${document.nom ?? ''}`} className="dossier__piece">
                              <div>
                                <span className="dossier__piece-nom">{document.nom ?? 'Document'}</span>
                                {meta && <span className="dossier__piece-meta">{meta}</span>}
                              </div>
                              {dossierService.estOuvrable(document) ? (
                                <button
                                  type="button"
                                  className="sn-btn"
                                  onClick={() => void ouvrirDocument(document)}
                                  disabled={ouvertureEnCours === document.id}
                                >
                                  <ExternalLink aria-hidden="true" />
                                  {ouvertureEnCours === document.id ? 'Ouverture…' : 'Ouvrir'}
                                </button>
                              ) : (
                                <Badge tone="neutral">référence</Badge>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {volet === 'comptes' && (
            !comptes || comptes.montant_vente === undefined ? (
              <EmptyState
                title="Aucune donnée de compte"
                description="Ce dossier n’est rattaché à aucune vente : il n’y a ni avance ni écart à suivre."
              />
            ) : (
              <div className="dossier__comptes">
                <dl className="dossier__comptes-grille">
                  <div><dt>Montant de la vente</dt><dd>{montant(comptes.montant_vente, comptes.devise)}</dd></div>
                  <div><dt>Avances reçues</dt><dd>{montant(comptes.avances_recues ?? 0, comptes.devise)}</dd></div>
                  {(comptes.engagements_en_attente ?? 0) > 0 && (
                    <div>
                      <dt>Engagements en attente</dt>
                      <dd>{montant(comptes.engagements_en_attente, comptes.devise)}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Écart de conciliation</dt>
                    <dd className={comptes.ecart_conciliation !== undefined && comptes.ecart_conciliation < 0 ? 'dossier__negatif' : undefined}>
                      {comptes.ecart_conciliation === undefined
                        ? 'non conciliée'
                        : montant(comptes.ecart_conciliation, comptes.devise)}
                    </dd>
                  </div>
                  <div>
                    <dt>Solde attendu</dt>
                    <dd>{soldeApresConciliation === null ? '—' : montant(soldeApresConciliation, comptes.devise)}</dd>
                  </div>
                </dl>

                {comptes.taxes && comptes.taxes.length > 0 && (
                  <div className="dossier__taxes">
                    <h4 className="dossier__groupe-titre">Comptes de taxes après conciliation</h4>
                    <ul>
                      {comptes.taxes.map((taxe) => (
                        <li key={`${taxe.code}-${taxe.devise ?? ''}`}>
                          <span>{taxe.code.toUpperCase()}</span>
                          <span>
                            {[
                              taxe.complement_du !== undefined
                                ? `complément dû ${montant(taxe.complement_du, taxe.devise ?? 'XOF')}`
                                : null,
                              taxe.trop_percu !== undefined
                                ? `trop-perçu ${montant(taxe.trop_percu, taxe.devise ?? 'XOF')}`
                                : null,
                            ].filter(Boolean).join(' · ')}
                            {taxe.complement_du !== undefined && taxe.trop_percu !== undefined
                              && ` — net ${montant(taxe.net ?? 0, taxe.devise ?? 'XOF')}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {comptes.avoirs && comptes.avoirs.length > 0 && (
                  <div className="dossier__taxes">
                    <h4 className="dossier__groupe-titre">Avoirs client</h4>
                    <ul>
                      {comptes.avoirs.map((avoir) => (
                        <li key={avoir.reference}>
                          <span>{avoir.reference}</span>
                          <span>{montant(avoir.montant, avoir.devise)} — {avoir.statut}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )
          )}
        </>
      )}
    </Section>
  );
}

export default DossierComplet;
