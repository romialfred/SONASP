import { supabase } from '@/lib/supabase';

/**
 * Notifications de la plateforme.
 *
 * ══ CE QUE CE SERVICE GARANTIT ══
 *
 * Une notification ne s'insère pas depuis le navigateur : la politique
 * d'insertion directe est `false`, et l'émission passe par `snp_notifier`, qui
 * vérifie le destinataire, applique la déduplication et pose la ligne de
 * livraison du canal courriel.
 *
 * Le courriel part depuis la fonction de bord `envoyer-courriel`, seul endroit
 * de la plateforme où le secret SMTP est lisible. Un mot de passe SMTP placé
 * dans le paquet du navigateur serait lisible par n'importe quel visiteur.
 *
 * Un envoi qui échoue ne fait jamais échouer l'action métier qui l'a déclenché :
 * une facture ne doit pas rester non émise parce qu'un serveur de messagerie
 * était lent.
 */

/* ------------------------------------------------------------------ Types */

export type TypeNotification =
  | 'information' | 'validation_attendue' | 'decision' | 'echeance'
  | 'alerte' | 'paiement' | 'securite';

export type GraviteNotification = 'basse' | 'normale' | 'haute' | 'urgente';

export type DomaineNotification =
  | 'contrat' | 'requisition' | 'analyse' | 'plan_achat' | 'demande_achat'
  | 'reglement' | 'facture' | 'stock' | 'production' | 'vente' | 'compte';

export const LIBELLES_TYPE_NOTIFICATION: Record<TypeNotification, string> = {
  information: 'Information',
  validation_attendue: 'Validation attendue',
  decision: 'Décision',
  echeance: 'Échéance',
  alerte: 'Alerte',
  paiement: 'Paiement',
  securite: 'Sécurité',
};

export const LIBELLES_GRAVITE_NOTIFICATION: Record<GraviteNotification, string> = {
  basse: 'Information',
  normale: 'À lire',
  haute: 'À traiter',
  urgente: 'Urgent',
};

export const TONS_GRAVITE_NOTIFICATION:
  Record<GraviteNotification, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  basse: 'neutral',
  normale: 'info',
  haute: 'warning',
  urgente: 'danger',
};

export interface Notification {
  id: string;
  destinataire_id: string;
  type: TypeNotification;
  gravite: GraviteNotification;
  titre: string;
  message: string;
  objet_domaine: DomaineNotification | null;
  objet_id: string | null;
  chemin: string | null;
  faits: { label: string; valeur: string }[] | null;
  lue: boolean;
  lue_le: string | null;
  created_at: string;
}

export interface ResumeNotifications {
  non_lues: number;
  urgentes: number;
  hautes: number;
  plus_ancienne: string | null;
}

export interface LivraisonNotification {
  id: string;
  canal: 'plateforme' | 'courriel' | 'sms';
  destinataire: string;
  statut: 'en_attente' | 'envoye' | 'echec' | 'abandonne';
  message_erreur: string | null;
  tentatives: number;
  envoye_le: string | null;
}

export interface ConfigurationCourriel {
  hote: string | null;
  port: number;
  securise: boolean;
  identifiant: string | null;
  expediteur_courriel: string | null;
  expediteur_nom: string;
  actif: boolean;
  /** Le secret ne remonte jamais : on sait seulement s'il est posé. */
  mot_de_passe_defini: boolean;
  derniere_verification: string | null;
  derniere_erreur: string | null;
}

/** Ce que la cloche affiche : au-delà de 99, le compte exact n'aide plus. */
export const BADGE_MAXIMUM = 99;

export const formaterBadge = (nombre: number) =>
  nombre > BADGE_MAXIMUM ? `${BADGE_MAXIMUM}+` : String(nombre);

/**
 * Âge d'une notification, en français courant.
 * « il y a 3 jours » se lit plus vite qu'une date, quand ce qui compte est la
 * fraîcheur et non le moment exact.
 */
export function ageRelatif(iso: string, maintenant: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const minutes = Math.floor((maintenant.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.floor(heures / 24);
  if (jours === 1) return 'hier';
  if (jours < 31) return `il y a ${jours} jours`;
  return date.toLocaleDateString('fr-FR');
}

const lancerSiErreur = <T>({ data, error }: { data: T; error: unknown }): T => {
  if (error) throw error;
  return data;
};

export const notificationsService = {
  /** Les notifications de l'utilisateur courant. La RLS s'en assure. */
  async lister(options?: { limite?: number; nonLuesSeulement?: boolean }): Promise<Notification[]> {
    let requete = supabase
      .from('snp_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Math.min(Math.max(options?.limite ?? 30, 1), 200));

    if (options?.nonLuesSeulement) requete = requete.eq('lue', false);
    return (lancerSiErreur(await requete) || []) as Notification[];
  },

  async resume(): Promise<ResumeNotifications> {
    const reponse = await supabase.rpc('snp_notifications_resume');
    const lignes = (lancerSiErreur(reponse) || []) as ResumeNotifications[];
    return lignes[0] ?? { non_lues: 0, urgentes: 0, hautes: 0, plus_ancienne: null };
  },

  /** Marque comme lues. Sans identifiants, tout ce qui reste non lu. */
  async marquerLues(ids?: string[]): Promise<number> {
    const reponse = await supabase.rpc('snp_marquer_notifications_lues', {
      p_ids: ids && ids.length ? ids : null,
    });
    return Number(lancerSiErreur(reponse) || 0);
  },

  /**
   * Émet une notification. Réservé aux agents : la fonction vérifie
   * l'habilitation, et la table refuse toute insertion directe.
   */
  async emettre(entree: {
    destinataireId: string;
    titre: string;
    message: string;
    type?: TypeNotification;
    gravite?: GraviteNotification;
    domaine?: DomaineNotification | null;
    objetId?: string | null;
    chemin?: string | null;
    faits?: { label: string; valeur: string }[] | null;
    cleDedoublonnage?: string | null;
    parCourriel?: boolean;
  }): Promise<Notification | null> {
    const reponse = await supabase.rpc('snp_notifier', {
      p_destinataire_id: entree.destinataireId,
      p_titre: entree.titre,
      p_message: entree.message,
      p_type: entree.type ?? 'information',
      p_gravite: entree.gravite ?? 'normale',
      p_objet_domaine: entree.domaine ?? null,
      p_objet_id: entree.objetId ?? null,
      p_chemin: entree.chemin ?? null,
      p_faits: entree.faits ?? null,
      p_cle_dedoublonnage: entree.cleDedoublonnage ?? null,
      p_par_courriel: entree.parCourriel ?? true,
    });
    return (lancerSiErreur(reponse) as Notification) || null;
  },

  /** Émet vers tous les porteurs d'un rôle. Les destinataires se calculent en base. */
  async emettreVersRoles(entree: {
    roles: string[];
    titre: string;
    message: string;
    type?: TypeNotification;
    gravite?: GraviteNotification;
    domaine?: DomaineNotification | null;
    objetId?: string | null;
    chemin?: string | null;
    faits?: { label: string; valeur: string }[] | null;
    cleDedoublonnage?: string | null;
    parCourriel?: boolean;
  }): Promise<number> {
    const reponse = await supabase.rpc('snp_notifier_roles', {
      p_roles: entree.roles,
      p_titre: entree.titre,
      p_message: entree.message,
      p_type: entree.type ?? 'information',
      p_gravite: entree.gravite ?? 'normale',
      p_objet_domaine: entree.domaine ?? null,
      p_objet_id: entree.objetId ?? null,
      p_chemin: entree.chemin ?? null,
      p_faits: entree.faits ?? null,
      p_cle_dedoublonnage: entree.cleDedoublonnage ?? null,
      p_par_courriel: entree.parCourriel ?? true,
    });
    return Number(lancerSiErreur(reponse) || 0);
  },

  async livraisons(notificationId: string): Promise<LivraisonNotification[]> {
    const reponse = await supabase
      .from('snp_notifications_livraisons')
      .select('*')
      .eq('notification_id', notificationId)
      .order('created_at');
    return (lancerSiErreur(reponse) || []) as LivraisonNotification[];
  },

  /* ------------------------------------------------- Messagerie sortante */

  /**
   * Vide la file d'attente des courriels.
   *
   * L'appel n'attend pas le résultat pour rendre la main à l'action métier :
   * un serveur de messagerie lent ne doit pas retarder un enregistrement.
   */
  async viderFileCourriels(limite = 50): Promise<{
    traites: number; envoyes: number; echecs: number;
  }> {
    const { data, error } = await supabase.functions.invoke('envoyer-courriel', {
      body: { action: 'file', limite },
    });
    if (error) throw error;
    return data as { traites: number; envoyes: number; echecs: number };
  },

  /** Éprouve la configuration et rend l'erreur SMTP telle quelle. */
  async testerMessagerie(destinataire?: string): Promise<{ envoye: boolean; erreur?: string }> {
    const { data, error } = await supabase.functions.invoke('envoyer-courriel', {
      body: { action: 'test', to: destinataire },
    });
    if (error) {
      // La fonction rend un 502 avec le message du serveur SMTP : il est plus
      // utile que « échec d'appel de la fonction ».
      const detail = (data as { erreur?: string } | null)?.erreur;
      return { envoye: false, erreur: detail || error.message };
    }
    return data as { envoye: boolean; erreur?: string };
  },

  async configuration(): Promise<ConfigurationCourriel | null> {
    const reponse = await supabase.rpc('snp_configuration_courriel_lisible');
    const lignes = (lancerSiErreur(reponse) || []) as ConfigurationCourriel[];
    return lignes[0] ?? null;
  },

  /**
   * Enregistre les paramètres. Un mot de passe vide laisse l'existant en place :
   * on peut corriger le serveur sans avoir à ressaisir le secret.
   */
  async reglerConfiguration(entree: {
    hote: string;
    port: number;
    securise: boolean;
    identifiant: string;
    expediteurCourriel: string;
    expediteurNom: string;
    actif: boolean;
    motDePasse?: string;
  }): Promise<void> {
    const reponse = await supabase.rpc('snp_regler_configuration_courriel', {
      p_hote: entree.hote,
      p_port: entree.port,
      p_securise: entree.securise,
      p_identifiant: entree.identifiant,
      p_expediteur_courriel: entree.expediteurCourriel,
      p_expediteur_nom: entree.expediteurNom,
      p_actif: entree.actif,
      p_mot_de_passe: entree.motDePasse || null,
    });
    lancerSiErreur(reponse);
  },
};

export default notificationsService;
