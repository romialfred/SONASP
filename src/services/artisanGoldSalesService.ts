import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import { genererNumeroRecu } from './venteRecuNumberService';

export interface ArtisanGoldSale {
  id: string;
  artisan_id: string;
  date_vente: string;
  quantite_grammes: number;
  type_or: 'poudre' | 'lingot' | 'pepites' | 'bijoux' | 'autre';
  purete_karat: number;
  prix_kg_fcfa: number;
  montant_brut_fcfa: number;
  tva_taux: number | null;
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

type ArtisanGoldSaleRow = Database['public']['Tables']['snp_artisan_ventes_or']['Row'];
type ArtisanGoldSaleInsert = Database['public']['Tables']['snp_artisan_ventes_or']['Insert'];

const SALE_STATUSES: ArtisanGoldSale['statut'][] = ['en_attente', 'validee', 'payee', 'annulee'];

/**
 * Ramene les colonnes nullables de la base vers le contrat stable utilise par
 * l'interface. Les anciens enregistrements restent ainsi affichables sans
 * propager des valeurs nulles dans tous les composants metier.
 */
function normalizeSale(row: ArtisanGoldSaleRow): ArtisanGoldSale {
  const statut = SALE_STATUSES.includes(row.statut as ArtisanGoldSale['statut'])
    ? (row.statut as ArtisanGoldSale['statut'])
    : 'en_attente';

  return {
    id: row.id,
    artisan_id: row.artisan_id,
    date_vente: row.date_vente,
    quantite_grammes: row.quantite_grammes,
    type_or: row.type_or,
    purete_karat: row.purete_karat,
    prix_kg_fcfa: row.prix_kg_fcfa,
    montant_brut_fcfa: row.montant_brut_fcfa,
    tva_taux: row.tva_taux,
    tva_montant_fcfa: row.tva_montant_fcfa ?? 0,
    taxe_dev_comm_taux: row.taxe_dev_comm_taux ?? 0,
    taxe_dev_comm_montant_fcfa: row.taxe_dev_comm_montant_fcfa ?? 0,
    montant_total_fcfa: row.montant_total_fcfa,
    numero_recu: row.numero_recu ?? undefined,
    observations: row.observations ?? undefined,
    statut,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by ?? undefined,
    updated_by: row.updated_by ?? undefined,
  };
}

export const artisanGoldSalesService = {
  async getAll(): Promise<ArtisanGoldSale[]> {
    try {
      const { data, error } = await supabase
        .from('snp_artisan_ventes_or')
        .select('*')
        .order('date_vente', { ascending: false });

      if (error) throw error;
      return (data || []).map(normalizeSale);
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
      return (data || []).map(normalizeSale);
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
      return data ? normalizeSale(data) : null;
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

      if (
        !sale.type_or ||
        sale.quantite_grammes == null ||
        sale.purete_karat == null ||
        sale.prix_kg_fcfa == null ||
        sale.montant_brut_fcfa == null ||
        sale.montant_total_fcfa == null
      ) {
        throw new Error('Les données financières et la qualité de la vente sont requises');
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

      // La numerotation est desormais tenue par l'application, comme celle des
      // cartes professionnelles : l'ancienne fonction distante produisait
      // `VENTE/OR/2025/12/0002`, avec des barres obliques peu commodes en URL,
      // en nom de fichier et dans un export. Une erreur n'est plus avalee :
      // attribuer un numero sans connaitre ceux deja pris ferait un doublon sur
      // une piece comptable.
      //
      // Le formulaire attribue le numero a l'ouverture pour l'afficher au
      // declarant ; il est repris tel quel, faute de quoi la piece porterait un
      // numero different de celui annonce a l'ecran.
      const numeroRecu = sale.numero_recu || (await genererNumeroRecu());

      const saleToInsert: ArtisanGoldSaleInsert = {
        artisan_id: sale.artisan_id,
        date_vente: sale.date_vente || new Date().toISOString().split('T')[0],
        quantite_grammes: sale.quantite_grammes,
        type_or: sale.type_or,
        purete_karat: sale.purete_karat,
        prix_kg_fcfa: sale.prix_kg_fcfa,
        montant_brut_fcfa: sale.montant_brut_fcfa,
        tva_taux: sale.tva_taux ?? 18.00,
        tva_montant_fcfa: sale.tva_montant_fcfa,
        taxe_dev_comm_taux: sale.taxe_dev_comm_taux ?? 1.00,
        taxe_dev_comm_montant_fcfa: sale.taxe_dev_comm_montant_fcfa,
        montant_total_fcfa: sale.montant_total_fcfa,
        numero_recu: numeroRecu,
        observations: sale.observations,
        statut: sale.statut || 'en_attente',
        created_by: user?.id,
      };

      const { data, error } = await supabase
        .from('snp_artisan_ventes_or')
        .insert(saleToInsert)
        .select()
        .single();

      if (error) throw error;
      return normalizeSale(data);
    } catch (error: any) {
      console.error('Error creating gold sale:', error);
      throw new Error(error.message || 'Impossible d\'enregistrer la vente');
    }
  },

  async update(id: string, updates: Partial<ArtisanGoldSale>): Promise<ArtisanGoldSale> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: existingVente, error: fetchError } = await supabase
        .from('snp_artisan_ventes_or')
        .select('statut')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      if (existingVente?.statut && ['validee', 'payee'].includes(existingVente.statut)) {
        throw new Error('Impossible de modifier une vente validée ou payée');
      }

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
      return normalizeSale(data);
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
    // La base applique le même arrondi au centime dans son trigger d'intégrité.
    // Garder cette règle ici évite un écart visuel avant l'enregistrement.
    const arrondir = (valeur: number) => Math.round((valeur + Number.EPSILON) * 100) / 100;
    const montant_brut = arrondir((quantite_grammes / 1000) * prix_kg_fcfa);
    const tva_montant = arrondir(montant_brut * (tva_taux / 100));
    const taxe_dev_comm_montant = arrondir(montant_brut * (taxe_dev_comm_taux / 100));
    const montant_total = arrondir(montant_brut + tva_montant + taxe_dev_comm_montant);

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
