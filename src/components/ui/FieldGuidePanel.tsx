import { Info, HelpCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export interface FieldGuideItem {
  field: string;
  label: string;
  description: string;
  example?: string;
  required?: boolean;
  rules?: string[];
  section?: string;
}

export interface FieldGuideSection {
  title: string;
  color: string;
  fields: FieldGuideItem[];
}

interface FieldGuidePanelProps {
  title?: string;
  guides?: FieldGuideItem[];
  sections?: FieldGuideSection[];
  currentField?: string;
}

export function FieldGuidePanel({ title = 'Field Guide', guides = [], sections = [], currentField }: FieldGuidePanelProps) {
  // If sections are provided, use them; otherwise group guides by section
  const guideSections: FieldGuideSection[] = sections.length > 0
    ? sections
    : groupGuidesBySection(guides);

  return (
    <Card className="sticky top-6">
      <CardHeader className="bg-blue-50 border-b border-blue-100">
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <HelpCircle className="w-5 h-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 max-h-[calc(100vh-200px)] overflow-y-auto">
        <p className="text-sm text-gray-600 mb-4">
          Guide détaillé des champs du formulaire avec descriptions et exemples.
        </p>

        <div className="space-y-4">
          {guideSections.map((section, sectionIndex) => (
            <div key={sectionIndex} className={`rounded-lg p-4 ${section.color}`}>
              <h3 className="font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wide">
                {section.title}
              </h3>
              <div className="space-y-3">
                {section.fields.map((guide, fieldIndex) => (
                  <div key={fieldIndex} className="bg-white bg-opacity-70 rounded p-3">
                    <div className="flex items-start gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-900">
                        {guide.label}
                      </span>
                      {guide.required && (
                        <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                          Requis
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed mb-2">
                      {guide.description}
                    </p>
                    {guide.example && (
                      <div className="bg-gray-100 rounded px-2 py-1.5 mt-2">
                        <p className="text-xs text-gray-600">
                          <span className="font-medium">Ex:</span> <span className="text-gray-900">{guide.example}</span>
                        </p>
                      </div>
                    )}
                    {guide.rules && guide.rules.length > 0 && (
                      <div className="mt-2 text-xs text-gray-600">
                        {guide.rules.map((rule, ruleIndex) => (
                          <div key={ruleIndex} className="flex items-start gap-1.5">
                            <span className="text-amber-600 mt-0.5">•</span>
                            <span>{rule}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
          <p className="text-xs text-blue-800">
            <strong className="text-blue-900">Astuce:</strong> Les champs marqués "Requis" doivent être remplis avant de soumettre le formulaire.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function groupGuidesBySection(guides: FieldGuideItem[]): FieldGuideSection[] {
  const sectionMap: { [key: string]: FieldGuideItem[] } = {};

  guides.forEach(guide => {
    const section = guide.section || 'Informations';
    if (!sectionMap[section]) {
      sectionMap[section] = [];
    }
    sectionMap[section].push(guide);
  });

  const sectionColors: { [key: string]: string } = {
    'Company Information': 'bg-blue-50',
    'Contact Information': 'bg-green-50',
    'Bank Information': 'bg-purple-50',
    'Additional Information': 'bg-amber-50',
    'Informations': 'bg-gray-50'
  };

  return Object.entries(sectionMap).map(([title, fields]) => ({
    title,
    color: sectionColors[title] || 'bg-gray-50',
    fields
  }));
}
