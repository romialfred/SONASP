import { useState, useEffect } from 'react';
import { X, Download, ZoomIn, ZoomOut, RotateCw, Loader, AlertCircle } from 'lucide-react';
import { Button } from './Button';

interface PDFViewerProps {
  url?: string;
  fileUrl?: string;
  pdfUrl?: string;
  fileName?: string;
  onClose?: () => void;
}

export function PDFViewer({ url, fileUrl, pdfUrl, fileName, onClose }: PDFViewerProps) {
  // Use whichever URL prop was provided
  const pdfSrc = url || fileUrl || pdfUrl;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (!pdfSrc) {
      setError('No PDF URL provided');
      setLoading(false);
      return;
    }

    const iframe = document.getElementById('pdf-iframe') as HTMLIFrameElement;
    if (iframe) {
      iframe.onload = () => setLoading(false);
      iframe.onerror = () => {
        setLoading(false);
        setError('Failed to load PDF document');
      };
    }
  }, [pdfSrc]);

  const handleDownload = async () => {
    if (!pdfSrc) return;

    try {
      const response = await fetch(pdfSrc);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName || 'document.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error downloading PDF:', error);
    }
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 25, 200));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 25, 50));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // If used within a Modal (no onClose provided), render simplified version
  if (!onClose) {
    return (
      <div className="w-full h-full min-h-[70vh] bg-gray-100 rounded-lg overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center h-full min-h-[400px]">
            <div className="text-center">
              <Loader className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-3" />
              <p className="text-gray-600 text-sm">Loading PDF document...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-full min-h-[400px]">
            <div className="text-center max-w-md mx-auto px-4">
              <div className="bg-red-50 border-2 border-red-200 text-red-800 px-6 py-4 rounded-lg">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-600" />
                <p className="font-semibold mb-2">Unable to Load PDF</p>
                <p className="text-sm mb-3">{error}</p>
                <p className="text-xs text-red-600">
                  Please check if the file exists and you have permission to view it.
                </p>
                {pdfSrc && (
                  <button
                    onClick={() => window.open(pdfSrc, '_blank')}
                    className="mt-3 text-xs underline hover:no-underline"
                  >
                    Try opening in new tab
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {!error && pdfSrc && (
          <iframe
            id="pdf-iframe"
            src={`${pdfSrc}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
            className="w-full h-full border-0"
            style={{
              minHeight: '70vh',
            }}
            title={fileName || 'PDF Document'}
            onError={() => {
              setError('Failed to load PDF. The file may be corrupted or inaccessible.');
              setLoading(false);
            }}
          />
        )}
      </div>
    );
  }

  // Standalone full-screen viewer
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
      <div className="relative w-full h-full max-w-7xl mx-4 my-4 bg-white rounded-lg shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 truncate">{fileName || 'PDF Document'}</h3>
            <p className="text-sm text-gray-500">PDF Document</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomOut}
              disabled={zoom <= 50}
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>

            <span className="text-sm font-medium text-gray-700 min-w-[60px] text-center">
              {zoom}%
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomIn}
              disabled={zoom >= 200}
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>

            <div className="w-px h-6 bg-gray-300 mx-2" />

            <Button
              variant="outline"
              size="sm"
              onClick={handleRotate}
              title="Rotate"
            >
              <RotateCw className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              title="Download"
            >
              <Download className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              title="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-gray-100 p-4">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader className="h-12 w-12 animate-spin text-primary-600 mx-auto mb-4" />
                <p className="text-gray-600">Loading PDF document...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="bg-red-100 text-red-800 px-6 py-4 rounded-lg">
                  <p className="font-medium">Error loading PDF</p>
                  <p className="text-sm mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {!error && pdfSrc && (
            <div
              className="flex items-center justify-center min-h-full"
              style={{
                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                transformOrigin: 'center center',
                transition: 'transform 0.3s ease',
              }}
            >
              <iframe
                id="pdf-iframe"
                src={`${pdfSrc}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                className="w-full h-full border-0 bg-white shadow-lg"
                style={{
                  minHeight: '800px',
                  width: '100%',
                  maxWidth: '1000px',
                }}
                title={fileName || 'PDF Document'}
              />
            </div>
          )}
        </div>

        <div className="p-3 border-t border-gray-200 bg-gray-50 text-center text-sm text-gray-500">
          Double-click outside to close • Use toolbar controls to zoom and rotate
        </div>
      </div>

      <div
        className="absolute inset-0 -z-10"
        onClick={onClose}
        onDoubleClick={onClose}
      />
    </div>
  );
}
