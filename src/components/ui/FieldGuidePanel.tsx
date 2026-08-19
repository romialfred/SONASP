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
  title = 'Guide de saisie',
  guides = [],
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

  return (
    <div className="sticky top-4">
      {/* En-tete neutre : le vert plein donnait au guide plus de poids qu'au
          formulaire qu'il accompagne. */}
      <div className="flex items-center gap-2 rounded-t-lg border border-b-0 border-gray-200 bg-slate-50 px-3 py-2 text-slate-700">
        <Info className="h-3.5 w-3.5" />
        <h2 className="text-xs font-semibold uppercase tracking-wide">{title}</h2>
      </div>

      {/* Content */}
      <div className="rounded-b-lg border border-gray-200 bg-white p-3 shadow-sm">
        <div className="space-y-1.5 max-h-[calc(100vh-200px)] overflow-y-auto pr-1">
          {guidesArray.length > 0 ? (
            guidesArray.map((guide, index) => {
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
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{guide.description}</p>
                  {guide.example && (
                    <p className="mt-1 text-[11px] text-slate-400">
                      <span className="font-medium">Ex :</span> {guide.example}
                    </p>
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
