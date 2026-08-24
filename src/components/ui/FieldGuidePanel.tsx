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
  /** Alias historique encore employé par quelques formulaires. */
  fieldGuides?: Record<string, FieldGuideItem>;
  /** N'affiche que l'aide du champ actif pour éviter un second défilement. */
  contextual?: boolean;
  excludeFields?: string[];
}

export function FieldGuidePanel({
  title = 'Repères de saisie',
  guides = [],
  activeField,
  fields,
  fieldGuides,
  contextual = false,
  excludeFields = [],
}: FieldGuidePanelProps) {
  // Convert fields object to guides array if provided
  const fieldsSource = fields || fieldGuides;
  const guidesArray = fieldsSource
    ? Object.entries(fieldsSource).map(([key, value]) => ({
        field: key,
        ...value
      }))
    : guides;
  const availableGuides = guidesArray.filter((guide) => !guide.field || !excludeFields.includes(guide.field));
  const visibleGuides = contextual
    ? [availableGuides.find((guide) => guide.field === activeField) || availableGuides[0]].filter(Boolean) as FieldGuideItem[]
    : availableGuides;

  return (
    <div className="sticky top-4 field-guide-panel">
      <div className="flex items-center gap-2 rounded-t-lg border border-b-0 border-gray-200 bg-slate-50 px-3 py-2 text-slate-700">
        <Info className="h-3.5 w-3.5" />
        <h2 className="text-xs font-semibold uppercase tracking-wide">{title}</h2>
      </div>

      <div className="rounded-b-lg border border-gray-200 bg-white p-3 shadow-sm">
        <div className="space-y-1.5">
          {visibleGuides.length > 0 ? (
            visibleGuides.map((guide, index) => {
              const isActive = activeField === guide.field;
              const heading = guide.title || guide.label || guide.field;

              return (
                <div
                  key={guide.field || index}
                  className={`rounded-md border-l-2 py-1.5 pl-3 pr-2 transition-colors ${
                    isActive
                      ? 'border-amber-500 bg-amber-50/60'
                      : 'border-gray-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    {heading && (
                      <h4 className="text-[12px] font-semibold text-slate-800">{heading}</h4>
                    )}
                    <div className="flex flex-shrink-0 gap-1.5">
                      {guide.required && (
                        <span className="text-[11px] font-medium text-red-600">* Requis</span>
                      )}
                      {guide.readOnly && (
                        <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[11px] font-medium text-gray-500">
                          Lecture seule
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                    {guide.description}
                    {guide.example && <span className="text-slate-400"> · Ex. {guide.example}</span>}
                  </p>
                </div>
              );
            })
          ) : (
            <p className="py-3 text-center text-xs text-gray-500">Aucun repère disponible.</p>
          )}
        </div>
      </div>
    </div>
  );
}
