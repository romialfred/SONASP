import { supabase } from '@/lib/supabase';

export type StatutTraitementInfraction = 'en_cours' | 'cloture';
export type ConclusionInfraction = 'reconnu' | 'soupçonne' | 'complice' | 'innocente';

export interface ArtisanInfraction {
  id: string;
  artisan_id: string;
  date_infraction: string;
  type_infraction: string;
  description: string;
  lieu?: string;
  statut_traitement: StatutTraitementInfraction;
  conclusion?: ConclusionInfraction;
  remarques?: string;
  documents: string[];
  date_cloture?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateInfractionData {
  artisan_id: string;
  date_infraction: string;
  type_infraction: string;
  description: string;
  lieu?: string;
  statut_traitement: StatutTraitementInfraction;
  conclusion?: ConclusionInfraction;
  remarques?: string;
  documents?: string[];
  date_cloture?: string;
}

class ArtisanInfractionsService {
  async getByArtisanId(artisanId: string): Promise<ArtisanInfraction[]> {
    const { data, error } = await supabase
      .from('snp_artisan_infractions')
      .select('*')
      .eq('artisan_id', artisanId)
      .order('date_infraction', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getById(id: string): Promise<ArtisanInfraction | null> {
    const { data, error } = await supabase
      .from('snp_artisan_infractions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async create(infraction: CreateInfractionData): Promise<ArtisanInfraction> {
    const { data: userData } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('snp_artisan_infractions')
      .insert({
        ...infraction,
        created_by: userData?.user?.id,
        documents: infraction.documents || [],
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: string, updates: Partial<CreateInfractionData>): Promise<ArtisanInfraction> {
    const { data, error } = await supabase
      .from('snp_artisan_infractions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('snp_artisan_infractions')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async uploadDocument(file: File, infractionId: string): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${infractionId}/${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('snp-infraction-documents')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('snp-infraction-documents')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  }

  async getStatistics(artisanId: string) {
    const infractions = await this.getByArtisanId(artisanId);

    return {
      total: infractions.length,
      en_cours: infractions.filter(i => i.statut_traitement === 'en_cours').length,
      cloture: infractions.filter(i => i.statut_traitement === 'cloture').length,
      reconnu: infractions.filter(i => i.conclusion === 'reconnu').length,
      soupçonne: infractions.filter(i => i.conclusion === 'soupçonne').length,
      complice: infractions.filter(i => i.conclusion === 'complice').length,
      innocente: infractions.filter(i => i.conclusion === 'innocente').length,
    };
  }
}

export const artisanInfractionsService = new ArtisanInfractionsService();
