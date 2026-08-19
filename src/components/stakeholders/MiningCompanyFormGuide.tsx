import { Info } from 'lucide-react';

interface GuideItem {
  label: string;
  description: string;
  required?: boolean;
}
interface GuideSection {
  title: string;
  items: GuideItem[];
}

const SECTIONS: GuideSection[] = [
  {
    title: 'Informations générales',
    items: [
      { label: 'Nom officiel', description: "Raison sociale complète telle qu'enregistrée légalement.", required: true },
      { label: 'Nom usuel', description: "Nom court d'usage, affiché dans les onglets et les listes." },
      { label: 'Code société', description: 'Identifiant unique, en majuscules et sans espaces.', required: true },
      { label: 'Type', description: 'Mine de production, société mère ou institution.', required: true },
    ],
  },
  {
    title: 'Identification légale',
    items: [
      { label: 'RCCM', description: 'Numéro du Registre du Commerce et du Crédit Mobilier.' },
      { label: 'IFU', description: 'Identifiant Financier Unique attribué par la DGI.' },
    ],
  },
  {
    title: 'Localisation',
    items: [
      { label: 'Région / Province', description: 'Listes officielles du Burkina Faso ; la province dépend de la région.' },
      { label: 'Localité', description: 'Village, commune ou site d\'implantation.' },
    ],
  },
  {
    title: 'Contact & documents',
    items: [
      { label: 'Contact', description: 'Personne responsable, email professionnel et téléphone.', required: true },
      { label: 'Documents', description: 'Pièces jointes : RCCM, IFU, autorisation d\'exploitation, statuts…' },
    ],
  },
];

/** Volet d'aide sobre du formulaire Société Minière (création & modification). */
export function MiningCompanyFormGuide() {
  return (
    <div className="sticky top-4 rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 rounded-t-lg border-b border-gray-200 bg-slate-50 px-3 py-2 text-slate-700">
        <Info className="h-4 w-4" />
        <h2 className="text-xs font-semibold uppercase tracking-wide">Guide de saisie</h2>
      </div>
      <div className="max-h-[calc(100vh-160px)] space-y-4 overflow-y-auto p-4">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">{section.title}</h3>
            <div className="space-y-1.5">
              {section.items.map((item) => (
                <div key={item.label} className="rounded-md border-l-2 border-gray-200 bg-slate-50 py-1.5 pl-3 pr-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-semibold text-slate-800">{item.label}</span>
                    {item.required && <span className="text-[11px] font-medium text-red-600">* Requis</span>}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
