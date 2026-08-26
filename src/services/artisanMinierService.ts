import { supabase } from '@/lib/supabase';
import { UPLOAD_POLICIES, validateUploadFile } from '@/lib/uploadValidation';
import { genererNumeroCarte } from './carteNumberService';

export interface ArtisanMinier {
  id: string;
  /** Nullable en base : la carte est attribuée après enregistrement. */
  numero_carte: string | null;
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
  adresse?: string;
  commune?: string;
  region?: string;
  pays?: string;

  type_piece_identite?: 'CNI' | 'Passeport' | 'Permis' | 'Autre';
  numero_piece_identite?: string;
  date_delivrance_piece?: string;
  date_expiration_piece?: string;
  lieu_delivrance_piece?: string;
  piece_identite_url?: string;

  photo_url?: string;

  collecteur_id?: string;

  observations?: string;

  actif?: boolean;
  desactive_le?: string;
  desactive_par?: string;
  motif_desactivation?: string;

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
      .from('snp_artisans_miniers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('snp_artisans_miniers')
      .select(`
        *,
        carte:snp_cartes_professionnelles(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async getByNumeroCarte(numeroCarte: string) {
    const { data, error } = await supabase
      .from('snp_artisans_miniers')
      .select(`
        *,
        carte:snp_cartes_professionnelles(*)
      `)
      .eq('numero_carte', numeroCarte)
      .single();

    if (error) throw error;
    return data;
  },

  async getByTypeArtisan(typeArtisan: string) {
    const { data, error } = await supabase
      .from('snp_artisans_miniers')
      .select(`
        *,
        carte:snp_cartes_professionnelles(*)
      `)
      .eq('type_artisan', typeArtisan)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getCollecteurs() {
    const { data, error } = await supabase
      .from('snp_artisans_miniers')
      .select('id, nom, prenoms, numero_carte, telephone')
      .eq('type_artisan', 'collecteur')
      .order('nom');

    if (error) throw error;
    return data;
  },

  async create(artisan: Partial<ArtisanMinier>) {
    const { data: { user } } = await supabase.auth.getUser();

    // Le numero est frappe cote application, au format BF-AM-AAAA-XZTM-NNNN.
    // Le declencheur de base ne s'applique que si le numero est absent : le fournir
    // ici garantit le format meme sur une base ou la migration n'est pas encore passee.
    const numeroCarte = artisan.numero_carte || (await genererNumeroCarte());

    const { data, error } = await supabase
      .from('snp_artisans_miniers')
      .insert([
        {
          ...artisan,
          numero_carte: numeroCarte,
          created_by: user?.id,
          updated_by: user?.id
        }
      ])
      .select(`
        *,
        carte:snp_cartes_professionnelles(*)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<ArtisanMinier>) {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('snp_artisans_miniers')
      .update({
        ...updates,
        updated_by: user?.id
      })
      .eq('id', id)
      .select(`
        *,
        carte:snp_cartes_professionnelles(*)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('snp_artisans_miniers')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async uploadPhoto(artisanId: string, file: File) {
    const validatedFile = validateUploadFile(file, UPLOAD_POLICIES.artisanPhoto);
    const fileName = `${artisanId}-${crypto.randomUUID()}.${validatedFile.extension}`;
    const filePath = `artisans-photos/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('artisan-documents')
      .upload(filePath, file, { contentType: validatedFile.mimeType, upsert: false });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('artisan-documents')
      .getPublicUrl(filePath);

    await this.update(artisanId, { photo_url: publicUrl });

    return publicUrl;
  },

  async uploadDocument(artisanId: string, file: File, documentType: string) {
    const policy = documentType === 'photo'
      ? UPLOAD_POLICIES.artisanPhoto
      : UPLOAD_POLICIES.artisanDocument;
    const validatedFile = validateUploadFile(file, policy);
    const fileName = `${artisanId}-${crypto.randomUUID()}.${validatedFile.extension}`;
    const filePath = `artisans-documents/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('artisan-documents')
      .upload(filePath, file, { contentType: validatedFile.mimeType, upsert: false });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('artisan-documents')
      .getPublicUrl(filePath);

    const { data: { user } } = await supabase.auth.getUser();

    const { error: docError } = await supabase
      .from('snp_artisan_documents')
      .insert([
        {
          artisan_id: artisanId,
          type_document: documentType,
          nom_document: file.name,
          document_url: publicUrl,
          document_type: validatedFile.mimeType,
          document_size: file.size,
          uploaded_by: user?.id
        }
      ]);

    if (docError) throw docError;

    return publicUrl;
  },

  async getDocuments(artisanId: string) {
    const { data, error } = await supabase
      .from('snp_artisan_documents')
      .select('*')
      .eq('artisan_id', artisanId)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async deleteDocument(documentId: string) {
    const { error } = await supabase
      .from('snp_artisan_documents')
      .delete()
      .eq('id', documentId);

    if (error) throw error;
  },

  async getActivities(artisanId: string) {
    const { data, error } = await supabase
      .from('snp_artisan_activities')
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
      .from('snp_artisan_activities')
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
      .from('snp_carte_statistics')
      .select('*')
      .eq('carte_id', carteId)
      .order('annee', { ascending: false })
      .order('mois', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getStatisticsSummary(artisanId: string) {
    const { data, error } = await supabase
      .from('snp_carte_statistics')
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
      .from('snp_artisans_miniers')
      .select(`
        *,
        carte:snp_cartes_professionnelles(*)
      `)
      .or(`nom.ilike.%${query}%,prenoms.ilike.%${query}%,numero_carte.ilike.%${query}%,telephone.ilike.%${query}%,raison_sociale.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    return data;
  },

  async desactiver(artisanId: string, motif: string) {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('snp_artisans_miniers')
      .update({
        actif: false,
        desactive_le: new Date().toISOString(),
        desactive_par: user?.id,
        motif_desactivation: motif
      })
      .eq('id', artisanId)
      .select()
      .single();

    if (error) throw error;

    await this.addActivity({
      artisan_id: artisanId,
      type_activite: 'desactivation',
      description: `Artisan désactivé: ${motif}`
    });

    return data;
  },

  async reactiver(artisanId: string) {
    const { data: { user } } = await supabase.auth.getUser();

    const { data: artisan } = await supabase
      .from('snp_artisans_miniers')
      .select('*')
      .eq('id', artisanId)
      .single();

    if (!artisan) throw new Error('Artisan non trouvé');

    const { data: carteValide } = await supabase
      .from('snp_cartes_professionnelles')
      .select('*')
      .eq('artisan_id', artisanId)
      .in('statut', ['validee', 'en_exploitation'])
      .gte('date_expiration', new Date().toISOString().split('T')[0])
      .single();

    if (!carteValide) {
      throw new Error('Impossible de réactiver: aucune carte professionnelle valide');
    }

    const { data, error } = await supabase
      .from('snp_artisans_miniers')
      .update({
        actif: true,
        desactive_le: null,
        desactive_par: null,
        motif_desactivation: null,
        updated_by: user?.id
      })
      .eq('id', artisanId)
      .select()
      .single();

    if (error) throw error;

    await this.addActivity({
      artisan_id: artisanId,
      type_activite: 'reactivation',
      description: 'Artisan réactivé'
    });

    return data;
  },

  async validateActifPourVente(artisanId: string) {
    const { data: artisan, error } = await supabase
      .from('snp_artisans_miniers')
      .select('actif, motif_desactivation')
      .eq('id', artisanId)
      .single();

    if (error) throw error;
    if (!artisan) throw new Error('Artisan non trouvé');
    if (!artisan.actif) {
      throw new Error(
        `Artisan désactivé: ${artisan.motif_desactivation || 'Raison non spécifiée'}. Ventes et paiements bloqués.`
      );
    }

    const { data: carte } = await supabase
      .from('snp_cartes_professionnelles')
      .select('*')
      .eq('artisan_id', artisanId)
      .in('statut', ['validee', 'en_exploitation'])
      .gte('date_expiration', new Date().toISOString().split('T')[0])
      .single();

    if (!carte) {
      throw new Error('Aucune carte professionnelle valide. Ventes bloquées.');
    }

    return true;
  }
};
