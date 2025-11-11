import { FileText, Download, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface ProductionDocument {
  id: string;
  document_name: string;
  file_name: string;
  file_path: string;
  file_size: number;
  created_at: string;
}

interface ProductionDocumentsListProps {
  documents: ProductionDocument[];
  onView?: (document: ProductionDocument) => void;
  onDownload?: (document: ProductionDocument) => void;
  onDelete?: (documentId: string) => void;
  canDelete?: boolean;
}

export function ProductionDocumentsList({
  documents,
  onView,
  onDownload,
  onDelete,
  canDelete = false
}: ProductionDocumentsListProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (documents.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-sm text-gray-600">Aucun document attaché</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-emerald-300 transition-colors"
        >
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-emerald-600" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {doc.document_name}
            </p>
            <p className="text-xs text-gray-500">
              {doc.file_name} • {formatFileSize(doc.file_size)} • {formatDate(doc.created_at)}
            </p>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {onView && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onView(doc)}
                title="Voir le document"
              >
                <Eye className="w-4 h-4" />
              </Button>
            )}
            {onDownload && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDownload(doc)}
                title="Télécharger"
              >
                <Download className="w-4 h-4" />
              </Button>
            )}
            {canDelete && onDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (confirm('Êtes-vous sûr de vouloir supprimer ce document?')) {
                    onDelete(doc.id);
                  }
                }}
                title="Supprimer"
                className="text-red-600 hover:text-red-700 hover:border-red-300"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
