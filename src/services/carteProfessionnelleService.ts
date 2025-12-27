import { supabase } from '@/lib/supabase';

export interface CarteProfessionnelle {
  id: string;
  artisan_id: string;
  numero_carte: string;
  statut: 'en_cours' | 'validee' | 'en_exploitation' | 'expiree' | 'suspendue' | 'annulee';
  date_delivrance: string;
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
    let query = supabase
      .from('snp_cartes_professionnelles')
      .select(`
        *,
        artisan:snp_artisans_miniers(*)
      `);

    if (filters?.statut) {
      query = query.eq('statut', filters.statut);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

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

  async valider(carteId: string) {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('snp_cartes_professionnelles')
      .update({
        statut: 'validee',
        validee_par: user?.id,
        validee_le: new Date().toISOString()
      })
      .eq('id', carteId)
      .select()
      .single();

    if (error) throw error;

    if (data) {
      await supabase
        .from('snp_artisan_activities')
        .insert([
          {
            artisan_id: data.artisan_id,
            carte_id: carteId,
            type_activite: 'validation',
            description: 'Carte professionnelle validée',
            created_by: user?.id
          }
        ]);
    }

    return data;
  },

  async suspendre(carteId: string, motif: string) {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('snp_cartes_professionnelles')
      .update({
        statut: 'suspendue',
        suspendue_par: user?.id,
        suspendue_le: new Date().toISOString(),
        motif_suspension: motif
      })
      .eq('id', carteId)
      .select()
      .single();

    if (error) throw error;

    if (data) {
      await supabase
        .from('snp_artisan_activities')
        .insert([
          {
            artisan_id: data.artisan_id,
            carte_id: carteId,
            type_activite: 'suspension',
            description: `Carte suspendue: ${motif}`,
            created_by: user?.id
          }
        ]);
    }

    return data;
  },

  async reactiver(carteId: string) {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('snp_cartes_professionnelles')
      .update({
        statut: 'validee',
        suspendue_par: null,
        suspendue_le: null,
        motif_suspension: null
      })
      .eq('id', carteId)
      .select()
      .single();

    if (error) throw error;

    if (data) {
      await supabase
        .from('snp_artisan_activities')
        .insert([
          {
            artisan_id: data.artisan_id,
            carte_id: carteId,
            type_activite: 'validation',
            description: 'Carte réactivée après suspension',
            created_by: user?.id
          }
        ]);
    }

    return data;
  },

  async renouveler(artisanId: string) {
    const { data: { user } } = await supabase.auth.getUser();

    const oldCartes = await this.getByArtisanId(artisanId);

    for (const oldCarte of oldCartes || []) {
      if (oldCarte.statut !== 'expiree' && oldCarte.statut !== 'annulee') {
        await supabase
          .from('snp_cartes_professionnelles')
          .update({ statut: 'expiree' })
          .eq('id', oldCarte.id);
      }
    }

    const { data: artisan } = await supabase
      .from('snp_artisans_miniers')
      .select('numero_carte')
      .eq('id', artisanId)
      .single();

    if (!artisan) throw new Error('Artisan not found');

    const numeroSecurite = Math.floor(Math.random() * 9999999999).toString().padStart(10, '0');

    const { data, error } = await supabase
      .from('snp_cartes_professionnelles')
      .insert([
        {
          artisan_id: artisanId,
          numero_carte: artisan.numero_carte,
          statut: 'en_cours',
          date_delivrance: new Date().toISOString().split('T')[0],
          date_expiration: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          numero_securite: numeroSecurite,
          qr_code_data: JSON.stringify({
            numero_carte: artisan.numero_carte,
            artisan_id: artisanId,
            numero_securite: numeroSecurite
          })
        }
      ])
      .select()
      .single();

    if (error) throw error;

    if (data) {
      await supabase
        .from('snp_artisan_activities')
        .insert([
          {
            artisan_id: artisanId,
            carte_id: data.id,
            type_activite: 'renouvellement',
            description: 'Carte professionnelle renouvelée',
            created_by: user?.id
          }
        ]);
    }

    return data;
  },

  async updateCartePdfUrl(carteId: string, pdfUrl: string, rectoUrl?: string, versoUrl?: string) {
    const { data, error } = await supabase
      .from('snp_cartes_professionnelles')
      .update({
        carte_pdf_url: pdfUrl,
        carte_recto_url: rectoUrl,
        carte_verso_url: versoUrl
      })
      .eq('id', carteId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateQrCodeUrl(carteId: string, qrCodeUrl: string) {
    const { data, error } = await supabase
      .from('snp_cartes_professionnelles')
      .update({
        qr_code_url: qrCodeUrl
      })
      .eq('id', carteId)
      .select()
      .single();

    if (error) throw error;
    return data;
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
