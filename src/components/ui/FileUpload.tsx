import { useState, useRef, ChangeEvent, DragEvent } from 'react';
import { Upload, X, File, CheckCircle } from 'lucide-react';
import { cn } from '@/utils/cn';
import Button from './Button';

export interface FileUploadProps {
  onFileSelect: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  maxSize?: number;
  className?: string;
}

export function FileUpload({
  onFileSelect,
  accept = '*/*',
  multiple = false,
  maxSize = 10 * 1024 * 1024,
  className,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFiles = (files: FileList | null): File[] => {
    if (!files || files.length === 0) return [];

    const validFiles: File[] = [];
    let hasError = false;

    Array.from(files).forEach((file) => {
      if (file.size > maxSize) {
        setError(`File ${file.name} exceeds maximum size of ${Math.round(maxSize / 1024 / 1024)}MB`);
        hasError = true;
      } else {
        validFiles.push(file);
      }
    });

    if (!hasError) {
      setError(null);
    }

    return validFiles;
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = validateFiles(e.target.files);
    if (files.length > 0) {
      setSelectedFiles(multiple ? [...selectedFiles, ...files] : files);
      onFileSelect(files);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = validateFiles(e.dataTransfer.files);
    if (files.length > 0) {
      setSelectedFiles(multiple ? [...selectedFiles, ...files] : files);
      onFileSelect(files);
    }
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
          isDragging
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
        )}
        onClick={handleBrowseClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          className="hidden"
        />

        <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />

        <p className="text-sm font-medium text-gray-700 mb-1">
          {isDragging ? 'Drop files here' : 'Click to upload or drag and drop'}
        </p>

        <p className="text-xs text-gray-500">
          {accept === '*/*' ? 'Any file type' : accept} - Max {Math.round(maxSize / 1024 / 1024)}MB
        </p>
      </div>

      {error && (
        <div className="text-sm text-red-600 flex items-center gap-2">
          <X className="h-4 w-4" />
          {error}
        </div>
      )}

      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Selected Files:</p>
          {selectedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <File className="h-5 w-5 text-primary-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
                <CheckCircle className="h-5 w-5 text-accent-500 flex-shrink-0" />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveFile(index);
                }}
                className="ml-2"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
