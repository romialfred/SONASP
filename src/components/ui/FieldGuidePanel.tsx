import { Info } from 'lucide-react';

export interface FieldGuideItem {
  field?: string;
  title?: string;
  label?: string;
  description: string;
  example?: string;
  examples?: string[];
  required?: boolean;
  readOnly?: boolean;
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
  activeField?: string | null;
  fields?: Record<string, FieldGuideItem>;
}

export function FieldGuidePanel({
  title = 'Production Guide',
  guides = [],
  sections = [],
  currentField,
  activeField,
  fields
}: FieldGuidePanelProps) {
  // Convert fields object to guides array if provided
  const guidesArray = fields
    ? Object.entries(fields).map(([key, value]) => ({
        field: key,
        ...value
      }))
    : guides;

  // Get the active guide based on activeField
  const activeGuide = activeField
    ? guidesArray.find(g => g.field === activeField)
    : null;

  return (
    <div className="sticky top-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-yellow-600 text-white rounded-t-lg p-2">
        <div className="flex items-center gap-1.5">
          <Info className="w-4 h-4" />
          <h2 className="text-sm">{title}</h2>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white border border-gray-200 rounded-b-lg p-4 shadow-sm">
        {/* Show all guides with active field highlighted */}
        <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
          {guidesArray.length > 0 ? (
            guidesArray.map((guide, index) => {
              const isActive = activeField === guide.field;
              const colors = [
                { bg: 'bg-blue-50', border: 'border-blue-500', text: 'text-blue-900', activeBg: 'bg-blue-100' },
                { bg: 'bg-emerald-50', border: 'border-emerald-500', text: 'text-emerald-900', activeBg: 'bg-emerald-100' },
                { bg: 'bg-orange-50', border: 'border-orange-500', text: 'text-orange-900', activeBg: 'bg-orange-100' },
                { bg: 'bg-purple-50', border: 'border-purple-500', text: 'text-purple-900', activeBg: 'bg-purple-100' },
                { bg: 'bg-teal-50', border: 'border-teal-500', text: 'text-teal-900', activeBg: 'bg-teal-100' },
                { bg: 'bg-rose-50', border: 'border-rose-500', text: 'text-rose-900', activeBg: 'bg-rose-100' },
              ];

              const color = colors[index % colors.length];

              return (
                <div
                  key={guide.field || index}
                  className={`
                    ${isActive ? color.activeBg : color.bg}
                    border-l-4 ${color.border}
                    rounded-r-lg
                    p-3
                    transition-all duration-300 ease-in-out
                    ${isActive ? 'scale-105 shadow-lg ring-2 ring-offset-2 ring-' + color.border.replace('border-', '') : 'scale-100'}
                  `}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <h4 className={`font-semibold ${isActive ? 'text-sm' : 'text-xs'} ${color.text} transition-all duration-300`}>
                      {guide.title}
                    </h4>
                    <div className="flex gap-1.5">
                      {guide.required && (
                        <span className="text-xs text-red-600 font-medium">* Requis</span>
                      )}
                      {guide.readOnly && (
                        <span className="text-xs text-gray-500 font-medium bg-gray-200 px-1.5 py-0.5 rounded">
                          Lecture seule
                        </span>
                      )}
                    </div>
                  </div>
                  <p className={`${isActive ? 'text-xs' : 'text-xs'} text-gray-600 leading-tight transition-all duration-300`}>
                    {guide.description}
                  </p>
                  {isActive && guide.example && (
                    <div className="mt-1 pt-1 border-t border-gray-200">
                      <p className="text-xs text-gray-500">
                        <span className="font-medium">Ex:</span> {guide.example}
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Info className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucun guide disponible</p>
            </div>
          )}
        </div>
      </div>
    </div>
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
