import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/database';
import {
  createPrivateSignedUrl,
  PRIVATE_STORAGE_BUCKETS,
} from '@/lib/privateStorage';
import { UPLOAD_POLICIES, validateUploadFile } from '@/lib/uploadValidation';
import type { ExtractedAssayData } from './pdfParsingService';
import { deleteSensitiveResource, uploadSensitiveFile } from './sensitiveUploadGateway';

const ASSAY_CERTIFICATES_BUCKET = PRIVATE_STORAGE_BUCKETS.assayCertificates;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AssayCertificate {
  id: string;
  shipping_preparation_id: string;
  certificate_number: string | null;
  certificate_date: string | null;
  issuing_laboratory: string | null;
  file_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  parsing_status: string | null;
  parsing_error: string | null;
  parsed_at: string | null;
  approval_status: 'pending' | 'approved' | 'rejected';
  approved_by: string | null;
  approved_at: string | null;
  approval_notes: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssayCertificateData {
  id: string;
  certificate_id: string;
  shipping_preparation_id: string | null;
  certificate_number: string | null;
  certificate_date: string | null;
  laboratory_name: string | null;
  laboratory_address: string | null;
  sample_id: string | null;
  sample_weight_g: number | null;
  sample_description: string | null;
  gold_content_ppm: number | null;
  gold_content_gpt: number | null;
  gold_content_ozt: number | null;
  gold_purity_percentage: number | null;
  silver_content_ppm: number | null;
  silver_content_gpt: number | null;
  silver_content_ozt: number | null;
  silver_purity_percentage: number | null;
  platinum_content_ppm: number | null;
  palladium_content_ppm: number | null;
  deleterious_elements: Json;
  copper_percentage: number | null;
  iron_percentage: number | null;
  zinc_percentage: number | null;
  fineness: number | null;
  moisture_percentage: number | null;
  total_weight_g: number | null;
  is_verified: boolean;
  verification_notes: string | null;
  raw_text: string | null;
  extraction_confidence: number;
  created_at: string;
  updated_at: string;
}

export interface ParsedCertificateResult {
  success: boolean;
  data?: AssayCertificateData;
  error?: string;
  confidence?: number;
}

function isUploadedAssayCertificate(
  value: unknown,
  expected: {
    shippingPreparationId: string;
    extension: string;
    fileSize: number;
    mimeType: string;
  },
): value is AssayCertificate {
  if (!value || typeof value !== 'object') return false;
  const certificate = value as Partial<AssayCertificate>;
  const escapedShippingId = expected.shippingPreparationId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedExtension = expected.extension.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const expectedPath = new RegExp(
    `^${escapedShippingId}/format-validated/[0-9]{4}/(?:0[1-9]|1[0-2])/[0-9a-f-]{36}\\.${escapedExtension}$`,
    'i',
  );
  return typeof certificate.id === 'string'
    && UUID.test(certificate.id)
    && certificate.shipping_preparation_id === expected.shippingPreparationId
    && typeof certificate.file_name === 'string'
    && !/[\\/\u0000-\u001f\u007f]/u.test(certificate.file_name)
    && typeof certificate.file_path === 'string'
    && expectedPath.test(certificate.file_path)
    && certificate.file_size === expected.fileSize
    && certificate.mime_type === expected.mimeType
    && certificate.parsing_status === 'pending'
    && certificate.approval_status === 'pending'
    && certificate.approved_by === null
    && certificate.approved_at === null
    && typeof certificate.uploaded_by === 'string'
    && UUID.test(certificate.uploaded_by)
    && typeof certificate.created_at === 'string'
    && Number.isFinite(Date.parse(certificate.created_at));
}

/**
 * Upload assay certificate PDF
 */
export async function uploadAssayCertificate(
  shippingPreparationId: string,
  file: File,
  _userId: string,
): Promise<{ success: boolean; data?: AssayCertificate; error?: string }> {
  try {
    if (!UUID.test(shippingPreparationId)) {
      return { success: false, error: 'La préparation d’expédition est invalide.' };
    }
    const validatedFile = validateUploadFile(file, UPLOAD_POLICIES.assayCertificate);
    const certificate = await uploadSensitiveFile(
      'assay-certificate',
      file,
      { shippingPreparationId, fileName: file.name },
      { mimeType: validatedFile.mimeType },
    );
    if (!isUploadedAssayCertificate(certificate, {
      shippingPreparationId,
      extension: validatedFile.extension,
      fileSize: file.size,
      mimeType: validatedFile.mimeType,
    })) return { success: false, error: 'La confirmation du dépôt est invalide.' };

    return { success: true, data: certificate };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Le certificat n’a pas pu être déposé.',
    };
  }
}

/**
 * Produit une URL courte et signée, y compris depuis une ancienne URL publique.
 */
export async function getCertificateUrl(filePath: string): Promise<string> {
  return createPrivateSignedUrl(ASSAY_CERTIFICATES_BUCKET, filePath, 300);
}

/**
 * Get signed URL for certificate PDF (for private access)
 */
export async function getCertificateSignedUrl(
  filePath: string,
  expiresIn: number = 3600
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const url = await createPrivateSignedUrl(ASSAY_CERTIFICATES_BUCKET, filePath, expiresIn);
    return { success: true, url };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Parse PDF text content using pdf.js
 */
export async function parsePDFText(file: File): Promise<string> {
  try {
    const { extractTextFromPDF } = await import('./pdfParsingService');
    const result = await extractTextFromPDF(file);
    return result.text;
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw error;
  }
}

/**
 * Extract assay data from text using pattern matching (enhanced)
 */
function mapAssayDataFromText(
  text: string,
  extracted: ExtractedAssayData
): Partial<AssayCertificateData> {
  const data: Partial<AssayCertificateData> = {
    certificate_number: extracted.certificateNumber,
    certificate_date: extracted.certificateDate,
    laboratory_name: extracted.laboratoryName,
    sample_id: extracted.sampleId,
    sample_weight_g: extracted.sampleWeight,

    gold_content_ppm: extracted.goldContent.ppm,
    gold_content_gpt: extracted.goldContent.gpt,
    gold_purity_percentage: extracted.goldContent.percent,

    silver_content_ppm: extracted.silverContent.ppm,
    silver_content_gpt: extracted.silverContent.gpt,
    silver_purity_percentage: extracted.silverContent.percent,

    platinum_content_ppm: extracted.platinumPpm,
    palladium_content_ppm: extracted.palladiumPpm,

    fineness: extracted.fineness,

    copper_percentage: extracted.baseMetals.copper,
    iron_percentage: extracted.baseMetals.iron,
    zinc_percentage: extracted.baseMetals.zinc,

    deleterious_elements: extracted.deleteriousElements,
    extraction_confidence: extracted.confidence,
    raw_text: text,
  };

  // Certificate number patterns
  const certNumberPatterns = [
    /Certificate\s+(?:No|Number|#)[:\s]+([A-Z0-9-]+)/i,
    /Cert[.:\s]+([A-Z0-9-]+)/i,
    /Report\s+No[:\s]+([A-Z0-9-]+)/i,
  ];

  for (const pattern of certNumberPatterns) {
    const match = text.match(pattern);
    if (match) {
      data.certificate_number = match[1].trim();
      break;
    }
  }

  // Date patterns
  const datePatterns = [
    /Date[:\s]+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
    /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/,
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      data.certificate_date = match[1];
      break;
    }
  }

  // Laboratory name
  const labPattern = /Laboratory[:\s]+([^\n]+)/i;
  const labMatch = text.match(labPattern);
  if (labMatch) {
    data.laboratory_name = labMatch[1].trim();
  }

  // Gold content patterns
  const goldPatterns = [
    /Gold[:\s]+(\d+\.?\d*)\s*(?:g\/t|gpt|ppm)/i,
    /Au[:\s]+(\d+\.?\d*)\s*(?:g\/t|gpt|ppm)/i,
    /Gold.*?(\d+\.?\d*)\s*(?:%|percent)/i,
  ];

  for (const pattern of goldPatterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseFloat(match[1]);
      if (pattern.source.includes('%')) {
        data.gold_purity_percentage = value;
      } else {
        data.gold_content_gpt = value;
        data.gold_content_ppm = value; // Often the same for g/t
      }
      break;
    }
  }

  // Silver content patterns
  const silverPatterns = [
    /Silver[:\s]+(\d+\.?\d*)\s*(?:g\/t|gpt|ppm)/i,
    /Ag[:\s]+(\d+\.?\d*)\s*(?:g\/t|gpt|ppm)/i,
    /Silver.*?(\d+\.?\d*)\s*(?:%|percent)/i,
  ];

  for (const pattern of silverPatterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseFloat(match[1]);
      if (pattern.source.includes('%')) {
        data.silver_purity_percentage = value;
      } else {
        data.silver_content_gpt = value;
        data.silver_content_ppm = value;
      }
      break;
    }
  }

  // Fineness
  const finenessPattern = /Fineness[:\s]+(\d+\.?\d*)/i;
  const finenessMatch = text.match(finenessPattern);
  if (finenessMatch) {
    data.fineness = parseFloat(finenessMatch[1]);
  }

  // Deleterious elements
  const elementPatterns = {
    arsenic: /(?:Arsenic|As)[:\s]+(\d+\.?\d*)/i,
    mercury: /(?:Mercury|Hg)[:\s]+(\d+\.?\d*)/i,
    lead: /(?:Lead|Pb)[:\s]+(\d+\.?\d*)/i,
    antimony: /(?:Antimony|Sb)[:\s]+(\d+\.?\d*)/i,
    cadmium: /(?:Cadmium|Cd)[:\s]+(\d+\.?\d*)/i,
  };

  for (const [element, pattern] of Object.entries(elementPatterns)) {
    const match = text.match(pattern);
    if (match) {
      data.deleterious_elements![element] = parseFloat(match[1]);
    }
  }

  // Base metals
  const copperPattern = /(?:Copper|Cu)[:\s]+(\d+\.?\d*)\s*%/i;
  const copperMatch = text.match(copperPattern);
  if (copperMatch) {
    data.copper_percentage = parseFloat(copperMatch[1]);
  }

  const ironPattern = /(?:Iron|Fe)[:\s]+(\d+\.?\d*)\s*%/i;
  const ironMatch = text.match(ironPattern);
  if (ironMatch) {
    data.iron_percentage = parseFloat(ironMatch[1]);
  }

  // Sample weight
  const weightPattern = /(?:Sample\s+)?Weight[:\s]+(\d+\.?\d*)\s*(?:g|grams)/i;
  const weightMatch = text.match(weightPattern);
  if (weightMatch) {
    data.sample_weight_g = parseFloat(weightMatch[1]);
  }

  // Calculate confidence based on fields found
  const fieldsFound = Object.values(data).filter((v) => v !== null && v !== undefined && v !== '').length;
  data.extraction_confidence = Math.min(fieldsFound / 10, 1.0);

  data.raw_text = text;

  return data;
}

export async function extractAssayDataFromText(
  text: string
): Promise<Partial<AssayCertificateData>> {
  const { extractAssayData } = await import('./pdfParsingService');
  return mapAssayDataFromText(text, extractAssayData(text));
}

/**
 * Parse certificate and save data
 */
export async function parseCertificate(
  certificateId: string,
  file: File
): Promise<ParsedCertificateResult> {
  try {
    // Update status to processing
    await supabase
      .from('assay_certificates')
      .update({ parsing_status: 'processing' })
      .eq('id', certificateId);

    // Extract text from PDF
    const text = await parsePDFText(file);

    // Extract structured data from text
    const { extractAssayData } = await import('./pdfParsingService');
    const assayData = extractAssayData(text);
    const extractedData = mapAssayDataFromText(text, assayData);

    // Update certificate with extracted summary data for quick access
    // Only update columns that exist in assay_certificates table
    await supabase
      .from('assay_certificates')
      .update({
        certificate_number: assayData.certificateNumber,
        issuing_laboratory: assayData.laboratoryName,
        certificate_date: assayData.certificateDate,
      })
      .eq('id', certificateId);

    // Get certificate to get shipping_preparation_id
    const { data: certificate } = await supabase
      .from('assay_certificates')
      .select('shipping_preparation_id')
      .eq('id', certificateId)
      .single();

    // Save parsed data
    const { data: parsedData, error: saveError } = await supabase
      .from('assay_certificate_data')
      .insert({
        certificate_id: certificateId,
        shipping_preparation_id: certificate?.shipping_preparation_id,
        ...extractedData,
      })
      .select()
      .single();

    if (saveError) {
      await supabase
        .from('assay_certificates')
        .update({
          parsing_status: 'failed',
          parsing_error: saveError.message,
        })
        .eq('id', certificateId);

      return { success: false, error: saveError.message };
    }

    // Update certificate status
    await supabase
      .from('assay_certificates')
      .update({
        parsing_status: 'completed',
        parsed_at: new Date().toISOString(),
      })
      .eq('id', certificateId);

    return {
      success: true,
      data: parsedData,
      confidence: extractedData.extraction_confidence,
    };
  } catch (error: any) {
    await supabase
      .from('assay_certificates')
      .update({
        parsing_status: 'failed',
        parsing_error: error.message,
      })
      .eq('id', certificateId);

    return { success: false, error: error.message };
  }
}

/**
 * Get certificates for a shipping preparation
 */
export async function getShippingCertificates(
  shippingPreparationId: string
): Promise<{ success: boolean; data?: AssayCertificate[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('assay_certificates')
      .select('*')
      .eq('shipping_preparation_id', shippingPreparationId)
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * @deprecated Use getShippingCertificates instead
 * Legacy function for backwards compatibility
 */
export async function getBatchCertificates(
  batchId: string
): Promise<{ success: boolean; data?: AssayCertificate[]; error?: string }> {
  console.warn('getBatchCertificates is deprecated. Use getShippingCertificates instead.');
  try {
    const { data, error } = await supabase
      .from('assay_certificates')
      .select('*')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get all certificates with shipping preparation details
 */
export async function getAllCertificatesWithShipping(): Promise<{
  success: boolean;
  data?: any[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('assay_certificates_with_shipping')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get parsed data for a certificate
 */
export async function getCertificateData(
  certificateId: string
): Promise<{ success: boolean; data?: AssayCertificateData; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('assay_certificate_data')
      .select('*')
      .eq('certificate_id', certificateId)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Update parsed certificate data
 */
export async function updateCertificateData(
  dataId: string,
  updates: Partial<AssayCertificateData>
): Promise<{ success: boolean; data?: AssayCertificateData; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('assay_certificate_data')
      .update(updates)
      .eq('id', dataId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Approve certificate data
 */
export async function approveCertificateData(
  certificateId: string,
  userId: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Update certificate approval status
    const { error: certError } = await supabase
      .from('assay_certificates')
      .update({
        approval_status: 'approved',
        approved_by: userId,
        approved_at: new Date().toISOString(),
        approval_notes: notes,
      })
      .eq('id', certificateId);

    if (certError) {
      return { success: false, error: certError.message };
    }

    // Create approval record (optional - table may not exist)
    try {
      await supabase
        .from('certificate_approvals')
        .insert({
          certificate_id: certificateId,
          action: 'approved',
          reviewed_by: userId,
          review_notes: notes,
        });
    } catch (approvalError) {
      // Ignore if table doesn't exist - approval status is already updated in assay_certificates
      console.warn('Could not create approval record:', approvalError);
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Reject certificate data
 */
export async function rejectCertificateData(
  certificateId: string,
  userId: string,
  notes: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Update certificate approval status
    const { error: certError } = await supabase
      .from('assay_certificates')
      .update({
        approval_status: 'rejected',
        approved_by: userId,
        approved_at: new Date().toISOString(),
        approval_notes: notes,
      })
      .eq('id', certificateId);

    if (certError) {
      return { success: false, error: certError.message };
    }

    // Create approval record (optional - table may not exist)
    try {
      await supabase
        .from('certificate_approvals')
        .insert({
          certificate_id: certificateId,
          action: 'rejected',
          reviewed_by: userId,
          review_notes: notes,
        });
    } catch (approvalError) {
      // Ignore if table doesn't exist - approval status is already updated in assay_certificates
      console.warn('Could not create approval record:', approvalError);
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Delete certificate
 */
export async function deleteCertificate(
  certificateId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!UUID.test(certificateId)) return { success: false, error: 'Le certificat est invalide.' };
    await deleteSensitiveResource('assay-certificate', certificateId);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
