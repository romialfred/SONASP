import { Info, HelpCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export interface FieldGuideItem {
  field: string;
  label: string;
  description: string;
  example?: string;
  required?: boolean;
  rules?: string[];
}

interface FieldGuidePanelProps {
  title?: string;
  guides: FieldGuideItem[];
  currentField?: string;
}

export function FieldGuidePanel({ title = 'Field Guide', guides, currentField }: FieldGuidePanelProps) {
  const activeGuide = currentField ? guides.find(g => g.field === currentField) : null;

  return (
    <Card className="sticky top-6">
      <CardHeader className="bg-blue-50 border-b border-blue-100">
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <HelpCircle className="w-5 h-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {activeGuide ? (
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-gray-900">{activeGuide.label}</h3>
                {activeGuide.required && (
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Required</span>
                )}
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">{activeGuide.description}</p>
            </div>

            {activeGuide.example && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-700 mb-1">Example:</p>
                <p className="text-sm text-gray-900 font-mono">{activeGuide.example}</p>
              </div>
            )}

            {activeGuide.rules && activeGuide.rules.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs font-medium text-amber-900 mb-2 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Validation Rules:
                </p>
                <ul className="text-sm text-amber-800 space-y-1">
                  {activeGuide.rules.map((rule, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-amber-600 mt-0.5">•</span>
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 mb-4">
              Click on any field to see detailed information, examples, and validation rules.
            </p>

            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">All Fields</h4>
              <div className="space-y-2">
                {guides.map((guide) => (
                  <div key={guide.field} className="flex items-start gap-2 text-sm">
                    <span className={`font-medium ${guide.required ? 'text-red-600' : 'text-gray-600'}`}>
                      {guide.required ? '* ' : ''}
                    </span>
                    <span className="text-gray-700">{guide.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
              <p className="text-xs text-blue-800">
                <strong className="text-blue-900">Tip:</strong> Fields marked with * are required.
                Complete all required fields before submission.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
