import { supabase } from '@/lib/supabase';

export interface SaleDocument {
  type: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  available: boolean;
  generatedDate?: string;
  documentId?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
}

type StoredSaleDocument = {
  id: string;
  sale_id: string;
  document_name: string;
  document_number: string | null;
  document_type: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  status: string | null;
  created_at: string | null;
};

const PRESENTATION_BY_TYPE: Record<
  string,
  Pick<SaleDocument, 'icon' | 'color' | 'bgColor'>
> = {
  invoice: {
    icon: 'Receipt',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200',
  },
  assay_certificate: {
    icon: 'FlaskConical',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 hover:bg-purple-100 border-purple-200',
  },
  packing_list: {
    icon: 'Package',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
  },
  bullion_summary: {
    icon: 'Gem',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 hover:bg-amber-100 border-amber-200',
  },
};

const DEFAULT_PRESENTATION = {
  icon: 'FileText',
  color: 'text-slate-600',
  bgColor: 'bg-slate-50 hover:bg-slate-100 border-slate-200',
};

const isAbsoluteUrl = (value: string) => /^https?:\/\//i.test(value);

const fileNameFromPath = (path: string) => {
  const segment = path.split('/').pop();
  return segment ? decodeURIComponent(segment) : undefined;
};

/**
 * Retourne uniquement les pièces explicitement rattachées à la vente.
 *
 * L'ancienne implémentation associait les derniers documents du vendeur, ce
 * qui pouvait exposer la pièce d'une autre opération. Aucun document synthétique
 * n'est ajouté : une liste vide signifie réellement qu'aucune pièce n'est liée.
 */
export async function getSaleDocuments(
  saleId: string
): Promise<{ success: boolean; data?: SaleDocument[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('sales_documents')
      .select(
        'id, sale_id, document_name, document_number, document_type, file_url, file_size, mime_type, status, created_at'
      )
      .eq('sale_id', saleId)
      .order('created_at', { ascending: false });

    if (error) return { success: false, error: error.message };

    const documents = ((data || []) as StoredSaleDocument[]).map((document) => {
      const presentation = PRESENTATION_BY_TYPE[document.document_type] || DEFAULT_PRESENTATION;
      return {
        type: document.document_type,
        label: document.document_name,
        description: document.document_number
          ? `Référence ${document.document_number}`
          : 'Pièce rattachée à cette vente',
        ...presentation,
        available: Boolean(document.file_url) && document.status !== 'archived',
        generatedDate: document.created_at || undefined,
        documentId: document.id,
        fileUrl: isAbsoluteUrl(document.file_url) ? document.file_url : undefined,
        fileName: fileNameFromPath(document.file_url),
        fileSize: document.file_size || undefined,
      } satisfies SaleDocument;
    });

    return { success: true, data: documents };
  } catch (error: unknown) {
    console.error('Error fetching sale documents:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Impossible de charger les documents de la vente.',
    };
  }
}

/** Télécharge une pièce après avoir vérifié son rattachement à la vente affichée. */
export async function downloadSaleDocument(
  _documentType: string,
  documentId?: string,
  saleId?: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!documentId || !saleId) {
    return { success: false, error: 'Référence de document incomplète.' };
  }

  try {
    const { data, error } = await supabase
      .from('sales_documents')
      .select('file_url, status')
      .eq('id', documentId)
      .eq('sale_id', saleId)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!data?.file_url || data.status === 'archived') {
      return { success: false, error: 'Document introuvable ou indisponible.' };
    }

    if (isAbsoluteUrl(data.file_url)) return { success: true, url: data.file_url };

    const { data: signedUrl, error: storageError } = await supabase.storage
      .from('sales-documents')
      .createSignedUrl(data.file_url, 300);

    if (storageError || !signedUrl?.signedUrl) {
      return {
        success: false,
        error: storageError?.message || 'Impossible de signer le lien du document.',
      };
    }

    return { success: true, url: signedUrl.signedUrl };
  } catch (error: unknown) {
    console.error('Error downloading sale document:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Impossible de télécharger ce document.',
    };
  }
}
