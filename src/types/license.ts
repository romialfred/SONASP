export type LicenseRequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'REJECTED';

export type LicenseStatus =
  | 'REGISTERED'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'EXPIRED'
  | 'CLOSED';

export type LicenseEventType =
  | 'CREATED'
  | 'REGISTERED'
  | 'ACTIVATED'
  | 'QUOTA_RESERVED'
  | 'QUOTA_CONSUMED'
  | 'QUOTA_RELEASED'
  | 'QUOTA_ADJUSTED'
  | 'SUSPENDED'
  | 'RESUMED'
  | 'EXPIRED'
  | 'CLOSED'
  | 'UPDATED'
  | 'PDF_UPLOADED'
  | 'OCR_COMPLETED'
  | 'VALIDATION_FAILED'
  | 'EXPORT_BLOCKED'
  | 'ALERT_SENT';

export type QuotaTransactionType =
  | 'RESERVE'
  | 'CONSUME'
  | 'RELEASE'
  | 'ADJUST'
  | 'EXPIRE';

export type DocumentType =
  | 'APPLICATION_FORM'
  | 'COMPANY_REGISTRATION'
  | 'TAX_CERTIFICATE'
  | 'EXPORT_AUTHORIZATION'
  | 'MINING_PERMIT'
  | 'ASSAY_CERTIFICATE'
  | 'OTHER';

export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type Country = 'GN' | 'CI' | 'ML';

export type TrafficLight = 'GREEN' | 'YELLOW' | 'RED' | 'GRAY';

export interface LicenseRequest {
  id: string;
  request_number: string;
  title: string;
  mine_id: string;
  mine_name: string;
  request_date: string;
  planned_quantity_oz: number;
  planned_start_date?: string;
  planned_end_date?: string;
  status: LicenseRequestStatus;
  applicant_signatory_name?: string;
  applicant_signatory_title?: string;
  applicant_signature_date?: string;
  applicant_certification_text?: string;
  reviewer_id?: string;
  reviewer_name?: string;
  review_date?: string;
  review_comments?: string;
  rejection_reason?: string;
  comments?: string;
  priority: Priority;
  license_id?: string;
  created_at: string;
  created_by?: string;
  updated_at: string;
  updated_by?: string;
}

export interface LicenseRequestDocument {
  id: string;
  license_request_id: string;
  title: string;
  description?: string;
  document_type: DocumentType;
  file_url: string;
  file_name: string;
  file_size_bytes?: number;
  mime_type?: string;
  hash_sha256?: string;
  version: number;
  is_current: boolean;
  uploaded_at: string;
  uploaded_by: string;
}

export interface License {
  id: string;
  license_number: string;
  license_type: string;
  request_id?: string;
  applicant_mine_id: string;
  applicant_company_name: string;
  applicant_signatory: string;
  applicant_signatory_title?: string;
  issuer_organization: string;
  issuer_signatory: string;
  issuer_signatory_title?: string;
  issuer_country: Country;
  request_date: string;
  issue_date: string;
  start_date?: string;
  expiry_date: string;
  authorized_qty_oz: number;
  authorized_qty_unit: string;
  reserved_qty_oz: number;
  consumed_qty_oz: number;
  remaining_qty_oz: number;
  theoretical_price_usd_per_oz?: number;
  estimated_total_value_usd?: number;
  status: LicenseStatus;
  suspension_reason?: string;
  suspension_date?: string;
  pdf_url?: string;
  pdf_hash?: string;
  ocr_completed: boolean;
  ocr_confidence_score?: number;
  ocr_extracted_data?: Record<string, any>;
  ocr_extracted_at?: string;
  is_active: boolean;
  days_to_expiry: number;
  remaining_percentage: number;
  notes?: string;
  tags?: string[];
  created_at: string;
  created_by?: string;
  updated_at: string;
  updated_by?: string;
}

export interface LicenseQuotaTransaction {
  id: string;
  license_id: string;
  transaction_type: QuotaTransactionType;
  quantity_oz: number;
  reserved_qty_after: number;
  consumed_qty_after: number;
  remaining_qty_after: number;
  export_id?: string;
  batch_id?: string;
  batch_number?: string;
  reason?: string;
  reference_number?: string;
  notes?: string;
  transaction_date: string;
  performed_by?: string;
  performed_by_name?: string;
  created_at: string;
}

export interface LicenseEvent {
  id: string;
  license_id: string;
  event_type: LicenseEventType;
  event_description: string;
  payload?: Record<string, any>;
  old_value?: Record<string, any>;
  new_value?: Record<string, any>;
  export_id?: string;
  batch_id?: string;
  user_id?: string;
  user_name?: string;
  user_role?: string;
  ip_address?: string;
  event_at: string;
  created_at: string;
}

export interface LicenseKPIThreshold {
  id: string;
  country: string;
  license_type: string;
  threshold_name: string;
  threshold_type: 'QUOTA_PERCENTAGE' | 'DAYS_TO_EXPIRY';
  warning_value: number;
  critical_value: number;
  send_email: boolean;
  send_notification: boolean;
  block_exports: boolean;
  is_active: boolean;
  created_at: string;
  created_by?: string;
  updated_at: string;
  updated_by?: string;
}

export interface LicenseValidationResult {
  valid: boolean;
  license?: License;
  errors: string[];
  warnings: string[];
  canProceed: boolean;
  suggestedLicenses?: License[];
}

export interface LicenseEvaluation {
  trafficLight: TrafficLight;
  status: string;
  reason: string;
  recommendations: string[];
}

export interface LicenseSummary {
  totalLicenses: number;
  activeLicenses: number;
  expiredLicenses: number;
  closedLicenses: number;
  totalAuthorizedOz: number;
  totalConsumedOz: number;
  totalRemainingOz: number;
  licensesExpiringSoon: number;
  licensesLowQuota: number;
}

export interface LicenseFilters {
  mine_id?: string;
  status?: LicenseStatus[];
  country?: Country;
  expiry_date_from?: string;
  expiry_date_to?: string;
  remaining_percentage_min?: number;
  remaining_percentage_max?: number;
  days_to_expiry_max?: number;
  search?: string;
}

export interface LicenseRequestFilters {
  mine_id?: string;
  status?: LicenseRequestStatus[];
  request_date_from?: string;
  request_date_to?: string;
  priority?: Priority;
  search?: string;
}

export interface QuotaReservation {
  license_id: string;
  quantity_oz: number;
  export_id?: string;
  batch_id?: string;
  reason: string;
}

export interface QuotaConsumption {
  license_id: string;
  quantity_oz: number;
  export_id: string;
  batch_id?: string;
  batch_number?: string;
}

export interface QuotaRelease {
  license_id: string;
  quantity_oz: number;
  export_id?: string;
  reason: string;
}
