import { supabase } from '@/lib/supabase';
import { extractTextFromPDF, extractAssayData, type ExtractedAssayData } from './pdfParsingService';

export interface AssayCertificate {
  id: string;
  shipping_preparation_id: string;
  certificate_number: string | null;
  certificate_date: string | null;
  issuing_laboratory: string | null;
  file_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string;
  parsing_status: 'pending' | 'processing' | 'completed' | 'failed' | 'manual_review';
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
  deleterious_elements: Record<string, number>;
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

/**
 * Upload assay certificate PDF
 */
export async function uploadAssayCertificate(
  shippingPreparationId: string,
  file: File,
  userId: string
): Promise<{ success: boolean; data?: AssayCertificate; error?: string }> {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${shippingPreparationId}_${Date.now()}.${fileExt}`;
    const filePath = `${shippingPreparationId}/${fileName}`;

    // Upload file to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('assay-certificates')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return { success: false, error: uploadError.message };
    }

    // Create certificate record
    const { data: certificate, error: dbError } = await supabase
      .from('assay_certificates')
      .insert({
        shipping_preparation_id: shippingPreparationId,
        file_path: uploadData.path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: userId,
        parsing_status: 'pending',
        approval_status: 'pending',
      })
      .select()
      .single();

    if (dbError) {
      return { success: false, error: dbError.message };
    }

    return { success: true, data: certificate };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get public URL for certificate PDF
 */
export async function getCertificateUrl(filePath: string): Promise<string> {
  const { data } = supabase.storage
    .from('assay-certificates')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

/**
 * Get signed URL for certificate PDF (for private access)
 */
export async function getCertificateSignedUrl(
  filePath: string,
  expiresIn: number = 3600
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const { data, error } = await supabase.storage
      .from('assay-certificates')
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, url: data.signedUrl };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Parse PDF text content using pdf.js
 */
export async function parsePDFText(file: File): Promise<string> {
  try {
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
export function extractAssayDataFromText(text: string): Partial<AssayCertificateData> {
  // Use the new enhanced extraction
  const extracted = extractAssayData(text);

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

  // Legacy fallback code below (keeping for compatibility)
  const legacyData: Partial<AssayCertificateData> = {
    deleterious_elements: {},
    extraction_confidence: 0.0,
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
    const assayData = extractAssayData(text);
    const extractedData = extractAssayDataFromText(text);

    // Update certificate with extracted summary data for quick access
    await supabase
      .from('assay_certificates')
      .update({
        certificate_number: assayData.certificateNumber,
        issuing_laboratory: assayData.laboratoryName,
        certificate_date: assayData.certificateDate,
        sample_id: assayData.sampleId,
        sample_weight_grams: assayData.sampleWeight,
        gold_content_ppm: assayData.goldContent.ppm,
        gold_content_gpt: assayData.goldContent.gpt,
        gold_content_percent: assayData.goldContent.percent,
        silver_content_ppm: assayData.silverContent.ppm,
        silver_content_gpt: assayData.silverContent.gpt,
        silver_content_percent: assayData.silverContent.percent,
        platinum_content_ppm: assayData.platinumPpm,
        palladium_content_ppm: assayData.palladiumPpm,
        fineness: assayData.fineness,
        purity_percent: assayData.purity,
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

    // Create approval record
    const { error: approvalError } = await supabase
      .from('certificate_approvals')
      .insert({
        certificate_id: certificateId,
        action: 'approved',
        reviewed_by: userId,
        review_notes: notes,
      });

    if (approvalError) {
      return { success: false, error: approvalError.message };
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

    // Create approval record
    const { error: approvalError } = await supabase
      .from('certificate_approvals')
      .insert({
        certificate_id: certificateId,
        action: 'rejected',
        reviewed_by: userId,
        review_notes: notes,
      });

    if (approvalError) {
      return { success: false, error: approvalError.message };
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
    // Get certificate to get file path
    const { data: certificate } = await supabase
      .from('assay_certificates')
      .select('file_path')
      .eq('id', certificateId)
      .single();

    if (certificate?.file_path) {
      // Delete file from storage
      await supabase.storage.from('assay-certificates').remove([certificate.file_path]);
    }

    // Delete certificate record (cascade will delete related data)
    const { error } = await supabase
      .from('assay_certificates')
      .delete()
      .eq('id', certificateId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
