import { supabase } from '@/lib/supabase';

const TABLE = 'snp_artisan_moyens_paiement';

export type TypeMoyenPaiement =
  | 'orange_money'
  | 'moov_money'
  | 'wave'
  | 'mobile_money'
  | 'virement_bancaire'
  | 'cheque'
  | 'especes';

export interface MoyenPaiement {
  id?: string;
  artisan_id: string;
  type: TypeMoyenPaiement;
  libelle?: string | null;
  numero_telephone?: string | null;
  banque?: string | null;
  numero_compte?: string | null;
  code_swift?: string | null;
  titulaire: string;
  est_principal: boolean;
  actif: boolean;
  verifie_le?: string | null;
  observations?: string | null;
}

export const TYPES_MOBILE: TypeMoyenPaiement[] = ['orange_money', 'moov_money', 'wave', 'mobile_money'];
export const TYPES_BANCAIRE: TypeMoyenPaiement[] = ['virement_bancaire', 'cheque'];

export const LIBELLES_MOYEN: Record<TypeMoyenPaiement, string> = {
  orange_money: 'Orange Money',
  moov_money: 'Moov Money',
  wave: 'Wave',
  mobile_money: 'Autre service mobile',
  virement_bancaire: 'Virement bancaire',
  cheque: 'Chèque',
  especes: 'Espèces',
};

export const MOYEN_VIDE = (artisanId = ''): MoyenPaiement => ({
  artisan_id: artisanId,
  type: 'orange_money',
  titulaire: '',
  numero_telephone: '',
  banque: '',
  numero_compte: '',
  code_swift: '',
  est_principal: false,
  actif: true,
});

/**
 * Coordonnée affichée à l'écran de paiement.
 * Le numéro n'est jamais montré en entier : seuls les quatre derniers caractères
 * le sont, comme sur un relevé bancaire.
 */
export function coordonneeMasquee(moyen: Pick<MoyenPaiement, 'type' | 'numero_telephone' | 'numero_compte'>): string {
  const brut = TYPES_MOBILE.includes(moyen.type) ? moyen.numero_telephone : moyen.numero_compte;
  const propre = String(brut || '').replace(/\s+/g, '');
  if (!propre) return '—';
  if (propre.length <= 4) return propre;
  return `•••• ${propre.slice(-4)}`;
}

/** Intitulé complet d'un moyen, pour une liste ou un récapitulatif. */
export function libelleMoyen(moyen: Pick<MoyenPaiement, 'type' | 'libelle' | 'titulaire'>): string {
  const base = moyen.libelle?.trim() || LIBELLES_MOYEN[moyen.type];
  return moyen.titulaire ? `${base} — ${moyen.titulaire}` : base;
}

/**
 * Contrôles bloquants avant enregistrement.
 * Un moyen sans coordonnée exploitable ne sert à rien : autant refuser à la
 * saisie plutôt que de le découvrir au moment de payer.
 */
export function validerMoyen(moyen: MoyenPaiement): string | null {
  if (!moyen.titulaire?.trim()) return 'Le nom du titulaire est obligatoire.';

  if (TYPES_MOBILE.includes(moyen.type)) {
    const numero = String(moyen.numero_telephone || '').replace(/\s+/g, '');
    if (!numero) return 'Le numéro de téléphone est obligatoire pour un paiement mobile.';
    if (!/^\+?\d{8,15}$/.test(numero)) return 'Le numéro de téléphone n’est pas au bon format.';
    return null;
  }

  if (TYPES_BANCAIRE.includes(moyen.type)) {
    if (!moyen.banque?.trim()) return 'La banque est obligatoire pour un virement ou un chèque.';
    if (!String(moyen.numero_compte || '').trim()) return 'Le numéro de compte est obligatoire.';
    return null;
  }

  return null;
}

/**
 * Un seul moyen principal.
 * Marquer un moyen principal retire la marque des autres : sans cela, l'écran de
 * paiement en présélectionnerait plusieurs.
 */
export function appliquerPrincipalUnique(moyens: MoyenPaiement[], indexPrincipal: number): MoyenPaiement[] {
  return moyens.map((moyen, index) => ({ ...moyen, est_principal: index === indexPrincipal }));
}

/** Moyen présélectionné : le principal, à défaut le premier actif. */
export function moyenParDefaut(moyens: MoyenPaiement[]): MoyenPaiement | null {
  const actifs = moyens.filter((moyen) => moyen.actif !== false);
  return actifs.find((moyen) => moyen.est_principal) || actifs[0] || null;
}

export const artisanMoyenPaiementService = {
  async listerParArtisan(artisanId: string): Promise<MoyenPaiement[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('artisan_id', artisanId)
      .eq('actif', true)
      .order('est_principal', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []) as MoyenPaiement[];
  },

  async creer(moyen: MoyenPaiement): Promise<MoyenPaiement> {
    const message = validerMoyen(moyen);
    if (message) throw new Error(message);

    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from(TABLE)
      .insert([{ ...moyen, created_by: user?.id, updated_by: user?.id }])
      .select()
      .single();

    if (error) throw error;
    return data as MoyenPaiement;
  },

  async modifier(id: string, moyen: Partial<MoyenPaiement>): Promise<MoyenPaiement> {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from(TABLE)
      .update({ ...moyen, updated_by: user?.id, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as MoyenPaiement;
  },

  /** Désactivation plutôt que suppression : un règlement passé y renvoie. */
  async desactiver(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).update({ actif: false }).eq('id', id);
    if (error) throw error;
  },

  /**
   * Remplace les moyens d'un artisan par ceux fournis.
   * Employé par le formulaire de fiche, qui présente la liste complète.
   */
  async remplacerPourArtisan(artisanId: string, moyens: MoyenPaiement[]): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();

    const { data: existants, error: lecture } = await supabase
      .from(TABLE)
      .select('id')
      .eq('artisan_id', artisanId)
      .eq('actif', true);
    if (lecture) throw lecture;

    const conserves = new Set(moyens.map((moyen) => moyen.id).filter(Boolean));
    const aRetirer = (existants || []).map((ligne) => ligne.id).filter((id) => !conserves.has(id));

    // Le retrait précède l'ajout : l'index d'unicité du moyen principal
    // refuserait deux principaux le temps de la bascule.
    if (aRetirer.length > 0) {
      const { error } = await supabase.from(TABLE).update({ actif: false }).in('id', aRetirer);
      if (error) throw error;
    }

    for (const moyen of moyens) {
      const message = validerMoyen(moyen);
      if (message) throw new Error(message);

      if (moyen.id) {
        const { error } = await supabase
          .from(TABLE)
          .update({ ...moyen, updated_by: user?.id, updated_at: new Date().toISOString() })
          .eq('id', moyen.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from(TABLE)
          .insert([{ ...moyen, artisan_id: artisanId, created_by: user?.id, updated_by: user?.id }]);
        if (error) throw error;
      }
    }
  },
};
