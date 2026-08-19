import { supabase } from '@/lib/supabase';

const BUCKET = 'mining-company-documents';

export interface MiningCompanyDocument {
  id: string;
  mining_company_id: string;
  doc_type: string | null;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

/** Documents catégorisables joints à une société minière. */
export const MINING_COMPANY_DOC_TYPES = [
  { value: 'rccm', label: 'RCCM' },
  { value: 'ifu', label: 'IFU / Attestation fiscale' },
  { value: 'autorisation', label: "Autorisation / Permis d'exploitation" },
  { value: 'statuts', label: 'Statuts de la société' },
  { value: 'autre', label: 'Autre document' },
] as const;

export const miningCompanyDocumentService = {
  async list(companyId: string): Promise<MiningCompanyDocument[]> {
    const { data, error } = await supabase
      .from('mining_company_documents')
      .select('*')
      .eq('mining_company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async upload(companyId: string, file: File, docType: string): Promise<MiningCompanyDocument> {
    const { data: userData } = await supabase.auth.getUser();
    const safeName = file.name.replace(/[^\w.\-]+/g, '_');
    const path = `${companyId}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false });
    if (uploadError) throw uploadError;

    const { data, error } = await supabase
      .from('mining_company_documents')
      .insert({
        mining_company_id: companyId,
        doc_type: docType || null,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        mime_type: file.type || null,
        uploaded_by: userData.user?.id ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async remove(doc: Pick<MiningCompanyDocument, 'id' | 'file_path'>): Promise<void> {
    await supabase.storage.from(BUCKET).remove([doc.file_path]);
    const { error } = await supabase.from('mining_company_documents').delete().eq('id', doc.id);
    if (error) throw error;
  },

  /** URL signée (bucket privé) valable 1h pour consulter/télécharger un document. */
  async getSignedUrl(filePath: string): Promise<string | null> {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(filePath, 3600);
    if (error) {
      console.error('[miningCompanyDocumentService] signed url failed:', error);
      return null;
    }
    return data?.signedUrl ?? null;
  },
};
