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
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg p-4">
        <div className="flex items-center gap-2">
          <Info className="w-5 h-5" />
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white border border-gray-200 rounded-b-lg p-4 shadow-sm">
        {activeGuide ? (
          <div className="space-y-4">
            {/* Active Field Title */}
            <div className="pb-3 border-b border-gray-200">
              <h3 className="text-base font-bold text-blue-900 mb-1">
                {activeGuide.title}
              </h3>
              {activeGuide.required && (
                <span className="text-xs text-red-600 font-medium">* Champ requis</span>
              )}
              {activeGuide.readOnly && (
                <span className="text-xs text-gray-500 font-medium">Lecture seule</span>
              )}
            </div>

            {/* Description */}
            <div className="bg-blue-50 rounded-lg p-3 border-l-4 border-blue-500">
              <p className="text-sm text-gray-700 leading-relaxed">
                {activeGuide.description}
              </p>
            </div>
          </div>
        ) : (
          /* Show all guides when no field is active */
          <div className="space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto">
            {guidesArray.length > 0 ? (
              guidesArray.map((guide, index) => {
                const colors = [
                  { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-900' },
                  { bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-900' },
                  { bg: 'bg-orange-50', border: 'border-orange-400', text: 'text-orange-900' },
                  { bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-900' },
                  { bg: 'bg-teal-50', border: 'border-teal-400', text: 'text-teal-900' },
                  { bg: 'bg-rose-50', border: 'border-rose-400', text: 'text-rose-900' },
                ];

                const color = colors[index % colors.length];

                return (
                  <div
                    key={guide.field || index}
                    className={`${color.bg} border-l-4 ${color.border} rounded-lg p-3`}
                  >
                    <h4 className={`font-semibold text-sm mb-1 ${color.text}`}>
                      {guide.title}
                    </h4>
                    <p className="text-xs text-gray-700 leading-relaxed">
                      {guide.description}
                    </p>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Info className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Cliquez sur un champ pour voir son guide</p>
              </div>
            )}
          </div>
        )}
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
