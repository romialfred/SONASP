import { supabase } from '@/lib/supabase';

export interface ArtisanGoldSale {
  id: string;
  artisan_id: string;
  date_vente: string;
  quantite_grammes: number;
  type_or: 'poudre' | 'lingot' | 'pepites' | 'bijoux' | 'autre';
  purete_karat: number;
  prix_kg_fcfa: number;
  montant_brut_fcfa: number;
  tva_taux: number;
  tva_montant_fcfa: number;
  taxe_dev_comm_taux: number;
  taxe_dev_comm_montant_fcfa: number;
  montant_total_fcfa: number;
  numero_recu?: string;
  observations?: string;
  statut: 'en_attente' | 'validee' | 'payee' | 'annulee';
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
}

export interface ArtisanStatistics {
  artisan_id: string;
  nom_complet: string;
  chiffre_affaires_total: number;
  date_derniere_vente: string | null;
  nombre_ventes_total: number;
  quantite_totale_grammes: number;
  quantite_ce_mois_grammes: number;
  nombre_ventes_ce_mois: number;
  montant_ce_mois: number;
}

export const artisanGoldSalesService = {
  async getAll(): Promise<ArtisanGoldSale[]> {
    try {
      const { data, error } = await supabase
        .from('snp_artisan_ventes_or')
        .select('*')
        .order('date_vente', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching gold sales:', error);
      throw error;
    }
  },

  async getByArtisan(artisanId: string): Promise<ArtisanGoldSale[]> {
    try {
      const { data, error } = await supabase
        .from('snp_artisan_ventes_or')
        .select('*')
        .eq('artisan_id', artisanId)
        .order('date_vente', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching artisan gold sales:', error);
      throw error;
    }
  },

  async getById(id: string): Promise<ArtisanGoldSale | null> {
    try {
      const { data, error } = await supabase
        .from('snp_artisan_ventes_or')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching gold sale:', error);
      throw error;
    }
  },

  async create(sale: Partial<ArtisanGoldSale>): Promise<ArtisanGoldSale> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!sale.artisan_id) {
        throw new Error('Artisan requis pour créer une vente');
      }

      const { data: artisan, error: artisanError } = await supabase
        .from('snp_artisans_miniers')
        .select('actif, motif_desactivation')
        .eq('id', sale.artisan_id)
        .single();

      if (artisanError) {
        throw new Error('Artisan non trouvé');
      }

      if (!artisan.actif) {
        throw new Error(
          `Vente impossible: Artisan désactivé${artisan.motif_desactivation ? ' - ' + artisan.motif_desactivation : ''}`
        );
      }

      const { data: numeroRecu, error: numeroError } = await supabase
        .rpc('generate_numero_recu_vente_or');

      if (numeroError) {
        console.warn('Could not generate receipt number:', numeroError);
      }

      const { data, error } = await supabase
        .from('snp_artisan_ventes_or')
        .insert([{
          artisan_id: sale.artisan_id,
          date_vente: sale.date_vente || new Date().toISOString().split('T')[0],
          quantite_grammes: sale.quantite_grammes,
          type_or: sale.type_or,
          purete_karat: sale.purete_karat,
          prix_kg_fcfa: sale.prix_kg_fcfa,
          tva_taux: sale.tva_taux || 18.00,
          taxe_dev_comm_taux: sale.taxe_dev_comm_taux || 1.00,
          numero_recu: numeroRecu,
          observations: sale.observations,
          statut: sale.statut || 'en_attente',
          created_by: user?.id
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error creating gold sale:', error);
      throw new Error(error.message || 'Impossible d\'enregistrer la vente');
    }
  },

  async update(id: string, updates: Partial<ArtisanGoldSale>): Promise<ArtisanGoldSale> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('snp_artisan_ventes_or')
        .update({
          ...updates,
          updated_by: user?.id
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error updating gold sale:', error);
      throw new Error(error.message || 'Impossible de mettre à jour la vente');
    }
  },

  async delete(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('snp_artisan_ventes_or')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error: any) {
      console.error('Error deleting gold sale:', error);
      throw new Error(error.message || 'Impossible de supprimer la vente');
    }
  },

  async updateStatus(id: string, status: ArtisanGoldSale['statut']): Promise<ArtisanGoldSale> {
    try {
      return await this.update(id, { statut: status });
    } catch (error) {
      throw error;
    }
  },

  calculateTaxes(quantite_grammes: number, prix_kg_fcfa: number, tva_taux: number = 18, taxe_dev_comm_taux: number = 1) {
    const montant_brut = (quantite_grammes / 1000) * prix_kg_fcfa;
    const tva_montant = montant_brut * (tva_taux / 100);
    const taxe_dev_comm_montant = montant_brut * (taxe_dev_comm_taux / 100);
    const montant_total = montant_brut + tva_montant + taxe_dev_comm_montant;

    return {
      montant_brut_fcfa: montant_brut,
      tva_montant_fcfa: tva_montant,
      taxe_dev_comm_montant_fcfa: taxe_dev_comm_montant,
      montant_total_fcfa: montant_total
    };
  },

  async getArtisanStatistics(artisanId: string): Promise<ArtisanStatistics | null> {
    try {
      const { data: artisan, error: artisanError } = await supabase
        .from('snp_artisans_miniers')
        .select('id, nom, prenoms, raison_sociale')
        .eq('id', artisanId)
        .maybeSingle();

      if (artisanError || !artisan) {
        throw new Error('Artisan non trouvé');
      }

      const nom_complet = artisan.raison_sociale || `${artisan.nom || ''} ${artisan.prenoms || ''}`.trim();

      const { data: ventes, error: ventesError } = await supabase
        .from('snp_artisan_ventes_or')
        .select('date_vente, quantite_grammes, montant_total_fcfa')
        .eq('artisan_id', artisanId)
        .neq('statut', 'annulee')
        .order('date_vente', { ascending: false });

      if (ventesError) {
        throw ventesError;
      }

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      let chiffre_affaires_total = 0;
      let quantite_totale_grammes = 0;
      let quantite_ce_mois_grammes = 0;
      let nombre_ventes_ce_mois = 0;
      let montant_ce_mois = 0;
      let date_derniere_vente: string | null = null;

      if (ventes && ventes.length > 0) {
        date_derniere_vente = ventes[0].date_vente;

        ventes.forEach((vente) => {
          chiffre_affaires_total += vente.montant_total_fcfa || 0;
          quantite_totale_grammes += vente.quantite_grammes || 0;

          const venteDate = new Date(vente.date_vente);
          if (venteDate.getMonth() === currentMonth && venteDate.getFullYear() === currentYear) {
            quantite_ce_mois_grammes += vente.quantite_grammes || 0;
            nombre_ventes_ce_mois += 1;
            montant_ce_mois += vente.montant_total_fcfa || 0;
          }
        });
      }

      return {
        artisan_id: artisanId,
        nom_complet,
        chiffre_affaires_total,
        date_derniere_vente,
        nombre_ventes_total: ventes?.length || 0,
        quantite_totale_grammes,
        quantite_ce_mois_grammes,
        nombre_ventes_ce_mois,
        montant_ce_mois,
      };
    } catch (error: any) {
      console.error('Error fetching artisan statistics:', error);
      return null;
    }
  }
};
