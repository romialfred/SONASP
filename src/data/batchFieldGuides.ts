import type { FieldGuideSection } from '@/components/ui/FieldGuidePanel';

export const batchFieldGuideSections: FieldGuideSection[] = [
  {
    title: 'Basic Information',
    color: 'bg-blue-50 border border-blue-200',
    fields: [
      {
        field: 'batch_number',
        label: 'Batch Number',
        description: 'Unique identifier automatically generated for each batch following the format BATCH-YYYY-NNN',
        example: 'BATCH-2024-001',
        required: true,
      },
      {
        field: 'metal_type',
        label: 'Metal Type',
        description: 'Type of precious metal contained in this batch',
        example: 'Gold, Silver',
        required: true,
      },
      {
        field: 'weight_grams',
        label: 'Weight (Grams)',
        description: 'Total weight of the batch in grams. Automatically converted to troy ounces.',
        example: '1000g = 32.15 oz',
        required: true,
        rules: ['Must be greater than 0', 'Precision up to 2 decimal places'],
      },
      {
        field: 'shipping_date',
        label: 'Shipping Date',
        description: 'Date when the batch was shipped from the origin site',
        example: '2024-11-01',
        required: true,
      },
    ],
  },
  {
    title: 'Location & Tracking',
    color: 'bg-green-50 border border-green-200',
    fields: [
      {
        field: 'origin_site',
        label: 'Origin Site',
        description: 'Mining site where the material was extracted',
        example: 'Siguiri Mine, Guinea',
        required: true,
      },
      {
        field: 'current_site',
        label: 'Current Location',
        description: 'Current location of the batch in the supply chain',
        example: 'Airport, Refinery, etc.',
      },
      {
        field: 'status',
        label: 'Batch Status',
        description: 'Current state in the workflow: Created → Validated → Received Airport → Received Refinery → Processed',
      },
    ],
  },
  {
    title: 'Assay Certificates',
    color: 'bg-amber-50 border border-amber-200',
    fields: [
      {
        field: 'assay_upload',
        label: 'Certificate Upload',
        description: 'Upload official assay certificate from certified lab',
        required: false,
        rules: [
          'PDF format only',
          'Maximum file size: 10MB',
          'Must be from certified assay lab',
        ],
      },
      {
        field: 'certificate_number',
        label: 'Certificate Number',
        description: 'Unique reference number from the assay laboratory',
        example: 'ASSAY-2024-12345',
      },
      {
        field: 'gold_content',
        label: 'Gold Content %',
        description: 'Purity percentage of gold content as determined by assay',
        example: '95.5% (23K)',
        rules: ['Range: 0-100%', 'Precision: 2 decimal places'],
      },
      {
        field: 'fine_gold_weight',
        label: 'Fine Gold Weight',
        description: 'Calculated pure gold weight based on assay results',
        example: '955g from 1000g batch',
      },
    ],
  },
  {
    title: 'Batch Documents',
    color: 'bg-purple-50 border border-purple-200',
    fields: [
      {
        field: 'document_types',
        label: 'Document Types',
        description: 'Types of documents that can be uploaded',
        example: 'Shipping Report, Refinery Report, Sales Invoice, Quality Report, Transport Document, Customs Document, Payment Proof',
      },
      {
        field: 'lifecycle_stages',
        label: 'Lifecycle Stages',
        description: 'Stage in batch lifecycle when document was created',
        example: 'Factory, Airport, Refinery, Processing, Sales, Payment',
      },
      {
        field: 'document_formats',
        label: 'Supported Formats',
        description: 'File formats accepted for document upload',
        example: 'PDF, JPG, PNG, DOC, DOCX',
        rules: ['Maximum file size: 10MB per document'],
      },
    ],
  },
  {
    title: 'Airport Receiving',
    color: 'bg-blue-50 border border-blue-200',
    fields: [
      {
        field: 'received_weight',
        label: 'Received Weight',
        description: 'Actual weight measured upon receipt at airport',
        example: '998.5g',
        required: true,
        rules: [
          'Must match shipping weight within tolerance',
          'Variance tolerance: ±0.5%',
          'Significant variance requires justification',
        ],
      },
      {
        field: 'receipt_date',
        label: 'Receipt Date',
        description: 'Date when batch was received at airport',
        required: true,
      },
      {
        field: 'freight_company',
        label: 'Freight Company',
        description: 'Company assigned to transport batch from airport to refinery',
        example: 'Express Gold Transport Ltd',
        required: true,
      },
      {
        field: 'variance',
        label: 'Weight Variance',
        description: 'Difference between shipping and received weight',
        example: '1.5g difference = 0.15% variance',
        rules: [
          'Green: Within 0.5% tolerance',
          'Red: Exceeds 0.5% - requires explanation',
        ],
      },
    ],
  },
  {
    title: 'Validation & Approval',
    color: 'bg-green-50 border border-green-200',
    fields: [
      {
        field: 'validate_transport',
        label: 'Validate for Transport',
        description: 'Plant Manager approves batch for transportation to airport',
        rules: [
          'Only creator (Plant Manager) can validate',
          'Must be in "Created" status',
          'Changes status to "Validated for Transport"',
        ],
      },
      {
        field: 'reject_batch',
        label: 'Reject Batch',
        description: 'Plant Manager can reject batch if issues found',
        rules: ['Requires justification comment', 'Batch cannot be recovered after rejection'],
      },
    ],
  },
];
