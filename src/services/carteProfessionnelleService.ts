import { supabase } from '@/lib/supabase';
import { readAllPages } from '@/lib/readAllPages';

export type CarteProfessionnelleStatut =
  | 'en_cours'
  | 'validee'
  | 'en_exploitation'
  | 'expiree'
  | 'suspendue'
  | 'annulee';

export interface CarteProfessionnelle {
  id: string;
  artisan_id: string;
  numero_carte: string;
  statut: CarteProfessionnelleStatut;
  date_emission?: string;
  /** Alias historique encore employé par certains écrans. */
  date_delivrance?: string;
  date_expiration: string;
  validee_par?: string;
  validee_le?: string;
  suspendue_le?: string;
  suspendue_par?: string;
  motif_suspension?: string;
  carte_pdf_url?: string;
  carte_recto_url?: string;
  carte_verso_url?: string;
  qr_code_data?: string;
  qr_code_url?: string;
  numero_securite?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
  updated_by?: string | null;
}

interface CarteRpcError {
  code?: string;
  message?: string;
}

type CarteRpcParameters =
  | {
      p_carte_id: string;
      p_expected_statut: CarteProfessionnelleStatut;
      p_nouveau_statut: CarteProfessionnelleStatut;
      p_motif: string | null;
    }
  | {
      p_artisan_id: string;
      p_date_expiration: string | null;
      p_observations: string | null;
    };

const carteRpcClient = supabase as unknown as {
  rpc(
    functionName: 'snp_transition_carte_professionnelle' | 'snp_renouveler_carte_professionnelle',
    parameters: CarteRpcParameters,
  ): PromiseLike<{ data: CarteProfessionnelle | null; error: CarteRpcError | null }>;
};

const TRANSITIONS_AUTORISEES: Record<CarteProfessionnelleStatut, readonly CarteProfessionnelleStatut[]> = {
  en_cours: ['validee', 'annulee'],
  validee: ['en_exploitation', 'suspendue', 'annulee'],
  en_exploitation: ['suspendue', 'expiree', 'annulee'],
  suspendue: ['validee', 'annulee'],
  expiree: [],
  annulee: [],
};

export class CarteProfessionnelleConflictError extends Error {
  constructor() {
    super('La carte a changé d’état entre-temps. Actualisez la page avant de réessayer.');
    this.name = 'CarteProfessionnelleConflictError';
  }
}

export class CarteProfessionnelleMutationUnavailableError extends Error {
  constructor() {
    super('Cette modification de carte ne dispose pas encore d’une opération serveur sécurisée.');
    this.name = 'CarteProfessionnelleMutationUnavailableError';
  }
}

function nullableText(value?: string): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function assertTransition(
  expected: CarteProfessionnelleStatut,
  next: CarteProfessionnelleStatut,
  motif?: string,
): void {
  if (!TRANSITIONS_AUTORISEES[expected].includes(next)) {
    throw new Error(`Transition de carte interdite : ${expected} vers ${next}.`);
  }
  if ((next === 'suspendue' || next === 'annulee') && (motif?.trim().length || 0) < 10) {
    throw new Error('La suspension ou l’annulation exige un motif d’au moins dix caractères.');
  }
}

function throwCarteRpcError(error: CarteRpcError): never {
  if (error.code === '40001' || error.message?.includes('Conflit optimiste')) {
    throw new CarteProfessionnelleConflictError();
  }
  throw error;
}

export const carteProfessionnelleService = {
  async getByArtisanId(artisanId: string) {
    const { data, error } = await supabase
      .from('snp_cartes_professionnelles')
      .select(`
        *,
        artisan:snp_artisans_miniers(*)
      `)
      .eq('artisan_id', artisanId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getActiveCarteByArtisan(artisanId: string) {
    const { data, error } = await supabase
      .from('snp_cartes_professionnelles')
      .select(`
        *,
        artisan:snp_artisans_miniers(*)
      `)
      .eq('artisan_id', artisanId)
      .in('statut', ['validee', 'en_exploitation'])
      .order('date_delivrance', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async getById(carteId: string) {
    const { data, error } = await supabase
      .from('snp_cartes_professionnelles')
      .select(`
        *,
        artisan:snp_artisans_miniers(*),
        valideur:auth.users!snp_cartes_professionnelles_validee_par_fkey(id, email)
      `)
      .eq('id', carteId)
      .single();

    if (error) throw error;
    return data;
  },

  async getByNumeroCarte(numeroCarte: string) {
    const { data, error } = await supabase
      .from('snp_cartes_professionnelles')
      .select(`
        *,
        artisan:snp_artisans_miniers(*)
      `)
      .eq('numero_carte', numeroCarte)
      .single();

    if (error) throw error;
    return data;
  },

  async getCartesEnCours() {
    const { data, error } = await supabase
      .from('snp_cartes_professionnelles')
      .select(`
        *,
        artisan:snp_artisans_miniers(*)
      `)
      .eq('statut', 'en_cours')
      .order('created_at', { ascending: false});

    if (error) throw error;
    return data;
  },

  async getCartesExpirant(joursRestants: number = 30) {
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() + joursRestants);

    const { data, error } = await supabase
      .from('snp_cartes_professionnelles')
      .select(`
        *,
        artisan:snp_artisans_miniers(*)
      `)
      .in('statut', ['validee', 'en_exploitation'])
      // Borne basse indispensable : sans elle, les cartes deja expirees depuis des mois
      // etaient comptees comme « arrivant a echeance ».
      .gte('date_expiration', new Date().toISOString().split('T')[0])
      .lte('date_expiration', dateLimit.toISOString().split('T')[0])
      .order('date_expiration', { ascending: true });

    if (error) throw error;
    return data;
  },

  async getAllCartes(filters?: {
    statut?: string;
    type_artisan?: string;
    mining_company_id?: string;
  }) {
    const data = await readAllPages((from, to) => {
      let query = supabase
        .from('snp_cartes_professionnelles')
        .select(`
          *,
          artisan:snp_artisans_miniers(*)
        `, { count: 'exact' });

      if (filters?.statut) {
        query = query.eq('statut', filters.statut);
      }

      return query.order('created_at', { ascending: false }).order('id').range(from, to);
    });

    let filteredData = data;

    if (filters?.type_artisan && data) {
      filteredData = data.filter((carte: any) =>
        carte.artisan?.type_artisan === filters.type_artisan
      );
    }

    if (filters?.mining_company_id && filteredData) {
      filteredData = filteredData.filter((carte: any) =>
        carte.artisan?.mining_company_id === filters.mining_company_id
      );
    }

    return filteredData;
  },

  async transitionner(
    carteId: string,
    expectedStatut: CarteProfessionnelleStatut,
    nouveauStatut: CarteProfessionnelleStatut,
    motif?: string,
  ): Promise<CarteProfessionnelle> {
    assertTransition(expectedStatut, nouveauStatut, motif);
    const { data, error } = await carteRpcClient.rpc('snp_transition_carte_professionnelle', {
      p_carte_id: carteId,
      p_expected_statut: expectedStatut,
      p_nouveau_statut: nouveauStatut,
      p_motif: nullableText(motif),
    });

    if (error) throwCarteRpcError(error);
    if (!data) throw new Error('Le serveur n’a pas confirmé la transition de la carte.');
    return data;
  },

  async valider(carteId: string, expectedStatut: CarteProfessionnelleStatut = 'en_cours') {
    return this.transitionner(carteId, expectedStatut, 'validee');
  },

  async suspendre(
    carteId: string,
    expectedStatut: Extract<CarteProfessionnelleStatut, 'validee' | 'en_exploitation'>,
    motif: string,
  ) {
    return this.transitionner(carteId, expectedStatut, 'suspendue', motif);
  },

  async reactiver(carteId: string) {
    return this.transitionner(carteId, 'suspendue', 'validee');
  },

  async renouveler(artisanId: string, dateExpiration?: string, observations?: string) {
    const { data, error } = await carteRpcClient.rpc('snp_renouveler_carte_professionnelle', {
      p_artisan_id: artisanId,
      p_date_expiration: nullableText(dateExpiration),
      p_observations: nullableText(observations),
    });

    if (error) throw error;
    if (!data) throw new Error('Le serveur n’a pas confirmé le renouvellement de la carte.');
    return data;
  },

  async updateCartePdfUrl(_carteId: string, _pdfUrl: string, _rectoUrl?: string, _versoUrl?: string) {
    throw new CarteProfessionnelleMutationUnavailableError();
  },

  async updateQrCodeUrl(_carteId: string, _qrCodeUrl: string) {
    throw new CarteProfessionnelleMutationUnavailableError();
  },

  /**
   * Dernieres activites tracees sur les cartes professionnelles.
   * Requete deplacee depuis la page `CarteSuivi` : l'acces aux donnees appartient au
   * service (constat F8 de l'audit).
   */
  async getRecentActivities(limit = 10) {
    const { data, error } = await supabase
      .from('snp_artisan_activities')
      .select(`
        *,
        artisan:snp_artisans_miniers(nom, prenoms, raison_sociale, type_personne, type_artisan),
        carte:snp_cartes_professionnelles(numero_carte)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  /** Artisans les plus actifs, agreges depuis les statistiques mensuelles de carte. */
  async getTopArtisans(limit = 5) {
    const { data, error } = await supabase
      .from('snp_carte_statistics')
      .select(`
        *,
        artisan:snp_artisans_miniers(nom, prenoms, raison_sociale, type_personne),
        carte:snp_cartes_professionnelles(numero_carte, statut)
      `)
      .order('montant_total_ventes', { ascending: false })
      .limit(limit * 6);

    if (error) throw error;

    const byArtisan = new Map<string, {
      artisanId: string;
      artisan: Record<string, unknown> | null;
      carte: Record<string, unknown> | null;
      ventes: number;
      montant: number;
      grammes: number;
    }>();

    (data || []).forEach((stat: Record<string, unknown>) => {
      const key = String(stat.artisan_id || '');
      if (!key) return;
      const current = byArtisan.get(key) || {
        artisanId: key,
        artisan: (stat.artisan as Record<string, unknown>) || null,
        carte: (stat.carte as Record<string, unknown>) || null,
        ventes: 0,
        montant: 0,
        grammes: 0,
      };
      current.ventes += Number(stat.nombre_ventes || 0);
      current.montant += Number(stat.montant_total_ventes || 0);
      current.grammes += Number(stat.quantite_totale_grammes || 0);
      byArtisan.set(key, current);
    });

    return [...byArtisan.values()].sort((a, b) => b.montant - a.montant).slice(0, limit);
  },

  async getDashboardStats() {
    const { data: cartes, error } = await supabase
      .from('snp_cartes_professionnelles')
      .select('statut, date_expiration');

    if (error) throw error;

    const stats = {
      total: cartes?.length || 0,
      en_cours: 0,
      validees: 0,
      en_exploitation: 0,
      expirees: 0,
      suspendues: 0,
      expirant_30_jours: 0,
      expirant_60_jours: 0,
      expirant_90_jours: 0
    };

    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    cartes?.forEach(carte => {
      switch (carte.statut) {
        case 'en_cours':
          stats.en_cours++;
          break;
        case 'validee':
          stats.validees++;
          break;
        case 'en_exploitation':
          stats.en_exploitation++;
          break;
        case 'expiree':
          stats.expirees++;
          break;
        case 'suspendue':
          stats.suspendues++;
          break;
      }

      if (carte.date_expiration) {
        const expirationDate = new Date(carte.date_expiration);
        if (expirationDate > now && expirationDate <= in30Days) {
          stats.expirant_30_jours++;
        }
        if (expirationDate > now && expirationDate <= in60Days) {
          stats.expirant_60_jours++;
        }
        if (expirationDate > now && expirationDate <= in90Days) {
          stats.expirant_90_jours++;
        }
      }
    });

    return stats;
  },

  getJoursRestants(dateExpiration: string): number {
    const now = new Date();
    const expiration = new Date(dateExpiration);
    const diff = expiration.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  },

  getMoisRestants(dateExpiration: string): number {
    const joursRestants = this.getJoursRestants(dateExpiration);
    return Math.floor(joursRestants / 30);
  },

  isExpiringSoon(dateExpiration: string, joursAlerte: number = 60): boolean {
    const joursRestants = this.getJoursRestants(dateExpiration);
    return joursRestants > 0 && joursRestants <= joursAlerte;
  },

  isExpired(dateExpiration: string): boolean {
    return this.getJoursRestants(dateExpiration) <= 0;
  }
};
