import { useMemo, useRef, useState } from 'react';
import { ArrowRight, Download, Flag, Info, Play, Workflow, ZoomIn, ZoomOut } from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Badge, Note, PageHeader, Section, StatGrid } from '@/components/ui/sn';
import { construireGraphe, type NoeudWorkflow } from './workflowGraph';
import './admin.css';

const ZOOM_MIN = 0.6;
const ZOOM_MAX = 1.8;
const LARGEUR_NOEUD = 152;
const HAUTEUR_NOEUD = 42;

/** Chemin d'un lien : sortie à droite de la source, entrée à gauche de la cible. */
export function trace(source: NoeudWorkflow, cible: NoeudWorkflow): string {
  const x1 = source.x + LARGEUR_NOEUD / 2;
  const y1 = source.y;
  const x2 = cible.x - LARGEUR_NOEUD / 2;
  const y2 = cible.y;
  const milieu = x1 + Math.max(24, (x2 - x1) / 2);
  return `M ${x1} ${y1} C ${milieu} ${y1}, ${milieu} ${y2}, ${x2} ${y2}`;
}

export default function GoldShippingWorkflow() {
  const [zoom, setZoom] = useState(1);
  const [selection, setSelection] = useState<NoeudWorkflow | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const graphe = useMemo(() => construireGraphe(), []);
  const parStatut = useMemo(
    () => new Map(graphe.noeuds.map((noeud) => [noeud.statut, noeud])),
    [graphe.noeuds]
  );

  /** Le bouton « Export » n'avait aucun gestionnaire : il ne produisait rien. */
  const exporter = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const contenu = new XMLSerializer().serializeToString(svg);
    const url = URL.createObjectURL(new Blob([contenu], { type: 'image/svg+xml;charset=utf-8' }));
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = 'circuit-tracabilite-sonasp.svg';
    lien.click();
    URL.revokeObjectURL(url);
  };

  return (
    <NationalDashboardLayout>
      <div className="sn-page admin-page workflow">
        <PageHeader
          icon={Workflow}
          title="Circuit de traçabilité"
          subtitle="Enchaînement des états d’un lot d’or, de la production au règlement."
          breadcrumb={[{ label: 'Administration' }, { label: 'Circuit de traçabilité' }]}
          actions={
            <>
              <button
                type="button"
                className="sn-btn sn-btn--icon"
                aria-label="Réduire le diagramme"
                onClick={() => setZoom((valeur) => Math.max(ZOOM_MIN, Math.round((valeur - 0.1) * 10) / 10))}
                disabled={zoom <= ZOOM_MIN}
              >
                <ZoomOut aria-hidden="true" />
              </button>
              <button
                type="button"
                className="sn-btn sn-btn--icon"
                aria-label="Agrandir le diagramme"
                onClick={() => setZoom((valeur) => Math.min(ZOOM_MAX, Math.round((valeur + 0.1) * 10) / 10))}
                disabled={zoom >= ZOOM_MAX}
              >
                <ZoomIn aria-hidden="true" />
              </button>
              <button type="button" className="sn-btn sn-btn--primary" onClick={exporter}>
                <Download aria-hidden="true" /> Exporter le diagramme
              </button>
            </>
          }
        />

        {/* Le diagramme décrivait un processus « Batch Management » absent de la
            plateforme : ni module de lots, ni route correspondante. */}
        <Note tone="info" icon={Info}>
          Ce diagramme est <strong>calculé à partir des transitions réellement appliquées</strong>
          par le moteur de contrôle des statuts : il ne peut pas diverger du comportement de
          la plateforme.
        </Note>

        <StatGrid
          ariaLabel="Portée du circuit"
          items={[
            { label: 'Étapes', value: graphe.noeuds.length, icon: Workflow, tone: 'blue' },
            { label: 'Transitions', value: graphe.liens.length, icon: ArrowRight, tone: 'green' },
            { label: 'Intervenants', value: graphe.couloirs.length, icon: Workflow, tone: 'violet' },
            {
              label: 'États terminaux',
              value: graphe.noeuds.filter((noeud) => noeud.estFinal).length,
              icon: Flag,
              tone: 'gold',
            },
          ]}
        />

        <div className="workflow__layout">
          <Section
            id="diagramme"
            icon={Workflow}
            tone="emerald"
            title="Diagramme du circuit"
            description="Chaque couloir correspond au module responsable de l’étape. Sélectionnez une étape pour la détailler."
          >
            <div className="workflow__toile">
              <svg
                ref={svgRef}
                role="img"
                aria-label="Diagramme du circuit de traçabilité"
                width={graphe.largeur * zoom}
                height={graphe.hauteur * zoom}
                viewBox={`0 0 ${graphe.largeur} ${graphe.hauteur}`}
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <marker id="flecheWorkflow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
                    <path d="M0,0 L9,4.5 L0,9 z" fill="#8ea3b8" />
                  </marker>
                </defs>

                {graphe.couloirs.map((couloir, index) => (
                  <g key={couloir.id}>
                    <rect
                      x={0}
                      y={couloir.y}
                      width={graphe.largeur}
                      height={couloir.hauteur}
                      fill={index % 2 === 0 ? '#fbfdfe' : '#f4f7f9'}
                    />
                    <rect x={0} y={couloir.y} width={5} height={couloir.hauteur} fill={couloir.couleur} />
                    <text
                      x={16}
                      y={couloir.y + couloir.hauteur / 2}
                      dominantBaseline="middle"
                      fontSize={11.5}
                      fontWeight={700}
                      fill="#10243e"
                    >
                      {couloir.label}
                    </text>
                  </g>
                ))}

                {graphe.liens.map((lien) => {
                  const source = parStatut.get(lien.de);
                  const cible = parStatut.get(lien.vers);
                  if (!source || !cible) return null;
                  return (
                    <path
                      key={lien.id}
                      d={trace(source, cible)}
                      fill="none"
                      stroke="#8ea3b8"
                      strokeWidth={1.4}
                      markerEnd="url(#flecheWorkflow)"
                    />
                  );
                })}

                {graphe.noeuds.map((noeud) => (
                  <g
                    key={noeud.statut}
                    className="workflow__noeud"
                    onClick={() => setSelection(noeud)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Étape ${noeud.libelle}`}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') setSelection(noeud);
                    }}
                  >
                    <rect
                      x={noeud.x - LARGEUR_NOEUD / 2}
                      y={noeud.y - HAUTEUR_NOEUD / 2}
                      width={LARGEUR_NOEUD}
                      height={HAUTEUR_NOEUD}
                      rx={9}
                      fill="#fff"
                      stroke={selection?.statut === noeud.statut ? noeud.couleur : '#dbe3ea'}
                      strokeWidth={selection?.statut === noeud.statut ? 2.4 : 1.2}
                    />
                    <rect
                      x={noeud.x - LARGEUR_NOEUD / 2}
                      y={noeud.y - HAUTEUR_NOEUD / 2}
                      width={4}
                      height={HAUTEUR_NOEUD}
                      rx={2}
                      fill={noeud.couleur}
                    />
                    <text
                      x={noeud.x}
                      y={noeud.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={11.5}
                      fontWeight={600}
                      fill="#10243e"
                    >
                      {noeud.libelle}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </Section>

          <aside className="workflow__detail" aria-label="Détail de l’étape">
            <section className="sn-card">
              <h2>
                <Workflow aria-hidden="true" /> {selection ? selection.libelle : 'Étape'}
              </h2>
              {selection ? (
                <>
                  <div className="workflow__badges">
                    <Badge tone="info">{selection.couloirLabel}</Badge>
                    {selection.estInitial && (
                      <Badge tone="success" icon={Play}>
                        Point d’entrée
                      </Badge>
                    )}
                    {selection.estFinal && (
                      <Badge tone="neutral" icon={Flag}>
                        État terminal
                      </Badge>
                    )}
                  </div>

                  <dl>
                    <div>
                      <dt>Identifiant technique</dt>
                      <dd>
                        <code>{selection.statut}</code>
                      </dd>
                    </div>
                    <div>
                      <dt>Rang dans la chaîne</dt>
                      <dd>Étape {selection.profondeur + 1}</dd>
                    </div>
                  </dl>

                  <h3>Étapes précédentes</h3>
                  {selection.entrantes.length === 0 ? (
                    <p className="workflow__vide">Aucune : c’est un point d’entrée du circuit.</p>
                  ) : (
                    <ul className="workflow__liens">
                      {selection.entrantes.map((statut) => (
                        <li key={statut}>
                          <button type="button" onClick={() => setSelection(parStatut.get(statut) || null)}>
                            {parStatut.get(statut)?.libelle || statut}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <h3>Étapes suivantes</h3>
                  {selection.transitions.length === 0 ? (
                    <p className="workflow__vide">Aucune : le lot ne change plus d’état.</p>
                  ) : (
                    <ul className="workflow__liens">
                      {selection.transitions.map((statut) => (
                        <li key={statut}>
                          <button type="button" onClick={() => setSelection(parStatut.get(statut) || null)}>
                            <ArrowRight aria-hidden="true" /> {parStatut.get(statut)?.libelle || statut}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <p className="workflow__vide">
                  Sélectionnez une étape du diagramme pour connaître son module responsable et
                  les transitions autorisées.
                </p>
              )}
            </section>
          </aside>
        </div>
      </div>
    </NationalDashboardLayout>
  );
}
