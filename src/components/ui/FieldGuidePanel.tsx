import { HelpCircle } from 'lucide-react';

export interface FieldGuideItem {
  field: string;
  title?: string;
  label?: string;
  description: string;
  example?: string;
  examples?: string[];
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
  const colors = [
    'bg-blue-50 border-blue-200',
    'bg-green-50 border-green-200',
    'bg-orange-50 border-orange-200',
    'bg-purple-50 border-purple-200',
    'bg-teal-50 border-teal-200',
    'bg-pink-50 border-pink-200',
    'bg-cyan-50 border-cyan-200',
  ];

  const textColors = [
    'text-blue-900',
    'text-green-900',
    'text-orange-900',
    'text-purple-900',
    'text-teal-900',
    'text-pink-900',
    'text-cyan-900',
  ];

  const descriptionColors = [
    'text-blue-700',
    'text-green-700',
    'text-orange-700',
    'text-purple-700',
    'text-teal-700',
    'text-pink-700',
    'text-cyan-700',
  ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <HelpCircle className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-semibold text-blue-600">{title}</h2>
      </div>

      <div className="space-y-3">
        {guides.map((guide, index) => {
          const colorIndex = index % colors.length;
          const displayTitle = guide.title || guide.label || guide.field;

          return (
            <div
              key={guide.field}
              className={`border rounded-lg p-4 ${colors[colorIndex]}`}
            >
              <h3 className={`font-semibold mb-2 ${textColors[colorIndex]}`}>
                {displayTitle}
              </h3>
              <p className={`text-sm ${descriptionColors[colorIndex]}`}>
                {guide.description}
              </p>
            </div>
          );
        })}
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
