import { supabase } from '@/lib/supabase';
import { appliquerDureeInactivite } from '@/lib/sessionPolicy';

/**
 * Paramètres généraux de la plateforme.
 *
 * La durée d'inactivité n'est pas un réglage d'affichage : c'est le serveur qui
 * l'applique, en fixant l'échéance de la session à chaque battement d'activité.
 * Le navigateur la lit pour que son minuteur annonce la même durée que celle
 * que la base tiendra.
 *
 * L'écriture passe par une procédure de confiance, qui exige l'authentification
 * forte et la capacité `platform.settings.manage`, borne la valeur et journalise
 * le changement.
 */

export interface ParametresSession {
  /** Durée d'inactivité en vigueur, en minutes. */
  inactiviteMinutes: number;
  minimumMinutes: number;
  maximumMinutes: number;
}

interface ReponseParametresSession {
  inactivite_minutes: number;
  minimum_minutes: number;
  maximum_minutes: number;
}

function versParametres(donnees: ReponseParametresSession): ParametresSession {
  return {
    inactiviteMinutes: Number(donnees.inactivite_minutes),
    minimumMinutes: Number(donnees.minimum_minutes),
    maximumMinutes: Number(donnees.maximum_minutes),
  };
}

export const parametresPlateformeService = {
  /** Lit la durée en vigueur. Accessible à tout compte authentifié : le minuteur en a besoin. */
  async lireParametresSession(): Promise<ParametresSession> {
    const { data, error } = await supabase.rpc('snp_parametres_session_lire');
    if (error) throw error;
    return versParametres(data as unknown as ReponseParametresSession);
  },

  /**
   * Lit la durée du serveur et l'applique au minuteur local.
   *
   * Ne propage pas l'échec : si la lecture échoue, le minuteur conserve son
   * repli de dix minutes. Déconnecter trop tôt reste préférable à promettre une
   * durée que la base ne tiendrait pas.
   */
  async synchroniserDureeSession(): Promise<number | null> {
    try {
      const parametres = await this.lireParametresSession();
      return appliquerDureeInactivite(parametres.inactiviteMinutes);
    } catch {
      return null;
    }
  },

  /**
   * Fixe la durée d'inactivité. La procédure refuse une valeur hors bornes et un
   * acteur non habilité. La nouvelle valeur est appliquée au minuteur local dans
   * la foulée, sans attendre une reconnexion.
   */
  async definirDureeSession(minutes: number): Promise<ParametresSession> {
    const { data, error } = await supabase.rpc('snp_parametre_session_definir', {
      p_minutes: minutes,
    });
    if (error) throw error;

    const reponse = data as unknown as { inactivite_minutes: number; ancienne_valeur_minutes: number };
    appliquerDureeInactivite(Number(reponse.inactivite_minutes));
    return this.lireParametresSession();
  },
};
