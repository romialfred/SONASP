import { ArrowRight, Building2, Landmark, Pickaxe, Ship } from 'lucide-react';

/**
 * Circuit de l'or, de l'extraction au raffineur international.
 *
 * Le schéma décrivait la chaîne d'un autre exploitant — Kourousa Guinea Mining,
 * Société des Mines de Komana, Hummingbird Resources, Mansa Management Middle
 * East — avec des parts chiffrées (93 %, 5 %, 2 %) qui ne venaient d'aucune
 * source. Il montre désormais le circuit burkinabè réel, et **aucun chiffre** :
 * les volumes se lisent sur les écrans qui les tiennent, pas sur un schéma.
 */

interface Etape {
  id: string;
  titre: string;
  detail: string;
  icone: typeof Building2;
}

const ETAPES: Etape[] = [
  {
    id: 'production',
    titre: 'Producteurs',
    detail: 'Mines industrielles et artisans miniers déclarent leur production.',
    icone: Pickaxe,
  },
  {
    id: 'sonasp',
    titre: 'SONASP',
    detail: 'Achète tout ou partie du stock déclaré et devient propriétaire de l’or.',
    icone: Landmark,
  },
  {
    id: 'export',
    titre: 'Export',
    detail: 'Expédition sous licence, après contrôle douanier.',
    icone: Ship,
  },
  {
    id: 'raffineur',
    titre: 'Raffineurs internationaux',
    detail: 'Clients choisis par la SONASP parmi les acheteurs habilités.',
    icone: Building2,
  },
];

export function GoldSalesFlowDiagram() {
  return (
    <section className="sn-card" aria-label="Circuit de l’or">
      <header className="mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Circuit de l’or</h3>
        <p className="text-xs text-gray-600">
          De la déclaration de production à la vente hors du Burkina. Deux ventes distinctes :
          le producteur vend à la SONASP, la SONASP vend au raffineur.
        </p>
      </header>

      <ol className="flex flex-wrap items-stretch gap-2">
        {ETAPES.map((etape, index) => {
          const Icone = etape.icone;
          return (
            <li key={etape.id} className="flex items-stretch gap-2">
              <article className="w-48 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Icone className="h-4 w-4 text-amber-700" aria-hidden="true" />
                  <h4 className="text-sm font-semibold text-gray-900">{etape.titre}</h4>
                </div>
                <p className="text-xs text-gray-600">{etape.detail}</p>
              </article>

              {index < ETAPES.length - 1 && (
                <div className="flex items-center" aria-hidden="true">
                  <ArrowRight className="h-4 w-4 text-amber-600" />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
