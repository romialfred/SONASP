import { supabase } from '@/lib/supabase';
import {
  LicenseRequest,
  LicenseRequestDocument,
  LicenseRequestStatus,
  LicenseRequestFilters,
  DocumentType,
} from '@/types/license';

export interface CreateLicenseRequestData {
  mine_id: string;
  mine_name: string;
  title: string;
  planned_quantity_oz: number;
  planned_start_date?: string;
  planned_end_date?: string;
  comments?: string;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
}

export interface SubmitLicenseRequestData {
  applicant_signatory_name: string;
  applicant_signatory_title?: string;
  applicant_certification_text: string;
}

export interface ReviewLicenseRequestData {
  approved: boolean;
  review_comments?: string;
  rejection_reason?: string;
}

export const licenseRequestService = {
  async createRequest(data: CreateLicenseRequestData): Promise<LicenseRequest> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: request, error } = await supabase
      .from('license_requests')
      .insert({
        ...data,
        status: 'DRAFT',
        request_date: new Date().toISOString().split('T')[0],
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return request;
  },

  async updateRequest(
    id: string,
    data: Partial<CreateLicenseRequestData>
  ): Promise<LicenseRequest> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: request, error } = await supabase
      .from('license_requests')
      .update({
        ...data,
        updated_by: user.id,
      })
      .eq('id', id)
      .eq('status', 'DRAFT')
      .select()
      .single();

    if (error) throw error;
    return request;
  },

  async submitRequest(
    id: string,
    signatureData: SubmitLicenseRequestData
  ): Promise<LicenseRequest> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: request, error } = await supabase
      .from('license_requests')
      .update({
        status: 'SUBMITTED',
        applicant_signatory_name: signatureData.applicant_signatory_name,
        applicant_signatory_title: signatureData.applicant_signatory_title,
        applicant_certification_text: signatureData.applicant_certification_text,
        applicant_signature_date: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', id)
      .eq('status', 'DRAFT')
      .select()
      .single();

    if (error) throw error;
    return request;
  },

  async reviewRequest(
    id: string,
    reviewData: ReviewLicenseRequestData
  ): Promise<LicenseRequest> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'management') {
      throw new Error('Only management can review license requests');
    }

    const newStatus: LicenseRequestStatus = reviewData.approved ? 'APPROVED' : 'REJECTED';

    const { data: request, error } = await supabase
      .from('license_requests')
      .update({
        status: newStatus,
        reviewer_id: user.id,
        reviewer_name: profile.full_name,
        review_date: new Date().toISOString(),
        review_comments: reviewData.review_comments,
        rejection_reason: reviewData.rejection_reason,
        updated_by: user.id,
      })
      .eq('id', id)
      .in('status', ['SUBMITTED', 'IN_REVIEW'])
      .select()
      .single();

    if (error) throw error;
    return request;
  },

  async getRequest(id: string): Promise<LicenseRequest> {
    const { data, error } = await supabase
      .from('license_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async listRequests(filters?: LicenseRequestFilters): Promise<LicenseRequest[]> {
    let query = supabase
      .from('license_requests')
      .select('*')
      .order('request_date', { ascending: false });

    if (filters?.mine_id) {
      query = query.eq('mine_id', filters.mine_id);
    }

    if (filters?.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }

    if (filters?.priority) {
      query = query.eq('priority', filters.priority);
    }

    if (filters?.request_date_from) {
      query = query.gte('request_date', filters.request_date_from);
    }

    if (filters?.request_date_to) {
      query = query.lte('request_date', filters.request_date_to);
    }

    if (filters?.search) {
      query = query.or(
        `request_number.ilike.%${filters.search}%,mine_name.ilike.%${filters.search}%,comments.ilike.%${filters.search}%`
      );
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  async deleteRequest(id: string): Promise<void> {
    const { error } = await supabase
      .from('license_requests')
      .delete()
      .eq('id', id)
      .eq('status', 'DRAFT');

    if (error) throw error;
  },

  async uploadDocument(
    requestId: string,
    file: File,
    title: string,
    documentType: DocumentType,
    description?: string
  ): Promise<LicenseRequestDocument> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const fileExt = file.name.split('.').pop();
    const fileName = `${requestId}/${Date.now()}_${title.replace(/[^a-z0-9]/gi, '_')}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('license-documents')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('license-documents')
      .getPublicUrl(uploadData.path);

    const fileHash = await this.calculateFileHash(file);

    const { data: document, error: docError } = await supabase
      .from('license_request_documents')
      .insert({
        license_request_id: requestId,
        title,
        description,
        document_type: documentType,
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_size_bytes: file.size,
        mime_type: file.type,
        hash_sha256: fileHash,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (docError) throw docError;
    return document;
  },

  async getRequestDocuments(requestId: string): Promise<LicenseRequestDocument[]> {
    const { data, error } = await supabase
      .from('license_request_documents')
      .select('*')
      .eq('license_request_id', requestId)
      .eq('is_current', true)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async deleteDocument(documentId: string): Promise<void> {
    const { data: document } = await supabase
      .from('license_request_documents')
      .select('file_url, license_request_id')
      .eq('id', documentId)
      .single();

    if (document) {
      const { data: request } = await supabase
        .from('license_requests')
        .select('status')
        .eq('id', document.license_request_id)
        .single();

      if (request?.status !== 'DRAFT') {
        throw new Error('Cannot delete documents from submitted requests');
      }

      const filePath = document.file_url.split('/').slice(-2).join('/');
      await supabase.storage.from('license-documents').remove([filePath]);
    }

    const { error } = await supabase
      .from('license_request_documents')
      .delete()
      .eq('id', documentId);

    if (error) throw error;
  },

  async getRequestStatistics(): Promise<{
    total: number;
    draft: number;
    submitted: number;
    inReview: number;
    approved: number;
    rejected: number;
  }> {
    const { data, error } = await supabase
      .from('license_requests')
      .select('status');

    if (error) throw error;

    const stats = {
      total: data?.length || 0,
      draft: 0,
      submitted: 0,
      inReview: 0,
      approved: 0,
      rejected: 0,
    };

    data?.forEach((req) => {
      switch (req.status) {
        case 'DRAFT':
          stats.draft++;
          break;
        case 'SUBMITTED':
          stats.submitted++;
          break;
        case 'IN_REVIEW':
          stats.inReview++;
          break;
        case 'APPROVED':
          stats.approved++;
          break;
        case 'REJECTED':
          stats.rejected++;
          break;
      }
    });

    return stats;
  },

  async calculateFileHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },
};
