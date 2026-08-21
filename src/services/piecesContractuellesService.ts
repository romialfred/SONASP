import { supabase } from '@/lib/supabase';
import {
  LIBELLES_CATEGORIE_DOC,
  type CategorieDocument,
  type DocumentContrat,
} from './contratsService';

/**
 * Versement et consultation des pièces contractuelles.
 *
 * ══ CE QUE CE SERVICE GARANTIT ══
 *
 * Le dépôt est privé : rien n'y est lisible sans une URL signée, produite à la
 * demande et valable une heure. Les formats et la taille sont bornés par le
 * dépôt lui-même, non par cet écran — un contrôle côté navigateur se contourne.
 *
 * Une consultation se trace. Le cahier des charges demande la traçabilité des
 * téléchargements sensibles, et une lecture ne se journalise pas par
 * déclencheur : c'est l'ouverture de l'URL signée qui constitue l'accès.
 *
 * Une pièce ne s'efface pas : elle se remplace par une version suivante, ou se
 * marque supprimée avec son motif. L'historique contractuel doit rester entier.
 */

export const DEPOT = 'contrats-documents';

/** Ce que le dépôt accepte. Le contrôle réel est en base ; celui-ci évite un aller-retour. */
export const MIMES_ACCEPTES = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/tiff',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

export const TAILLE_MAX_OCTETS = 25 * 1024 * 1024;

export { LIBELLES_CATEGORIE_DOC };
export type { CategorieDocument, DocumentContrat };

/** Nom de fichier débarrassé de ce qui gêne un chemin de stockage. */
export const nomSecurise = (nom: string) =>
  nom.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.\-]+/g, '_').slice(0, 120);

/**
 * Refus lisible d'un fichier, ou `null` s'il convient.
 * Le message nomme la limite : « trop volumineux » sans le poids admis n'aide
 * personne à recommencer.
 */
export function validerPiece(fichier: File): string | null {
  if (!MIMES_ACCEPTES.includes(fichier.type as (typeof MIMES_ACCEPTES)[number])) {
    return 'Format refusé : versez un PDF, une image, ou un document bureautique.';
  }
  if (fichier.size > TAILLE_MAX_OCTETS) {
    const megaoctets = Math.round(fichier.size / (1024 * 1024));
    return `Fichier de ${megaoctets} Mo : la limite est de 25 Mo.`;
  }
  if (fichier.size === 0) return 'Ce fichier est vide.';
  return null;
}

const lancerSiErreur = <T>({ data, error }: { data: T; error: unknown }): T => {
  if (error) throw error;
  return data;
};

export const piecesContractuellesService = {
  /**
   * Verse une pièce. La version se déduit de ce qui existe déjà sous le même
   * intitulé : verser à nouveau ne remplace pas, il ajoute une version et
   * marque la précédente comme remplacée.
   */
  async verser(entree: {
    domaine: 'contrat' | 'requisition';
    objetId: string;
    categorie: string;
    intitule: string;
    fichier: File;
    dateDocument?: string | null;
    dateExpiration?: string | null;
    observations?: string | null;
  }) {
    const refus = validerPiece(entree.fichier);
    if (refus) throw new Error(refus);

    const table = entree.domaine === 'contrat'
      ? 'snp_contrats_documents' : 'snp_requisitions_documents';
    const cle = entree.domaine === 'contrat' ? 'contrat_id' : 'requisition_id';

    const precedentes = lancerSiErreur(await supabase
      .from(table)
      .select('id, version')
      .eq(cle, entree.objetId)
      .eq('categorie', entree.categorie)
      .eq('intitule', entree.intitule)
      .order('version', { ascending: false })) as Array<{ id: string; version: number }>;

    const version = (precedentes?.[0]?.version ?? 0) + 1;
    const chemin = `${entree.domaine}/${entree.objetId}/${entree.categorie}/v${version}_${nomSecurise(entree.fichier.name)}`;

    const depot = await supabase.storage
      .from(DEPOT)
      .upload(chemin, entree.fichier, { cacheControl: '3600', upsert: false });
    if (depot.error) throw depot.error;

    const { data: utilisateur } = await supabase.auth.getUser();

    const piece = lancerSiErreur(await supabase
      .from(table)
      .insert({
        [cle]: entree.objetId,
        categorie: entree.categorie,
        intitule: entree.intitule,
        version,
        chemin,
        type_mime: entree.fichier.type || null,
        taille_octets: entree.fichier.size,
        date_document: entree.dateDocument || null,
        ...(entree.domaine === 'contrat' ? { date_expiration: entree.dateExpiration || null } : {}),
        observations: entree.observations || null,
        created_by: utilisateur.user?.id ?? null,
      })
      .select()
      .single());

    // La version précédente devient une archive, jamais un rebut.
    if (precedentes?.length) {
      await supabase.from(table).update({ statut: 'remplace' })
        .in('id', precedentes.map((element) => element.id));
    }

    return piece;
  },

  /**
   * URL signée pour consulter une pièce, et la consultation consignée.
   * L'accès se trace avant d'être servi : une trace posée après coup manquerait
   * les accès interrompus.
   */
  async consulter(entree: {
    domaine: 'contrat' | 'requisition' | 'analyse';
    chemin: string;
    documentId?: string | null;
    objetId?: string | null;
    action?: 'consultation' | 'telechargement' | 'impression';
  }): Promise<string | null> {
    await supabase.rpc('snp_tracer_acces_document', {
      p_domaine: entree.domaine,
      p_chemin: entree.chemin,
      p_document_id: entree.documentId ?? null,
      p_objet_id: entree.objetId ?? null,
      p_action: entree.action ?? 'consultation',
    });

    const { data, error } = await supabase.storage.from(DEPOT).createSignedUrl(entree.chemin, 3600);
    if (error) throw error;
    return data?.signedUrl ?? null;
  },

  /** Retire une pièce du dossier sans l'effacer : le motif reste attaché. */
  async retirer(entree: {
    domaine: 'contrat' | 'requisition';
    documentId: string;
    motif: string;
  }) {
    if (!entree.motif || entree.motif.trim().length < 5) {
      throw new Error('Le retrait d’une pièce contractuelle demande un motif.');
    }
    const table = entree.domaine === 'contrat'
      ? 'snp_contrats_documents' : 'snp_requisitions_documents';
    const { data: utilisateur } = await supabase.auth.getUser();

    return lancerSiErreur(await supabase
      .from(table)
      .update({
        statut: 'supprime',
        supprime_le: new Date().toISOString(),
        supprime_par: utilisateur.user?.id ?? null,
        motif_suppression: entree.motif.trim(),
      })
      .eq('id', entree.documentId)
      .select()
      .single());
  },

  /** Journal des accès à une pièce ou à un dossier. Réservé à la direction. */
  async journalAcces(objetId: string) {
    return lancerSiErreur(await supabase
      .from('snp_documents_acces')
      .select('*')
      .eq('objet_id', objetId)
      .order('survenu_le', { ascending: false })
      .limit(100)) || [];
  },
};

export default piecesContractuellesService;
