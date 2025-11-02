import { useState, useEffect } from 'react';
import {
  Upload,
  Eye,
  Download,
  Trash2,
  FileText,
  Filter,
  X,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PDFViewer } from '@/components/ui/PDFViewer';
import {
  fetchBatchDocuments,
  uploadBatchDocument,
  deleteBatchDocument,
  getDocumentDownloadUrl,
  getDocumentTypeStyle,
  DOCUMENT_TYPE_LABELS,
  LIFECYCLE_STAGE_LABELS,
  type BatchDocument,
  type DocumentType,
  type LifecycleStage,
} from '@/services/batchDocumentsService';

interface BatchDocumentsProps {
  batchId: string;
  batchStatus?: string;
}

export function BatchDocuments({ batchId, batchStatus }: BatchDocumentsProps) {
  const [documents, setDocuments] = useState<BatchDocument[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<BatchDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<BatchDocument | null>(null);
  const [filterType, setFilterType] = useState<DocumentType | ''>('');
  const [filterStage, setFilterStage] = useState<LifecycleStage | ''>('');

  // Upload form state
  const [documentName, setDocumentName] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType>('other');
  const [lifecycleStage, setLifecycleStage] = useState<LifecycleStage | ''>('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [canBeDownloaded, setCanBeDownloaded] = useState(true);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    loadDocuments();
  }, [batchId]);

  useEffect(() => {
    applyFilters();
  }, [documents, filterType, filterStage]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const docs = await fetchBatchDocuments(batchId);
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...documents];

    if (filterType) {
      filtered = filtered.filter((doc) => doc.document_type === filterType);
    }

    if (filterStage) {
      filtered = filtered.filter((doc) => doc.lifecycle_stage === filterStage);
    }

    setFilteredDocuments(filtered);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError('');

    if (!selectedFile) {
      setUploadError('Please select a file');
      return;
    }

    if (!documentName.trim()) {
      setUploadError('Please enter a document name');
      return;
    }

    try {
      setUploading(true);
      await uploadBatchDocument(batchId, selectedFile, {
        document_type: documentType,
        document_name: documentName.trim(),
        lifecycle_stage: lifecycleStage || undefined,
        description: description.trim() || undefined,
        can_be_downloaded: canBeDownloaded,
      });

      resetUploadForm();
      setShowUploadModal(false);
      loadDocuments();
    } catch (error: any) {
      setUploadError(error.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      await deleteBatchDocument(documentId);
      loadDocuments();
    } catch (error: any) {
      alert(error.message || 'Failed to delete document');
    }
  };

  const handleView = async (document: BatchDocument) => {
    console.log('[handleView] Document:', document);
    console.log('[handleView] Original file_url:', document.file_url);

    try {
      // Get signed URL for secure viewing
      const signedUrl = await getDocumentDownloadUrl(document.file_url);
      console.log('[handleView] Signed URL obtained:', signedUrl);

      setSelectedDocument({ ...document, file_url: signedUrl });
      setShowPdfViewer(true);
    } catch (error) {
      console.error('[handleView] Error preparing document for viewing:', error);
      console.log('[handleView] Falling back to original URL');

      // Fallback to original URL
      setSelectedDocument(document);
      setShowPdfViewer(true);
    }
  };

  const handleDownload = async (document: BatchDocument) => {
    // Check if download is allowed
    if (document.can_be_downloaded === false) {
      alert('This document cannot be downloaded. It can only be viewed on the platform.');
      return;
    }

    try {
      const url = await getDocumentDownloadUrl(document.file_url);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = document.document_name;
      link.click();
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Failed to download document');
    }
  };

  const resetUploadForm = () => {
    setDocumentName('');
    setDocumentType('other');
    setLifecycleStage('');
    setDescription('');
    setSelectedFile(null);
    setCanBeDownloaded(true);
    setUploadError('');
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-gray-500">Loading documents...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Batch Documents
              {documents.length > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  ({documents.length})
                </span>
              )}
            </CardTitle>
            <Button onClick={() => setShowUploadModal(true)} size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Add Document
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">No documents uploaded yet</p>
              <Button onClick={() => setShowUploadModal(true)} variant="primary" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Upload First Document
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Filter by Type
                  </label>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as DocumentType | '')}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Types</option>
                    {Object.entries(DOCUMENT_TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Filter by Stage
                  </label>
                  <select
                    value={filterStage}
                    onChange={(e) => setFilterStage(e.target.value as LifecycleStage | '')}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Stages</option>
                    {Object.entries(LIFECYCLE_STAGE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                {(filterType || filterStage) && (
                  <div className="flex items-end">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setFilterType('');
                        setFilterStage('');
                      }}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                  </div>
                )}
              </div>

              {/* Documents List */}
              <div className="space-y-3">
                {filteredDocuments.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">
                    No documents match the selected filters
                  </p>
                ) : (
                  filteredDocuments.map((doc) => {
                    const style = getDocumentTypeStyle(doc.document_type);
                    return (
                      <div
                        key={doc.id}
                        className={`border rounded-lg p-4 ${style.bgColor} hover:shadow-md transition-shadow`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="text-3xl flex-shrink-0">{style.icon}</div>

                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-gray-900 mb-1">
                                {doc.document_name}
                              </h4>
                              <p className={`text-sm ${style.color} font-medium mb-1`}>
                                {DOCUMENT_TYPE_LABELS[doc.document_type]}
                              </p>
                              {doc.lifecycle_stage && (
                                <span className="inline-block px-2 py-0.5 bg-white border border-gray-300 rounded text-xs font-medium text-gray-700 mb-2">
                                  {LIFECYCLE_STAGE_LABELS[doc.lifecycle_stage]}
                                </span>
                              )}
                              {doc.description && (
                                <p className="text-sm text-gray-600 mb-2">
                                  {doc.description}
                                </p>
                              )}
                              <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                                <span>Uploaded by {doc.uploaded_by_name || 'Unknown'}</span>
                                <span>•</span>
                                <span>{formatDate(doc.created_at)}</span>
                                {doc.file_size && (
                                  <>
                                    <span>•</span>
                                    <span>{formatFileSize(doc.file_size)}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2 flex-shrink-0">
                            {doc.mime_type?.includes('pdf') && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleView(doc)}
                                title="View PDF"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleDownload(doc)}
                              title={doc.can_be_downloaded === false ? "Download disabled - View only" : "Download"}
                              disabled={doc.can_be_downloaded === false}
                              className={doc.can_be_downloaded === false ? 'opacity-50 cursor-not-allowed' : ''}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleDelete(doc.id)}
                              className="text-red-600 hover:bg-red-50"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Modal - Enhanced Professional Design */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          resetUploadForm();
        }}
        title={
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Upload className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Upload Document</h2>
              <p className="text-sm text-gray-500">Add a new document to this batch</p>
            </div>
          </div>
        }
        size="2xl"
      >
        <form onSubmit={handleUpload} className="space-y-4">
          {uploadError && (
            <div className="bg-red-50 border-l-4 border-red-500 rounded-r-lg p-4 flex items-start gap-3 shadow-sm">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">Upload Error</p>
                <p className="text-sm text-red-700 mt-1">{uploadError}</p>
              </div>
            </div>
          )}

          {/* Document Information Section */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 space-y-3 border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg bg-blue-500 flex items-center justify-center">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900">Document Information</h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Document Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={documentName}
                  onChange={(e) => setDocumentName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                  placeholder="e.g., Shipping Report Q4 2024"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Document Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value as DocumentType)}
                    className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                    required
                  >
                    {Object.entries(DOCUMENT_TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Lifecycle Stage
                    <span className="text-xs font-normal text-gray-500 ml-1">(Optional)</span>
                  </label>
                  <select
                    value={lifecycleStage}
                    onChange={(e) => setLifecycleStage(e.target.value as LifecycleStage | '')}
                    className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                  >
                    <option value="">Select stage...</option>
                    {Object.entries(LIFECYCLE_STAGE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* File Upload Section */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg p-4 space-y-3 border border-amber-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg bg-amber-500 flex items-center justify-center">
                <Upload className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900">File Upload</h3>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Select File <span className="text-red-500">*</span>
              </label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 text-sm border-2 border-dashed border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all bg-white file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-amber-500 file:text-white hover:file:bg-amber-600 file:cursor-pointer cursor-pointer"
                required
              />
              <p className="text-xs text-amber-700 mt-1.5">
                PDF, JPG, PNG, DOC, DOCX • Max 10MB
              </p>
            </div>

            {/* Download Permission Toggle */}
            <div className="flex items-center justify-between bg-white rounded-lg p-3 border-2 border-amber-200">
              <div className="flex-1">
                <label htmlFor="can-download" className="text-xs font-semibold text-gray-900 cursor-pointer">
                  Allow Download
                </label>
                <p className="text-xs text-gray-500 mt-0.5">
                  If disabled, document can only be viewed on platform
                </p>
              </div>
              <button
                type="button"
                id="can-download"
                role="switch"
                aria-checked={canBeDownloaded}
                onClick={() => setCanBeDownloaded(!canBeDownloaded)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
                  canBeDownloaded ? 'bg-green-600' : 'bg-gray-300'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    canBeDownloaded ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Description Section */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 space-y-2 border border-green-200">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-green-500 flex items-center justify-center">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900">
                Additional Notes
                <span className="text-xs font-normal text-gray-500 ml-2">(Optional)</span>
              </h3>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all bg-white resize-none"
              placeholder="Add any additional notes or context about this document..."
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              variant="primary"
              className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
              disabled={uploading}
            >
              {uploading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Uploading...</span>
                </div>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Document
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowUploadModal(false);
                resetUploadForm();
              }}
              disabled={uploading}
              className="px-6 py-2.5 border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 font-semibold rounded-lg transition-all duration-200"
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      {/* PDF Viewer Modal */}
      {showPdfViewer && selectedDocument && (
        <Modal
          isOpen={true}
          onClose={() => {
            setShowPdfViewer(false);
            setSelectedDocument(null);
          }}
          title={selectedDocument.document_name}
          size="5xl"
        >
          <PDFViewer fileUrl={selectedDocument.file_url} />
        </Modal>
      )}
    </>
  );
}
