import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Download, Eye, FileUp, Paperclip, Trash2,
} from 'lucide-react';
import { Badge, EmptyState, Note, Section } from '@/components/ui/sn';
import { errorMessage } from '@/lib/errorMessage';
import { supabase } from '@/lib/supabase';
import { LIBELLES_CATEGORIE_DOC, type CategorieDocument } from '@/services/contratsService';
import {
  piecesContractuellesService,
  TAILLE_MAX_OCTETS,
  validerPiece,
} from '@/services/piecesContractuellesService';
import './pieces-contractuelles.css';

/**
 * Versement et consultation des pièces d'un dossier contractuel.
 *
 * ══ CE QUE CE BLOC GARANTIT ══
 *
 * Le dépôt est privé : une pièce ne se consulte que par une URL signée, valable
 * une heure, et chaque ouverture est consignée dans `snp_documents_acces`.
 *
 * Verser une pièce sous un intitulé déjà pris n'écrase rien : la version monte
 * d'un cran et la précédente devient une archive. Un dossier contractuel doit
 * pouvoir montrer ce qu'il contenait à une date donnée.
 *
 * Une pièce ne s'efface pas : elle se retire avec son motif.
 */

const CATEGORIES_REQUISITION = [
  'acte_juridique', 'notification', 'accuse_reception', 'reponse_mine', 'contestation',
  'proces_verbal', 'pesee', 'analyse', 'transport', 'photo', 'facture', 'paiement', 'autre',
] as const;

const LIBELLES_CATEGORIE_REQUISITION: Record<(typeof CATEGORIES_REQUISITION)[number], string> = {
  acte_juridique: 'Acte juridique habilitant',
  notification: 'Notification',
  accuse_reception: 'Accusé de réception',
  reponse_mine: 'Réponse de la mine',
  contestation: 'Contestation',
  proces_verbal: 'Procès-verbal',
  pesee: 'Bordereau de pesée',
  analyse: 'Rapport d’analyse',
  transport: 'Document de transport',
  photo: 'Photographie',
  facture: 'Facture',
  paiement: 'Preuve de paiement',
  autre: 'Autre pièce',
};

const formaterDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const date = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('fr-FR');
};

/** Poids d'un fichier, dans l'unité qui se lit. */
export const formaterTaille = (octets: number | null | undefined) => {
  if (!octets) return '—';
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
};

interface PieceAffichee {
  id: string;
  categorie: string;
  intitule: string;
  version: number;
  chemin: string;
  type_mime: string | null;
  taille_octets: number | null;
  date_document: string | null;
  date_expiration?: string | null;
  statut: string;
  observations: string | null;
  created_at: string;
}

interface Props {
  domaine: 'contrat' | 'requisition';
  objetId: string;
  /** Catégorie exigée par l'étape en cours, mise en avant à l'ouverture. */
  categorieAttendue?: string;
  modifiable?: boolean;
}

export function PiecesContractuelles({
  domaine, objetId, categorieAttendue, modifiable = true,
}: Props) {
  const [pieces, setPieces] = useState<PieceAffichee[]>([]);
  const [chargement, setChargement] = useState(true);
  const [action, setAction] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const champFichier = useRef<HTMLInputElement>(null);
  const [versement, setVersement] = useState<{
    categorie: string; intitule: string; dateDocument: string; dateExpiration: string;
    fichier: File | null;
  } | null>(null);
  const [retrait, setRetrait] = useState<{ id: string; intitule: string; motif: string } | null>(null);

  const table = domaine === 'contrat' ? 'snp_contrats_documents' : 'snp_requisitions_documents';
  const cle = domaine === 'contrat' ? 'contrat_id' : 'requisition_id';

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq(cle, objetId)
        .neq('statut', 'supprime')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPieces((data || []) as PieceAffichee[]);
    } catch (raison) {
      setErreur(errorMessage(raison, 'Impossible de charger les pièces du dossier.'));
    } finally {
      setChargement(false);
    }
  }, [table, cle, objetId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const executer = async (nom: string, operation: () => Promise<string>) => {
    setAction(nom);
    setErreur(null);
    setMessage(null);
    try {
      setMessage(await operation());
      await charger();
    } catch (raison) {
      setErreur(errorMessage(raison, 'L’opération a échoué.'));
    } finally {
      setAction(null);
    }
  };

  const verser = () =>
    executer('verser', async () => {
      if (!versement?.fichier) throw new Error('Choisissez un fichier à verser.');
      if (!versement.intitule.trim()) throw new Error('Nommez la pièce.');
      const piece = await piecesContractuellesService.verser({
        domaine,
        objetId,
        categorie: versement.categorie,
        intitule: versement.intitule.trim(),
        fichier: versement.fichier,
        dateDocument: versement.dateDocument || null,
        dateExpiration: versement.dateExpiration || null,
      });
      setVersement(null);
      if (champFichier.current) champFichier.current.value = '';
      const version = (piece as { version?: number })?.version ?? 1;
      return version > 1
        ? `Pièce versée en version ${version}. La précédente est conservée comme archive.`
        : 'Pièce versée au dossier.';
    });

  const consulter = (piece: PieceAffichee, action: 'consultation' | 'telechargement') =>
    executer(`voir-${piece.id}`, async () => {
      const url = await piecesContractuellesService.consulter({
        domaine, chemin: piece.chemin, documentId: piece.id, objetId, action,
      });
      if (!url) throw new Error('Le lien de consultation n’a pas pu être produit.');
      window.open(url, '_blank', 'noopener,noreferrer');
      return action === 'telechargement'
        ? 'Téléchargement ouvert. L’accès est consigné au journal.'
        : 'Pièce ouverte. L’accès est consigné au journal.';
    });

  const retirerPiece = () =>
    executer('retirer', async () => {
      if (!retrait) throw new Error('Rien à retirer.');
      await piecesContractuellesService.retirer({
        domaine, documentId: retrait.id, motif: retrait.motif,
      });
      setRetrait(null);
      return 'Pièce retirée du dossier. Son motif reste attaché.';
    });

  const libelle = (categorie: string) =>
    domaine === 'contrat'
      ? LIBELLES_CATEGORIE_DOC[categorie as CategorieDocument] ?? categorie
      : LIBELLES_CATEGORIE_REQUISITION[categorie as keyof typeof LIBELLES_CATEGORIE_REQUISITION]
        ?? categorie;

  const categories = domaine === 'contrat'
    ? (Object.keys(LIBELLES_CATEGORIE_DOC) as string[])
    : ([...CATEGORIES_REQUISITION] as string[]);

  return (
    <Section
      id="pieces"
      icon={Paperclip}
      title={`Pièces du dossier (${pieces.length})`}
      description="Contrat signé, actes, annexes et justificatifs, versés au dépôt sécurisé."
      info={{
        titre: 'Ce que devient une pièce versée deux fois',
        contenu:
          'Verser une pièce sous un intitulé déjà pris n’écrase rien : la version monte d’un cran et la précédente devient une archive. Un dossier contractuel doit pouvoir montrer ce qu’il contenait à une date donnée. Chaque consultation est consignée avec son auteur.',
      }}
    >
      {erreur && <Note tone="danger" icon={AlertTriangle}>{erreur}</Note>}
      {message && !erreur && <Note icon={CheckCircle2}>{message}</Note>}

      {modifiable && (
        <div className="pieces__gestes">
          <button
            type="button" className="sn-btn"
            onClick={() => setVersement({
              categorie: categorieAttendue ?? categories[0],
              intitule: '', dateDocument: '', dateExpiration: '', fichier: null,
            })}
            disabled={action !== null}
          >
            <FileUp aria-hidden="true" /> Verser une pièce
          </button>
        </div>
      )}

      {versement && (
        <div className="pieces__formulaire">
          <div className="pieces__champs">
            <label className="sn-field">
              <span className="sn-field__label">Catégorie</span>
              <select
                value={versement.categorie}
                onChange={(evenement) =>
                  setVersement({ ...versement, categorie: evenement.target.value })}
              >
                {categories.map((categorie) => (
                  <option key={categorie} value={categorie}>{libelle(categorie)}</option>
                ))}
              </select>
            </label>
            <label className="sn-field">
              <span className="sn-field__label">Intitulé de la pièce</span>
              <input
                value={versement.intitule}
                onChange={(evenement) =>
                  setVersement({ ...versement, intitule: evenement.target.value })}
                placeholder="Contrat signé du 20 août 2026"
              />
            </label>
            <label className="sn-field">
              <span className="sn-field__label">Date du document</span>
              <input
                type="date" value={versement.dateDocument}
                onChange={(evenement) =>
                  setVersement({ ...versement, dateDocument: evenement.target.value })}
              />
            </label>
            {domaine === 'contrat' && (
              <label className="sn-field">
                <span className="sn-field__label">Expire le</span>
                <input
                  type="date" value={versement.dateExpiration}
                  onChange={(evenement) =>
                    setVersement({ ...versement, dateExpiration: evenement.target.value })}
                />
              </label>
            )}
            <label className="sn-field is-large">
              <span className="sn-field__label">Fichier</span>
              <input
                ref={champFichier}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.tif,.tiff,.doc,.docx,.xls,.xlsx"
                onChange={(evenement) => {
                  const fichier = evenement.target.files?.[0] ?? null;
                  if (fichier) {
                    const refus = validerPiece(fichier);
                    if (refus) {
                      setErreur(refus);
                      evenement.target.value = '';
                      setVersement({ ...versement, fichier: null });
                      return;
                    }
                  }
                  setErreur(null);
                  setVersement({ ...versement, fichier });
                }}
              />
              <small>
                PDF, image ou document bureautique, jusqu’à{' '}
                {Math.round(TAILLE_MAX_OCTETS / (1024 * 1024))} Mo.
                {versement.fichier && ` Choisi : ${versement.fichier.name} (${formaterTaille(versement.fichier.size)}).`}
              </small>
            </label>
          </div>
          <div className="pieces__boutons">
            <button
              type="button" className="sn-btn"
              onClick={() => {
                setVersement(null);
                if (champFichier.current) champFichier.current.value = '';
              }}
            >
              Renoncer
            </button>
            <button
              type="button" className="sn-btn sn-btn--primary"
              onClick={() => void verser()}
              disabled={action !== null || !versement.fichier || !versement.intitule.trim()}
            >
              {action === 'verser' ? 'Versement…' : 'Verser au dossier'}
            </button>
          </div>
        </div>
      )}

      {chargement ? (
        <p className="production-page__loading">Chargement des pièces…</p>
      ) : pieces.length === 0 ? (
        <EmptyState
          title="Aucune pièce versée"
          description={domaine === 'contrat'
            ? 'Le contrat signé est exigé pour l’activation.'
            : 'L’acte juridique habilitant est exigé pour l’autorisation.'}
        />
      ) : (
        <div className="sn-table-wrap">
          <table className="sn-table pieces__table">
            <thead>
              <tr>
                <th scope="col">Pièce</th>
                <th scope="col">Catégorie</th>
                <th scope="col" className="sn-table__num">Version</th>
                <th scope="col" className="sn-table__num">Poids</th>
                <th scope="col">Date</th>
                <th scope="col">État</th>
                <th scope="col" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {pieces.map((piece) => (
                <tr key={piece.id}>
                  <td><strong>{piece.intitule}</strong></td>
                  <td>{libelle(piece.categorie)}</td>
                  <td className="sn-table__num">{piece.version}</td>
                  <td className="sn-table__num">{formaterTaille(piece.taille_octets)}</td>
                  <td>{formaterDate(piece.date_document)}</td>
                  <td>
                    <Badge tone={piece.statut === 'actif' ? 'success' : 'neutral'}>
                      {piece.statut === 'actif' ? 'En vigueur' : 'Archivée'}
                    </Badge>
                  </td>
                  <td>
                    <div className="pieces__actions">
                      <button
                        type="button" className="sn-btn"
                        onClick={() => void consulter(piece, 'consultation')}
                        disabled={action !== null}
                        aria-label={`Consulter ${piece.intitule}`}
                      >
                        <Eye aria-hidden="true" />
                      </button>
                      <button
                        type="button" className="sn-btn"
                        onClick={() => void consulter(piece, 'telechargement')}
                        disabled={action !== null}
                        aria-label={`Télécharger ${piece.intitule}`}
                      >
                        <Download aria-hidden="true" />
                      </button>
                      {modifiable && piece.statut === 'actif' && (
                        <button
                          type="button" className="sn-btn"
                          onClick={() => setRetrait({
                            id: piece.id, intitule: piece.intitule, motif: '',
                          })}
                          disabled={action !== null}
                          aria-label={`Retirer ${piece.intitule}`}
                        >
                          <Trash2 aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {retrait && (
        <div className="pieces__formulaire is-retrait">
          <h4>Retirer « {retrait.intitule} » du dossier</h4>
          <p>
            La pièce ne s’efface pas : elle sort du dossier et son motif y reste attaché.
          </p>
          <textarea
            rows={3} value={retrait.motif}
            onChange={(evenement) => setRetrait({ ...retrait, motif: evenement.target.value })}
            placeholder="Raison du retrait"
          />
          <div className="pieces__boutons">
            <button type="button" className="sn-btn" onClick={() => setRetrait(null)}>
              Renoncer
            </button>
            <button
              type="button" className="sn-btn sn-btn--primary"
              onClick={() => void retirerPiece()}
              disabled={action !== null || retrait.motif.trim().length < 5}
            >
              Retirer
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}

export default PiecesContractuelles;
