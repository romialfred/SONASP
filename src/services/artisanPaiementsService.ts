import { supabase } from '@/lib/supabase';

export interface FactureDefinitive {
  id?: string;
  numero_facture: string;
  vente_or_id: string;
  artisan_id: string;
  montant_brut: number;
  montant_taxe_tva: number;
  montant_taxe_retenue_source: number;
  montant_autres_taxes: number;
  montant_total_taxes: number;
  montant_net_a_payer: number;
  taux_tva: number;
  taux_retenue_source: number;
  date_emission: string;
  date_echeance?: string;
  statut: 'emise' | 'en_paiement' | 'payee' | 'annulee';
  pdf_url?: string;
  notes?: string;
  emise_par?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PaiementArtisan {
  id?: string;
  reference_paiement: string;
  facture_id: string;
  vente_or_id: string;
  artisan_id: string;
  type_paiement: 'virement_bancaire' | 'cash' | 'orange_money' | 'mobile_money' | 'moov_money' | 'wave' | 'cheque';
  montant_paye: number;
  montant_taxes_retenues: number;
  details_paiement: any;
  statut: 'en_attente' | 'en_traitement' | 'valide' | 'complete' | 'annule' | 'echec';
  date_paiement: string;
  date_validation?: string;
  date_completion?: string;
  preuve_paiement_url?: string;
  recu_paiement_url?: string;
  traite_par?: string;
  valide_par?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TaxeRetenue {
  id?: string;
  paiement_id: string;
  facture_id: string;
  vente_or_id: string;
  artisan_id: string;
  type_taxe: 'tva' | 'retenue_source' | 'taxe_municipale' | 'taxe_regionale' | 'autre';
  libelle_taxe: string;
  taux_taxe: number;
  montant_taxe: number;
  compte_comptable?: string;
  reference_comptable?: string;
  statut_reversement: 'a_reverser' | 'en_cours' | 'reverse' | 'comptabilise';
  date_reversement?: string;
  reversement_reference?: string;
  periode_fiscale?: string;
  exercice_fiscal?: string;
  created_at?: string;
  updated_at?: string;
}

export interface VenteEnAttentePaiement {
  vente_id: string;
  reference_vente: string;
  date_vente: string;
  artisan_id: string;
  artisan_nom_complet: string;
  numero_carte: string;
  telephone: string;
  facture_id: string | null;
  numero_facture: string | null;
  montant_net_a_payer: number | null;
  date_facture: string | null;
  statut_paiement: string;
  jours_attente: number | null;
}

const artisanPaiementsService = {
  async genererNumeroFacture(): Promise<string> {
    try {
      const { data, error } = await supabase.rpc('generer_numero_facture');

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erreur génération numéro facture:', error);
      throw error;
    }
  },

  async genererReferencePaiement(): Promise<string> {
    try {
      const { data, error } = await supabase.rpc('generer_reference_paiement');

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erreur génération référence paiement:', error);
      throw error;
    }
  },

  async calculerTaxes(
    montantBrut: number,
    tauxTva: number = 18.0,
    tauxRetenue: number = 1.5
  ): Promise<{
    montant_tva: number;
    montant_retenue_source: number;
    montant_total_taxes: number;
    montant_net: number;
  }> {
    try {
      const { data, error } = await supabase.rpc('calculer_taxes_vente', {
        p_montant_brut: montantBrut,
        p_taux_tva: tauxTva,
        p_taux_retenue_source: tauxRetenue
      });

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('Erreur calcul taxes:', error);

      const montantTva = Math.round(montantBrut * tauxTva) / 100;
      const montantRetenue = Math.round(montantBrut * tauxRetenue) / 100;
      const totalTaxes = montantTva + montantRetenue;

      return {
        montant_tva: montantTva,
        montant_retenue_source: montantRetenue,
        montant_total_taxes: totalTaxes,
        montant_net: montantBrut - totalTaxes
      };
    }
  },

  async creerFactureDefinitive(facture: Partial<FactureDefinitive>): Promise<FactureDefinitive> {
    try {
      const numeroFacture = await this.genererNumeroFacture();

      const { data, error } = await supabase
        .from('snp_artisan_factures_definitives')
        .insert({
          ...facture,
          numero_facture: numeroFacture
        })
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from('snp_artisan_ventes_or')
        .update({
          statut_paiement: 'facture_emise',
          facture_definitive_id: data.id
        })
        .eq('id', facture.vente_or_id);

      return data;
    } catch (error) {
      console.error('Erreur création facture définitive:', error);
      throw error;
    }
  },

  async getFactureByVenteId(venteId: string): Promise<FactureDefinitive | null> {
    try {
      const { data, error } = await supabase
        .from('snp_artisan_factures_definitives')
        .select('*')
        .eq('vente_or_id', venteId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erreur récupération facture:', error);
      throw error;
    }
  },

  async getVentesEnAttentePaiement(): Promise<VenteEnAttentePaiement[]> {
    try {
      const { data, error } = await supabase
        .from('snp_artisan_ventes_or')
        .select(`
          id,
          numero_recu,
          date_vente,
          artisan_id,
          montant_total_fcfa,
          statut,
          facture_definitive_id,
          artisan:snp_artisans_miniers!inner(
            nom,
            prenoms,
            raison_sociale,
            numero_carte,
            telephone
          )
        `)
        .eq('statut', 'validee')
        .order('date_vente', { ascending: true });

      if (error) throw error;

      const ventesWithFactures = await Promise.all(
        (data || []).map(async (vente: any) => {
          let facture = null;
          if (vente.facture_definitive_id) {
            const { data: factureData } = await supabase
              .from('snp_artisan_factures_definitives')
              .select('id, numero_facture, montant_net_a_payer, date_emission, statut')
              .eq('id', vente.facture_definitive_id)
              .maybeSingle();

            facture = factureData;
          }

          const artisan = vente.artisan;
          const nomComplet = artisan.raison_sociale || `${artisan.nom || ''} ${artisan.prenoms || ''}`.trim();

          const dateVente = new Date(vente.date_vente);
          const today = new Date();
          const diffTime = Math.abs(today.getTime() - dateVente.getTime());
          const joursAttente = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          return {
            vente_id: vente.id,
            reference_vente: vente.numero_recu || `VENTE-${vente.id.slice(0, 8)}`,
            date_vente: vente.date_vente,
            artisan_id: vente.artisan_id,
            artisan_nom_complet: nomComplet,
            numero_carte: artisan.numero_carte,
            telephone: artisan.telephone || '',
            facture_id: facture?.id || vente.facture_definitive_id,
            numero_facture: facture?.numero_facture || null,
            montant_net_a_payer: facture?.montant_net_a_payer || vente.montant_total_fcfa,
            date_facture: facture?.date_emission || null,
            statut_paiement: facture ? (facture.statut === 'payee' ? 'paye' : 'facture_emise') : 'non_paye',
            jours_attente: joursAttente
          };
        })
      );

      return ventesWithFactures;
    } catch (error) {
      console.error('Erreur récupération ventes en attente:', error);
      throw error;
    }
  },

  async creerPaiement(paiement: Partial<PaiementArtisan>): Promise<PaiementArtisan> {
    try {
      const referencePaiement = await this.genererReferencePaiement();

      const { data, error } = await supabase
        .from('snp_artisan_paiements')
        .insert({
          ...paiement,
          reference_paiement: referencePaiement
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erreur création paiement:', error);
      throw error;
    }
  },

  async updatePaiementStatut(
    paiementId: string,
    statut: PaiementArtisan['statut'],
    userId?: string
  ): Promise<void> {
    try {
      const updateData: any = { statut };

      if (statut === 'valide') {
        updateData.date_validation = new Date().toISOString();
        updateData.valide_par = userId;
      } else if (statut === 'complete') {
        updateData.date_completion = new Date().toISOString();
      }

      const { error } = await supabase
        .from('snp_artisan_paiements')
        .update(updateData)
        .eq('id', paiementId);

      if (error) throw error;
    } catch (error) {
      console.error('Erreur mise à jour statut paiement:', error);
      throw error;
    }
  },

  async getPaiementsByFactureId(factureId: string): Promise<PaiementArtisan[]> {
    try {
      const { data, error } = await supabase
        .from('snp_artisan_paiements')
        .select('*')
        .eq('facture_id', factureId)
        .order('date_paiement', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erreur récupération paiements:', error);
      throw error;
    }
  },

  async getPaiementsByArtisanId(artisanId: string): Promise<PaiementArtisan[]> {
    try {
      const { data, error } = await supabase
        .from('snp_artisan_paiements')
        .select(`
          *,
          facture:snp_artisan_factures_definitives(*),
          vente:snp_artisan_ventes_or(*),
          artisan:snp_artisans_miniers(nom, prenoms, numero_carte)
        `)
        .eq('artisan_id', artisanId)
        .order('date_paiement', { ascending: false});

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erreur récupération paiements artisan:', error);
      throw error;
    }
  },

  async getAllPaiements(filters?: {
    statut?: string;
    type_paiement?: string;
    date_debut?: string;
    date_fin?: string;
  }): Promise<PaiementArtisan[]> {
    try {
      let query = supabase
        .from('snp_artisan_paiements')
        .select(`
          *,
          facture:snp_artisan_factures_definitives(*),
          vente:snp_artisan_ventes_or(reference_vente, date_vente),
          artisan:snp_artisans_miniers(nom, prenoms, numero_carte, telephone)
        `);

      if (filters?.statut) {
        query = query.eq('statut', filters.statut);
      }

      if (filters?.type_paiement) {
        query = query.eq('type_paiement', filters.type_paiement);
      }

      if (filters?.date_debut) {
        query = query.gte('date_paiement', filters.date_debut);
      }

      if (filters?.date_fin) {
        query = query.lte('date_paiement', filters.date_fin);
      }

      const { data, error } = await query.order('date_paiement', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erreur récupération tous les paiements:', error);
      throw error;
    }
  },

  async getTaxesRetenues(filters?: {
    statut_reversement?: string;
    type_taxe?: string;
    periode_fiscale?: string;
  }): Promise<TaxeRetenue[]> {
    try {
      let query = supabase
        .from('snp_artisan_taxes_retenues')
        .select('*');

      if (filters?.statut_reversement) {
        query = query.eq('statut_reversement', filters.statut_reversement);
      }

      if (filters?.type_taxe) {
        query = query.eq('type_taxe', filters.type_taxe);
      }

      if (filters?.periode_fiscale) {
        query = query.eq('periode_fiscale', filters.periode_fiscale);
      }

      const { data, error } = await query.order('periode_fiscale', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erreur récupération taxes retenues:', error);
      throw error;
    }
  },

  async updateTaxeStatutReversement(
    taxeId: string,
    statutReversement: TaxeRetenue['statut_reversement'],
    reversementReference?: string
  ): Promise<void> {
    try {
      const updateData: any = {
        statut_reversement: statutReversement
      };

      if (statutReversement === 'reverse') {
        updateData.date_reversement = new Date().toISOString();
        if (reversementReference) {
          updateData.reversement_reference = reversementReference;
        }
      }

      const { error} = await supabase
        .from('snp_artisan_taxes_retenues')
        .update(updateData)
        .eq('id', taxeId);

      if (error) throw error;
    } catch (error) {
      console.error('Erreur mise à jour statut reversement taxe:', error);
      throw error;
    }
  },

  async getResumePaiementsArtisan(artisanId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('v_artisan_paiements_resume')
        .select('*')
        .eq('artisan_id', artisanId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erreur récupération résumé paiements artisan:', error);
      throw error;
    }
  },

  async getTaxesAReverser(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('v_taxes_a_reverser')
        .select('*')
        .eq('statut_reversement', 'a_reverser');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erreur récupération taxes à reverser:', error);
      throw error;
    }
  },

  async getDashboardStats(): Promise<{
    total_ventes_en_attente: number;
    montant_total_a_payer: number;
    paiements_en_cours: number;
    paiements_completes: number;
    total_taxes_retenues: number;
    taxes_a_reverser: number;
  }> {
    try {
      const [ventesEnAttente, paiements, taxes] = await Promise.all([
        this.getVentesEnAttentePaiement(),
        this.getAllPaiements(),
        this.getTaxesRetenues()
      ]);

      const paiementsEnCours = paiements.filter(
        p => ['en_attente', 'en_traitement', 'valide'].includes(p.statut)
      );
      const paiementsCompletes = paiements.filter(p => p.statut === 'complete');
      const taxesAReverser = taxes.filter(t => t.statut_reversement === 'a_reverser');

      return {
        total_ventes_en_attente: ventesEnAttente.length,
        montant_total_a_payer: ventesEnAttente.reduce(
          (sum, v) => sum + (v.montant_net_a_payer || 0),
          0
        ),
        paiements_en_cours: paiementsEnCours.length,
        paiements_completes: paiementsCompletes.length,
        total_taxes_retenues: taxes.reduce((sum, t) => sum + t.montant_taxe, 0),
        taxes_a_reverser: taxesAReverser.reduce((sum, t) => sum + t.montant_taxe, 0)
      };
    } catch (error) {
      console.error('Erreur récupération stats dashboard:', error);
      throw error;
    }
  }
};

export default artisanPaiementsService;
