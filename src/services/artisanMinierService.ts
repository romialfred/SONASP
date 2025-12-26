import { supabase } from '@/lib/supabase';

export interface ArtisanMinier {
  id: string;
  numero_carte: string;
  type_personne: 'physique' | 'morale';
  type_artisan: 'exploitant' | 'collecteur' | 'intermediaire' | 'fournisseur';

  nom?: string;
  prenoms?: string;
  date_naissance?: string;
  lieu_naissance?: string;
  sexe?: 'M' | 'F' | 'Autre';
  nationalite?: string;

  raison_sociale?: string;
  numero_registre_commerce?: string;

  telephone: string;
  telephone_secondaire?: string;
  email?: string;
  adresse_complete: string;
  commune?: string;
  region?: string;

  type_piece_identite?: 'cni' | 'passeport' | 'permis_conduire' | 'attestation_identite';
  numero_piece_identite?: string;
  date_delivrance_piece?: string;
  date_expiration_piece?: string;
  lieu_delivrance_piece?: string;
  piece_identite_url?: string;

  photo_url?: string;

  site_exploitation?: string;
  mining_company_id?: string;
  collecteur_id?: string;

  observations?: string;

  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
}

export interface CarteStatistics {
  carte_id: string;
  artisan_id: string;
  annee: number;
  mois: number;
  nombre_ventes: number;
  montant_total_ventes: number;
  quantite_totale_grammes: number;
  quantite_totale_onces: number;
  nombre_collectes: number;
  nombre_depots: number;
  nombre_transactions: number;
  jours_actifs: number;
  derniere_activite: string;
}

export const artisanMinierService = {
  async getAll() {
    const { data, error } = await supabase
      .from('SNP_artisans_miniers')
      .select(`
        *,
        mining_company:mining_companies(id, name),
        collecteur:SNP_artisans_miniers!SNP_artisans_miniers_collecteur_id_fkey(id, nom, prenoms, numero_carte)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('SNP_artisans_miniers')
      .select(`
        *,
        mining_company:mining_companies(id, name),
        collecteur:SNP_artisans_miniers!SNP_artisans_miniers_collecteur_id_fkey(id, nom, prenoms, numero_carte),
        carte:SNP_cartes_professionnelles(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async getByNumeroCarte(numeroCarte: string) {
    const { data, error } = await supabase
      .from('SNP_artisans_miniers')
      .select(`
        *,
        mining_company:mining_companies(id, name),
        carte:SNP_cartes_professionnelles(*)
      `)
      .eq('numero_carte', numeroCarte)
      .single();

    if (error) throw error;
    return data;
  },

  async getByTypeArtisan(typeArtisan: string) {
    const { data, error } = await supabase
      .from('SNP_artisans_miniers')
      .select(`
        *,
        mining_company:mining_companies(id, name),
        carte:SNP_cartes_professionnelles(*)
      `)
      .eq('type_artisan', typeArtisan)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getCollecteurs() {
    const { data, error } = await supabase
      .from('SNP_artisans_miniers')
      .select('id, nom, prenoms, numero_carte, telephone')
      .eq('type_artisan', 'collecteur')
      .order('nom');

    if (error) throw error;
    return data;
  },

  async create(artisan: Partial<ArtisanMinier>) {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('SNP_artisans_miniers')
      .insert([
        {
          ...artisan,
          created_by: user?.id,
          updated_by: user?.id
        }
      ])
      .select(`
        *,
        carte:SNP_cartes_professionnelles(*)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<ArtisanMinier>) {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('SNP_artisans_miniers')
      .update({
        ...updates,
        updated_by: user?.id
      })
      .eq('id', id)
      .select(`
        *,
        carte:SNP_cartes_professionnelles(*)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('SNP_artisans_miniers')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async uploadPhoto(artisanId: string, file: File) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${artisanId}-${Date.now()}.${fileExt}`;
    const filePath = `artisans-photos/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('artisan-documents')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('artisan-documents')
      .getPublicUrl(filePath);

    await this.update(artisanId, { photo_url: publicUrl });

    return publicUrl;
  },

  async uploadDocument(artisanId: string, file: File, documentType: string) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${artisanId}-${documentType}-${Date.now()}.${fileExt}`;
    const filePath = `artisans-documents/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('artisan-documents')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('artisan-documents')
      .getPublicUrl(filePath);

    const { data: { user } } = await supabase.auth.getUser();

    const { error: docError } = await supabase
      .from('SNP_artisan_documents')
      .insert([
        {
          artisan_id: artisanId,
          type_document: documentType,
          nom_document: file.name,
          document_url: publicUrl,
          document_type: file.type,
          document_size: file.size,
          uploaded_by: user?.id
        }
      ]);

    if (docError) throw docError;

    return publicUrl;
  },

  async getDocuments(artisanId: string) {
    const { data, error } = await supabase
      .from('SNP_artisan_documents')
      .select('*')
      .eq('artisan_id', artisanId)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async deleteDocument(documentId: string) {
    const { error } = await supabase
      .from('SNP_artisan_documents')
      .delete()
      .eq('id', documentId);

    if (error) throw error;
  },

  async getActivities(artisanId: string) {
    const { data, error } = await supabase
      .from('SNP_artisan_activities')
      .select('*')
      .eq('artisan_id', artisanId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return data;
  },

  async addActivity(activity: {
    artisan_id: string;
    carte_id?: string;
    type_activite: string;
    description: string;
    montant?: number;
    quantite_grammes?: number;
    quantite_onces?: number;
    reference_type?: string;
    reference_id?: string;
    site?: string;
    mining_company_id?: string;
  }) {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('SNP_artisan_activities')
      .insert([
        {
          ...activity,
          created_by: user?.id
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getStatistics(carteId: string) {
    const { data, error } = await supabase
      .from('SNP_carte_statistics')
      .select('*')
      .eq('carte_id', carteId)
      .order('annee', { ascending: false })
      .order('mois', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getStatisticsSummary(artisanId: string) {
    const { data, error } = await supabase
      .from('SNP_carte_statistics')
      .select('*')
      .eq('artisan_id', artisanId)
      .order('annee', { ascending: false })
      .order('mois', { ascending: false })
      .limit(12);

    if (error) throw error;

    const summary = {
      total_ventes: 0,
      total_montant: 0,
      total_grammes: 0,
      total_onces: 0,
      total_collectes: 0,
      total_depots: 0,
      total_transactions: 0
    };

    if (data) {
      data.forEach(stat => {
        summary.total_ventes += stat.nombre_ventes || 0;
        summary.total_montant += parseFloat(stat.montant_total_ventes as any) || 0;
        summary.total_grammes += parseFloat(stat.quantite_totale_grammes as any) || 0;
        summary.total_onces += parseFloat(stat.quantite_totale_onces as any) || 0;
        summary.total_collectes += stat.nombre_collectes || 0;
        summary.total_depots += stat.nombre_depots || 0;
        summary.total_transactions += stat.nombre_transactions || 0;
      });
    }

    return summary;
  },

  async searchArtisans(query: string) {
    const { data, error } = await supabase
      .from('SNP_artisans_miniers')
      .select(`
        *,
        mining_company:mining_companies(id, name),
        carte:SNP_cartes_professionnelles(*)
      `)
      .or(`nom.ilike.%${query}%,prenoms.ilike.%${query}%,numero_carte.ilike.%${query}%,telephone.ilike.%${query}%,raison_sociale.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    return data;
  }
};
