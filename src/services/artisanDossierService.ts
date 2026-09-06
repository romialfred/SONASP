import { supabase } from '@/lib/supabase';
import {
  artisanDossierPayload,
  type ArtisanFormValues,
  type ArtisanDossier,
} from '@/lib/artisanDossier';
import type { Json } from '@/types/database';

export interface ExploitantOption {
  id: string;
  nom: string | null;
  prenoms: string | null;
  raison_sociale: string | null;
  type_personne: 'physique' | 'morale';
  numero_carte: string | null;
  artisanal_site_id: string | null;
  site_name: string | null;
}
export const artisanDossierService = {
  async save(
    values: ArtisanFormValues,
    options: {
      id: string | null;
      creationId: string;
      expectedUpdatedAt: string | null;
      confirmTransition?: boolean;
    },
  ): Promise<ArtisanDossier> {
    const payload = artisanDossierPayload(values);
    if ('responsable' in payload) {
      for (const key of [
        'date_delivrance_piece',
        'date_expiration_piece',
      ] as const) {
        if (!payload.responsable[key])
          Object.assign(payload.responsable, { [key]: null });
      }
    }
    const { data, error } = await supabase.rpc('snp_save_artisan_dossier', {
      p_id: options.id,
      p_creation_id: options.creationId,
      p_expected_updated_at: options.expectedUpdatedAt,
      p_dossier: payload as unknown as Json,
      p_confirm_transition: options.confirmTransition === true,
    });
    if (error) throw new Error(error.message);
    const result = data as unknown as {
      artisan: ArtisanDossier;
      responsable: ArtisanDossier['responsable'];
    };
    if (!result?.artisan?.id)
      throw new Error(
        'L’enregistrement du dossier n’a pas été confirmé. Réessayez.',
      );
    return { ...result.artisan, responsable: result.responsable };
  },
  async searchExploitants(
    query: string,
    excludeId?: string,
  ): Promise<ExploitantOption[]> {
    if (query.trim().length < 2) return [];
    const { data, error } = await supabase.rpc('snp_search_exploitants', {
      p_query: query.trim().slice(0, 100),
      p_exclude_id: excludeId || null,
    });
    if (error)
      throw new Error(
        'La recherche des exploitants est indisponible. Réessayez.',
      );
    return (data || []) as ExploitantOption[];
  },
  async getExploitant(id: string): Promise<ExploitantOption> {
    const { data, error } = await supabase
      .from('snp_artisans_miniers')
      .select(
        'id,nom,prenoms,raison_sociale,type_personne,numero_carte,artisanal_site_id',
      )
      .eq('id', id)
      .single();
    if (error)
      throw new Error('L’exploitant de rattachement n’est pas accessible.');
    let siteName: string | null = null;
    if (data.artisanal_site_id) {
      const site = await supabase
        .from('artisanal_sites')
        .select('name')
        .eq('id', data.artisanal_site_id)
        .maybeSingle();
      if (site.error)
        throw new Error('Le site de l’exploitant n’est pas accessible.');
      siteName = site.data?.name || null;
    }
    return { ...data, site_name: siteName };
  },
};
