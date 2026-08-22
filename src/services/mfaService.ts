import { supabase } from '@/lib/supabase';

/**
 * Deuxième facteur d'authentification (TOTP).
 *
 * ══ CE QUI A ÉTÉ REMPLACÉ, ET POURQUOI ══
 *
 * Le dispositif précédent composait le secret avec `Math.random()`,
 * l'enregistrait en clair dans `user_profiles`, l'envoyait à un service tiers
 * pour fabriquer le QR code, et n'a jamais vérifié le code saisi : six chiffres
 * quelconques activaient la protection. Un tel dispositif ne protège rien et
 * fait croire le contraire.
 *
 * ══ LE PRINCIPE RETENU ══
 *
 * Le secret ne transite par aucun code de la plateforme. `enroll()` et
 * `verify()` dialoguent directement avec GoTrue, qui détient le secret et le
 * chiffre au repos. La plateforme ne conserve que l'état d'enrôlement.
 *
 * ══ OÙ LA RÈGLE S'APPLIQUE ══
 *
 * SONASP n'a pas de serveur applicatif : masquer un écran ne protégerait rien.
 * La règle vit donc aussi dans la base. Toute session métier doit être enrôlée
 * puis élevée à `aal2`; sans second facteur validé, l'accès aux données reste
 * fermé quel que soit l'écran ouvert.
 */

/** Nom affiché dans Microsoft Authenticator ou Google Authenticator. */
export const EMETTEUR_TOTP = 'SONASP';

export type NiveauAssurance = 'aal1' | 'aal2';

export type EtapeSuivante = 'mot_de_passe' | 'enrolement' | 'verification' | 'pret';

export const LIBELLES_ETAPE: Record<EtapeSuivante, string> = {
  mot_de_passe: 'Changer le mot de passe',
  enrolement: 'Activer le second facteur',
  verification: 'Saisir le code de vérification',
  pret: 'Accès ouvert',
};

export interface EtatMfa {
  enrole: boolean;
  enrole_le: string | null;
  mot_de_passe_a_changer: boolean;
  aal: NiveauAssurance;
  facteurs_verifies: number;
  etape_suivante: EtapeSuivante;
}

export interface Enrolement {
  facteurId: string;
  /** Data URI prêt pour un `<img src>`. */
  qrCode: string;
  /** Clé à recopier quand l'appareil photo n'est pas disponible. */
  secret: string;
}

export interface LigneConformite {
  utilisateur_id: string;
  courriel: string;
  nom: string;
  role: string;
  actif: boolean;
  enrole_le: string | null;
  facteurs_verifies: number;
  reinitialise_le: string | null;
  protege: boolean;
}

/**
 * GoTrue rend le QR code en SVG brut, qui ne s'affiche pas dans un `<img src>`.
 * On l'encode en data URI plutôt que de l'injecter dans le document : dans un
 * `<img>`, le SVG est rendu en bac à sable et ne peut pas exécuter de script.
 */
export function versDataUri(qrCode: string): string {
  const valeur = qrCode?.trim() ?? '';
  if (valeur.startsWith('data:')) return valeur;
  return `data:image/svg+xml;utf8,${encodeURIComponent(valeur)}`;
}

/** Regroupe le secret par blocs de quatre : on le recopie sans se perdre. */
export function secretLisible(secret: string): string {
  return (secret || '').replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();
}

/**
 * Force d'un mot de passe, de 0 à 4.
 * La longueur pèse davantage que la variété : « Tr0ub4dor& » se casse plus vite
 * que quatre mots communs mis bout à bout.
 */
export function forceMotDePasse(motDePasse: string): number {
  const valeur = motDePasse ?? '';
  if (valeur.length < 8) return 0;
  let score = 1;
  if (valeur.length >= 12) score += 1;
  if (valeur.length >= 16) score += 1;
  const varietes = [/[a-z]/, /[A-Z]/, /\d/, /[^\w\s]/].filter((r) => r.test(valeur)).length;
  if (varietes >= 3) score += 1;
  return Math.min(4, score);
}

export const LIBELLES_FORCE = ['Trop court', 'Faible', 'Correct', 'Bon', 'Solide'];

const lancerSiErreur = <T>({ data, error }: { data: T; error: unknown }): T => {
  if (error) throw error;
  return data;
};

export const mfaService = {
  /** L'étape suivante du parcours, telle que la base la voit. */
  async etat(): Promise<EtatMfa | null> {
    const reponse = await supabase.rpc('snp_etat_mfa');
    const lignes = (lancerSiErreur(reponse) || []) as EtatMfa[];
    return lignes[0] ?? null;
  },

  /**
   * Crée un facteur TOTP et rend le QR code.
   *
   * Nettoie au préalable les facteurs restés non vérifiés : un enrôlement
   * interrompu — onglet fermé pendant le scan — laisserait des facteurs
   * orphelins qui finiraient par atteindre la limite imposée par GoTrue.
   */
  async commencerEnrolement(): Promise<Enrolement> {
    const { data: facteurs } = await supabase.auth.mfa.listFactors();
    const orphelins = (facteurs?.all ?? []).filter((f) => f.status === 'unverified');
    for (const facteur of orphelins) {
      await supabase.auth.mfa.unenroll({ factorId: facteur.id });
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      issuer: EMETTEUR_TOTP,
      friendlyName: `SONASP · ${new Date().toISOString().slice(0, 10)}`,
    });
    if (error) throw error;
    if (!data?.totp?.qr_code) {
      throw new Error('Le QR code n’a pas pu être produit. Réessayez dans un instant.');
    }

    return {
      facteurId: data.id,
      qrCode: versDataUri(data.totp.qr_code),
      secret: data.totp.secret,
    };
  },

  /** Le facteur déjà vérifié du compte, s'il existe. */
  async facteurVerifie(): Promise<{ id: string } | null> {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error || !data) return null;
    const verifie = (data.totp ?? []).find((f) => f.status === 'verified');
    return verifie ? { id: verifie.id } : null;
  },

  /**
   * Valide un code. En cas de succès, la session passe à `aal2` — c'est cette
   * élévation, et non un état d'écran, qui rouvre l'accès aux données.
   */
  async verifierCode(facteurId: string, code: string): Promise<void> {
    const { data: defi, error: erreurDefi } = await supabase.auth.mfa.challenge({
      factorId: facteurId,
    });
    if (erreurDefi) throw erreurDefi;

    const { error } = await supabase.auth.mfa.verify({
      factorId: facteurId,
      challengeId: defi.id,
      code: code.replace(/\s/g, ''),
    });

    if (error) {
      const invalide = /invalid|incorrect|expired/i.test(error.message);
      throw new Error(invalide
        ? 'Code incorrect ou expiré. Vérifiez celui qui s’affiche dans votre application.'
        : error.message);
    }
  },

  /**
   * Confirme l'enrôlement auprès de la base.
   * Elle exige deux preuves indépendantes : un facteur réellement vérifié, et
   * une session élevée. Le navigateur ne peut forger ni l'une ni l'autre.
   */
  async confirmerEnrolement(): Promise<void> {
    const reponse = await supabase.rpc('snp_confirmer_enrolement_mfa');
    lancerSiErreur(reponse);
  },

  /** Change le mot de passe et lève l'obligation de première connexion. */
  async changerMotDePasse(nouveau: string): Promise<void> {
    if (forceMotDePasse(nouveau) < 2) {
      throw new Error('Choisissez un mot de passe d’au moins douze caractères.');
    }
    const { error } = await supabase.auth.updateUser({ password: nouveau });
    if (error) throw error;

    const { data: utilisateur } = await supabase.auth.getUser();
    if (utilisateur?.user) {
      await supabase.from('user_profiles')
        .update({
          must_change_password: false,
          password_changed_at: new Date().toISOString(),
        })
        .eq('id', utilisateur.user.id);
    }
  },

  /* --------------------------------------------------------- Administration */

  async conformite(): Promise<LigneConformite[]> {
    const reponse = await supabase.rpc('snp_conformite_mfa');
    return (lancerSiErreur(reponse) || []) as LigneConformite[];
  },

  /**
   * Réinitialise le second facteur d'un porteur ayant perdu son appareil.
   * Il n'y a pas de codes de secours : un code conservé en clair réintroduirait
   * exactement le défaut qu'on vient de corriger.
   */
  async reinitialiser(utilisateurId: string, motif: string): Promise<void> {
    const reponse = await supabase.rpc('snp_reinitialiser_mfa', {
      p_utilisateur_id: utilisateurId,
      p_motif: motif,
    });
    lancerSiErreur(reponse);
  },
};

export default mfaService;
