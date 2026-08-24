import { supabase } from '@/lib/supabase';
import { TROY_OZ_GRAMS } from '@/constants/goldConstants';

/** Le poids en onces troy n'est pas stocke : il derive du poids en grammes. */
const gramsToOunces = (grammes?: number | null) => (grammes || 0) / TROY_OZ_GRAMS;

export interface ChiffreAffairesParRegion {
  region: string;
  nombre_ventes: number;
  quantite_totale_grammes: number;
  quantite_totale_onces: number;
  montant_total_brut: number;
  montant_total_taxes: number;
  montant_total_net: number;
  nombre_artisans: number;
}

export interface ChiffreAffairesParArtisan {
  artisan_id: string;
  numero_carte: string;
  nom_complet: string;
  region: string;
  nombre_ventes: number;
  quantite_totale_grammes: number;
  quantite_totale_onces: number;
  montant_total_brut: number;
  montant_total_taxes: number;
  montant_total_net: number;
}

export interface ChiffreAffairesParPeriode {
  periode: string;
  annee: number;
  mois?: number;
  trimestre?: number;
  nombre_ventes: number;
  quantite_totale_grammes: number;
  quantite_totale_onces: number;
  montant_total_brut: number;
  montant_total_taxes: number;
  montant_total_net: number;
  nombre_artisans_actifs: number;
}

export type QuantiteParType = {
  type_or: string;
  nombre_ventes: number;
  quantite_totale_grammes: number;
  quantite_totale_onces: number;
  montant_total: number;
  prix_moyen_gramme: number;
  pourcentage_total: number;
};

export interface RapportTaxesRoyalties {
  periode: string;
  montant_total_ventes: number;
  montant_total_tva: number;
  montant_total_retenue_source: number;
  montant_total_autres_taxes: number;
  montant_total_taxes: number;
  montant_total_royalties: number;
  taux_tva_moyen: number;
  taux_retenue_moyen: number;
  nombre_factures: number;
}

export interface IndicateursCles {
  total_ventes: number;
  total_artisans_actifs: number;
  quantite_totale_grammes: number;
  quantite_totale_onces: number;
  chiffre_affaires_total: number;
  taxes_total: number;
  royalties_total: number;
  prix_moyen_gramme: number;
  ventes_en_attente: number;
  montant_en_attente: number;
}

export class ArtisanAnalyticsService {
  async getIndicateursCles(dateDebut?: string, dateFin?: string): Promise<IndicateursCles> {
    try {
      let queryVentes = supabase
        .from('snp_artisan_ventes_or')
        .select('*', { count: 'exact' });

      if (dateDebut) {
        queryVentes = queryVentes.gte('date_vente', dateDebut);
      }
      if (dateFin) {
        queryVentes = queryVentes.lte('date_vente', dateFin);
      }

      const { data: ventes, error: ventesError, count } = await queryVentes;

      if (ventesError) throw ventesError;

      const ventesValidees = ventes?.filter(v => v.statut === 'validee') || [];
      const ventesEnAttente = ventes?.filter(v => v.statut === 'en_attente') || [];

      const artisansActifs = new Set(ventesValidees.map(v => v.artisan_id)).size;
      const quantiteTotaleGrammes = ventesValidees.reduce((sum, v) => sum + (v.quantite_grammes || 0), 0);
      const quantiteTotaleOnces = ventesValidees.reduce((sum, v) => sum + gramsToOunces(v.quantite_grammes), 0);
      const chiffreAffairesTotal = ventesValidees.reduce((sum, v) => sum + (v.montant_total_fcfa || 0), 0);
      const prixMoyenGramme = quantiteTotaleGrammes > 0 ? chiffreAffairesTotal / quantiteTotaleGrammes : 0;
      const montantEnAttente = ventesEnAttente.reduce((sum, v) => sum + (v.montant_total_fcfa || 0), 0);

      let queryFactures = supabase
        .from('snp_artisan_factures_definitives')
        .select('montant_total_taxes, montant_taxe_tva');

      if (dateDebut) {
        queryFactures = queryFactures.gte('date_emission', dateDebut);
      }
      if (dateFin) {
        queryFactures = queryFactures.lte('date_emission', dateFin);
      }

      const { data: factures, error: facturesError } = await queryFactures;

      if (facturesError) throw facturesError;

      const taxesTotal = factures?.reduce((sum, f) => sum + (f.montant_total_taxes || 0), 0) || 0;
      const royaltiesTotal = ventesValidees.reduce(
        (sum, v) => sum + (v.taxe_dev_comm_montant_fcfa || 0),
        0
      );

      return {
        total_ventes: count || 0,
        total_artisans_actifs: artisansActifs,
        quantite_totale_grammes: quantiteTotaleGrammes,
        quantite_totale_onces: quantiteTotaleOnces,
        chiffre_affaires_total: chiffreAffairesTotal,
        taxes_total: taxesTotal,
        royalties_total: royaltiesTotal,
        prix_moyen_gramme: prixMoyenGramme,
        ventes_en_attente: ventesEnAttente.length,
        montant_en_attente: montantEnAttente
      };
    } catch (error) {
      console.error('Erreur getIndicateursCles:', error);
      throw error;
    }
  }

  async getChiffreAffairesParRegion(dateDebut?: string, dateFin?: string): Promise<ChiffreAffairesParRegion[]> {
    try {
      let query = supabase
        .from('snp_artisan_ventes_or')
        .select(`
          *,
          artisan:snp_artisans_miniers!inner(region)
        `)
        .eq('statut', 'validee');

      if (dateDebut) {
        query = query.gte('date_vente', dateDebut);
      }
      if (dateFin) {
        query = query.lte('date_vente', dateFin);
      }

      const { data, error } = await query;

      if (error) throw error;

      const regionsMap = new Map<string, any>();

      data?.forEach((vente: any) => {
        const region = vente.artisan?.region || 'Non spécifiée';

        if (!regionsMap.has(region)) {
          regionsMap.set(region, {
            region,
            nombre_ventes: 0,
            quantite_totale_grammes: 0,
            quantite_totale_onces: 0,
            montant_total_brut: 0,
            montant_total_taxes: 0,
            montant_total_net: 0,
            artisans: new Set()
          });
        }

        const regionData = regionsMap.get(region);
        regionData.nombre_ventes++;
        regionData.quantite_totale_grammes += vente.quantite_grammes || 0;
        regionData.quantite_totale_onces += gramsToOunces(vente.quantite_grammes);
        regionData.montant_total_brut += vente.montant_total_fcfa || 0;
        regionData.artisans.add(vente.artisan_id);
      });

      const queryFactures = supabase
        .from('snp_artisan_factures_definitives')
        .select(`
          *,
          vente:snp_artisan_ventes_or!inner(
            artisan:snp_artisans_miniers!inner(region)
          )
        `)
        .eq('statut', 'emise');

      const { data: factures } = await queryFactures;

      factures?.forEach((facture: any) => {
        const region = facture.vente?.artisan?.region || 'Non spécifiée';
        if (regionsMap.has(region)) {
          const regionData = regionsMap.get(region);
          regionData.montant_total_taxes += facture.montant_total_taxes || 0;
          regionData.montant_total_net += facture.montant_net_a_payer || 0;
        }
      });

      return Array.from(regionsMap.values()).map(r => ({
        ...r,
        nombre_artisans: r.artisans.size,
        artisans: undefined
      })).sort((a, b) => b.montant_total_brut - a.montant_total_brut);
    } catch (error) {
      console.error('Erreur getChiffreAffairesParRegion:', error);
      throw error;
    }
  }

  async getChiffreAffairesParArtisan(dateDebut?: string, dateFin?: string, region?: string): Promise<ChiffreAffairesParArtisan[]> {
    try {
      let query = supabase
        .from('snp_artisan_ventes_or')
        .select(`
          *,
          artisan:snp_artisans_miniers!inner(numero_carte, nom, prenoms, raison_sociale, region)
        `)
        .eq('statut', 'validee');

      if (dateDebut) {
        query = query.gte('date_vente', dateDebut);
      }
      if (dateFin) {
        query = query.lte('date_vente', dateFin);
      }
      if (region) {
        query = query.eq('artisan.region', region);
      }

      const { data, error } = await query;

      if (error) throw error;

      const artisansMap = new Map<string, any>();

      data?.forEach((vente: any) => {
        const artisanId = vente.artisan_id;

        if (!artisansMap.has(artisanId)) {
          artisansMap.set(artisanId, {
            artisan_id: artisanId,
            numero_carte: vente.artisan?.numero_carte || 'N/A',
            nom_complet:
              vente.artisan?.raison_sociale ||
              `${vente.artisan?.nom || ''} ${vente.artisan?.prenoms || ''}`.trim() ||
              'Artisan sans nom',
            region: vente.artisan?.region || 'Non spécifiée',
            nombre_ventes: 0,
            quantite_totale_grammes: 0,
            quantite_totale_onces: 0,
            montant_total_brut: 0,
            montant_total_taxes: 0,
            montant_total_net: 0
          });
        }

        const artisanData = artisansMap.get(artisanId);
        artisanData.nombre_ventes++;
        artisanData.quantite_totale_grammes += vente.quantite_grammes || 0;
        artisanData.quantite_totale_onces += gramsToOunces(vente.quantite_grammes);
        artisanData.montant_total_brut += vente.montant_total_fcfa || 0;
      });

      const queryFactures = supabase
        .from('snp_artisan_factures_definitives')
        .select('artisan_id, montant_total_taxes, montant_net_a_payer')
        .eq('statut', 'emise');

      const { data: factures } = await queryFactures;

      factures?.forEach((facture: any) => {
        if (artisansMap.has(facture.artisan_id)) {
          const artisanData = artisansMap.get(facture.artisan_id);
          artisanData.montant_total_taxes += facture.montant_total_taxes || 0;
          artisanData.montant_total_net += facture.montant_net_a_payer || 0;
        }
      });

      return Array.from(artisansMap.values())
        .sort((a, b) => b.montant_total_brut - a.montant_total_brut);
    } catch (error) {
      console.error('Erreur getChiffreAffairesParArtisan:', error);
      throw error;
    }
  }

  async getChiffreAffairesParMois(annee: number): Promise<ChiffreAffairesParPeriode[]> {
    try {
      const dateDebut = `${annee}-01-01`;
      const dateFin = `${annee}-12-31`;

      const { data, error } = await supabase
        .from('snp_artisan_ventes_or')
        .select('*')
        .eq('statut', 'validee')
        .gte('date_vente', dateDebut)
        .lte('date_vente', dateFin);

      if (error) throw error;

      const moisMap = new Map<number, any>();

      for (let mois = 1; mois <= 12; mois++) {
        moisMap.set(mois, {
          periode: new Date(annee, mois - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
          annee,
          mois,
          nombre_ventes: 0,
          quantite_totale_grammes: 0,
          quantite_totale_onces: 0,
          montant_total_brut: 0,
          montant_total_taxes: 0,
          montant_total_net: 0,
          artisans: new Set()
        });
      }

      data?.forEach((vente: any) => {
        const dateVente = new Date(vente.date_vente);
        const mois = dateVente.getMonth() + 1;

        const moisData = moisMap.get(mois);
        if (moisData) {
          moisData.nombre_ventes++;
          moisData.quantite_totale_grammes += vente.quantite_grammes || 0;
          moisData.quantite_totale_onces += gramsToOunces(vente.quantite_grammes);
          moisData.montant_total_brut += vente.montant_total_fcfa || 0;
          moisData.artisans.add(vente.artisan_id);
        }
      });

      return Array.from(moisMap.values()).map(m => ({
        ...m,
        nombre_artisans_actifs: m.artisans.size,
        artisans: undefined
      }));
    } catch (error) {
      console.error('Erreur getChiffreAffairesParMois:', error);
      throw error;
    }
  }

  async getChiffreAffairesParTrimestre(annee: number): Promise<ChiffreAffairesParPeriode[]> {
    try {
      const moisData = await this.getChiffreAffairesParMois(annee);

      const trimestres = [
        { numero: 1, mois: [1, 2, 3], nom: 'T1' },
        { numero: 2, mois: [4, 5, 6], nom: 'T2' },
        { numero: 3, mois: [7, 8, 9], nom: 'T3' },
        { numero: 4, mois: [10, 11, 12], nom: 'T4' }
      ];

      return trimestres.map(trimestre => {
        const moisTrimestre = moisData.filter(m => trimestre.mois.includes(m.mois!));

        return {
          periode: `${trimestre.nom} ${annee}`,
          annee,
          trimestre: trimestre.numero,
          nombre_ventes: moisTrimestre.reduce((sum, m) => sum + m.nombre_ventes, 0),
          quantite_totale_grammes: moisTrimestre.reduce((sum, m) => sum + m.quantite_totale_grammes, 0),
          quantite_totale_onces: moisTrimestre.reduce((sum, m) => sum + m.quantite_totale_onces, 0),
          montant_total_brut: moisTrimestre.reduce((sum, m) => sum + m.montant_total_brut, 0),
          montant_total_taxes: moisTrimestre.reduce((sum, m) => sum + m.montant_total_taxes, 0),
          montant_total_net: moisTrimestre.reduce((sum, m) => sum + m.montant_total_net, 0),
          nombre_artisans_actifs: moisTrimestre.reduce((sum, m) => sum + m.nombre_artisans_actifs, 0)
        };
      });
    } catch (error) {
      console.error('Erreur getChiffreAffairesParTrimestre:', error);
      throw error;
    }
  }

  async getChiffreAffairesParAnnee(anneeDebut: number, anneeFin: number): Promise<ChiffreAffairesParPeriode[]> {
    try {
      const annees: ChiffreAffairesParPeriode[] = [];

      for (let annee = anneeDebut; annee <= anneeFin; annee++) {
        const dateDebut = `${annee}-01-01`;
        const dateFin = `${annee}-12-31`;

        const { data, error } = await supabase
          .from('snp_artisan_ventes_or')
          .select('*')
          .eq('statut', 'validee')
          .gte('date_vente', dateDebut)
          .lte('date_vente', dateFin);

        if (error) throw error;

        const artisansActifs = new Set(data?.map(v => v.artisan_id));

        annees.push({
          periode: annee.toString(),
          annee,
          nombre_ventes: data?.length || 0,
          quantite_totale_grammes: data?.reduce((sum, v) => sum + (v.quantite_grammes || 0), 0) || 0,
          quantite_totale_onces: data?.reduce((sum, v) => sum + gramsToOunces(v.quantite_grammes), 0) || 0,
          montant_total_brut: data?.reduce((sum, v) => sum + (v.montant_total_fcfa || 0), 0) || 0,
          montant_total_taxes: 0,
          montant_total_net: 0,
          nombre_artisans_actifs: artisansActifs.size
        });
      }

      return annees;
    } catch (error) {
      console.error('Erreur getChiffreAffairesParAnnee:', error);
      throw error;
    }
  }

  async getQuantiteParType(dateDebut?: string, dateFin?: string): Promise<QuantiteParType[]> {
    try {
      let query = supabase
        .from('snp_artisan_ventes_or')
        .select('*')
        .eq('statut', 'validee');

      if (dateDebut) {
        query = query.gte('date_vente', dateDebut);
      }
      if (dateFin) {
        query = query.lte('date_vente', dateFin);
      }

      const { data, error } = await query;

      if (error) throw error;

      const typesMap = new Map<string, any>();

      data?.forEach((vente: any) => {
        const type = vente.type_or || 'Non spécifié';

        if (!typesMap.has(type)) {
          typesMap.set(type, {
            type_or: type,
            nombre_ventes: 0,
            quantite_totale_grammes: 0,
            quantite_totale_onces: 0,
            montant_total: 0
          });
        }

        const typeData = typesMap.get(type);
        typeData.nombre_ventes++;
        typeData.quantite_totale_grammes += vente.quantite_grammes || 0;
        typeData.quantite_totale_onces += gramsToOunces(vente.quantite_grammes);
        typeData.montant_total += vente.montant_total_fcfa || 0;
      });

      const quantiteTotale = Array.from(typesMap.values()).reduce((sum, t) => sum + t.quantite_totale_grammes, 0);

      return Array.from(typesMap.values()).map(t => ({
        ...t,
        prix_moyen_gramme: t.quantite_totale_grammes > 0 ? t.montant_total / t.quantite_totale_grammes : 0,
        pourcentage_total: quantiteTotale > 0 ? (t.quantite_totale_grammes / quantiteTotale) * 100 : 0
      })).sort((a, b) => b.quantite_totale_grammes - a.quantite_totale_grammes);
    } catch (error) {
      console.error('Erreur getQuantiteParType:', error);
      throw error;
    }
  }

  async getRapportTaxesRoyalties(dateDebut?: string, dateFin?: string, groupBy: 'mois' | 'trimestre' | 'annee' = 'mois'): Promise<RapportTaxesRoyalties[]> {
    try {
      let query = supabase
        .from('snp_artisan_factures_definitives')
        .select('*, vente:snp_artisan_ventes_or(taxe_dev_comm_montant_fcfa)')
        .eq('statut', 'emise');

      if (dateDebut) {
        query = query.gte('date_emission', dateDebut);
      }
      if (dateFin) {
        query = query.lte('date_emission', dateFin);
      }

      const { data, error } = await query;

      if (error) throw error;

      const periodesMap = new Map<string, any>();

      data?.forEach((facture: any) => {
        const dateEmission = new Date(facture.date_emission);
        let periodeKey: string;

        if (groupBy === 'mois') {
          periodeKey = `${dateEmission.getFullYear()}-${String(dateEmission.getMonth() + 1).padStart(2, '0')}`;
        } else if (groupBy === 'trimestre') {
          const trimestre = Math.ceil((dateEmission.getMonth() + 1) / 3);
          periodeKey = `${dateEmission.getFullYear()}-T${trimestre}`;
        } else {
          periodeKey = dateEmission.getFullYear().toString();
        }

        if (!periodesMap.has(periodeKey)) {
          periodesMap.set(periodeKey, {
            periode: periodeKey,
            montant_total_ventes: 0,
            montant_total_tva: 0,
            montant_total_retenue_source: 0,
            montant_total_autres_taxes: 0,
            montant_total_taxes: 0,
            montant_total_royalties: 0,
            nombre_factures: 0,
            total_taux_tva: 0,
            total_taux_retenue: 0
          });
        }

        const periodeData = periodesMap.get(periodeKey);
        periodeData.montant_total_ventes += facture.montant_brut || 0;
        periodeData.montant_total_tva += facture.montant_taxe_tva || 0;
        periodeData.montant_total_retenue_source += facture.montant_taxe_retenue_source || 0;
        periodeData.montant_total_autres_taxes += facture.montant_autres_taxes || 0;
        periodeData.montant_total_taxes += facture.montant_total_taxes || 0;
        periodeData.montant_total_royalties += facture.vente?.taxe_dev_comm_montant_fcfa || 0;
        periodeData.nombre_factures++;
        periodeData.total_taux_tva += facture.taux_tva || 0;
        periodeData.total_taux_retenue += facture.taux_retenue_source || 0;
      });

      return Array.from(periodesMap.values()).map(p => ({
        ...p,
        taux_tva_moyen: p.nombre_factures > 0 ? p.total_taux_tva / p.nombre_factures : 0,
        taux_retenue_moyen: p.nombre_factures > 0 ? p.total_taux_retenue / p.nombre_factures : 0,
        total_taux_tva: undefined,
        total_taux_retenue: undefined
      })).sort((a, b) => a.periode.localeCompare(b.periode));
    } catch (error) {
      console.error('Erreur getRapportTaxesRoyalties:', error);
      throw error;
    }
  }

  async exporterRapportExcel(type: string, donnees: any[]): Promise<Blob> {
    try {
      const { buildExcelWorkbook } = await import('@/lib/excelExport');
      return await buildExcelWorkbook([{ name: type, rows: donnees }]);
    } catch (error) {
      console.error('Erreur exporterRapportExcel:', error);
      throw error;
    }
  }
}

export const artisanAnalyticsService = new ArtisanAnalyticsService();
