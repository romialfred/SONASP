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
  verifie_par?: string | null;
  observations?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export type MoyenPaiementEditable = Pick<
  MoyenPaiement,
  | 'artisan_id'
  | 'type'
  | 'libelle'
  | 'numero_telephone'
  | 'banque'
  | 'numero_compte'
  | 'code_swift'
  | 'titulaire'
  | 'est_principal'
  | 'actif'
  | 'observations'
>;

interface MoyenRpcError {
  code?: string;
  message?: string;
}

const moyenRpcClient = supabase as unknown as {
  rpc(
    functionName: 'snp_upsert_artisan_moyen_paiement' | 'snp_verifier_artisan_moyen_paiement',
    parameters: Record<string, unknown>,
  ): PromiseLike<{ data: MoyenPaiement | null; error: MoyenRpcError | null }>;
};

function nullableText(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function editablePayload(moyen: MoyenPaiement, actif = moyen.actif !== false): Record<string, unknown> {
  return {
    p_artisan_id: moyen.artisan_id,
    p_type: moyen.type,
    p_titulaire: moyen.titulaire.trim(),
    p_moyen_id: moyen.id || null,
    p_libelle: nullableText(moyen.libelle),
    p_numero_telephone: nullableText(moyen.numero_telephone),
    p_banque: nullableText(moyen.banque),
    p_numero_compte: nullableText(moyen.numero_compte),
    p_code_swift: nullableText(moyen.code_swift),
    p_est_principal: Boolean(moyen.est_principal),
    p_actif: actif,
    p_observations: nullableText(moyen.observations),
  };
}

async function upsertMoyen(moyen: MoyenPaiement, actif = moyen.actif !== false): Promise<MoyenPaiement> {
  const message = validerMoyen(moyen);
  if (message) throw new Error(message);

  const { data, error } = await moyenRpcClient.rpc(
    'snp_upsert_artisan_moyen_paiement',
    editablePayload(moyen, actif),
  );
  if (error) throw error;
  if (!data) throw new Error('Le serveur n’a pas confirmé le moyen de paiement.');
  return data;
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
    return upsertMoyen({ ...moyen, id: undefined });
  },

  async modifier(
    id: string,
    moyen: Partial<Omit<MoyenPaiementEditable, 'artisan_id'>>,
  ): Promise<MoyenPaiement> {
    const { data: current, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    if (!current) throw new Error('Moyen de paiement introuvable.');
    const existing = current as MoyenPaiement;
    return upsertMoyen({ ...existing, ...moyen, artisan_id: existing.artisan_id, id });
  },

  /** Désactivation plutôt que suppression : un règlement passé y renvoie. */
  async desactiver(id: string): Promise<void> {
    const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single();
    if (error) throw error;
    if (!data) throw new Error('Moyen de paiement introuvable.');
    await upsertMoyen({ ...(data as MoyenPaiement), id }, false);
  },

  async verifier(id: string, approuve: boolean, motif?: string): Promise<MoyenPaiement> {
    if (!approuve && (motif?.trim().length || 0) < 10) {
      throw new Error('Le rejet exige un motif d’au moins dix caractères.');
    }
    const { data, error } = await moyenRpcClient.rpc('snp_verifier_artisan_moyen_paiement', {
      p_moyen_id: id,
      p_approuve: approuve,
      p_motif: nullableText(motif),
    });
    if (error) throw error;
    if (!data) throw new Error('Le serveur n’a pas confirmé la vérification du moyen de paiement.');
    return data;
  },

  /**
   * Remplace les moyens d'un artisan par ceux fournis.
   * Employé par le formulaire de fiche, qui présente la liste complète.
   */
  async remplacerPourArtisan(artisanId: string, moyens: MoyenPaiement[]): Promise<void> {
    const { data: existants, error: lecture } = await supabase
      .from(TABLE)
      .select('*')
      .eq('artisan_id', artisanId)
      .eq('actif', true);
    if (lecture) throw lecture;

    const conserves = new Set(moyens.map((moyen) => moyen.id).filter(Boolean));
    const aRetirer = (existants || []).map((ligne) => ligne.id).filter((id) => !conserves.has(id));

    const byId = new Map((existants || []).map((ligne) => [ligne.id, ligne as MoyenPaiement]));

    // Le retrait précède l'ajout : la RPC maintient l'unicité du principal sous verrou.
    for (const id of aRetirer) {
      const existant = byId.get(id);
      if (existant) await upsertMoyen(existant, false);
    }

    for (const moyen of moyens) {
      await upsertMoyen({ ...moyen, artisan_id: artisanId });
    }
  },
};
