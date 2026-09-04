import type { ReactNode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GoldShippingWorkflow, { trace } from './GoldShippingWorkflow';
import { construireGraphe, entrantes, profondeurs, type NoeudWorkflow } from './workflowGraph';
import { ALLOWED_TRANSITIONS } from '@/services/statusTransitionControlService';

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe('graphe du circuit', () => {
  it('recense les transitions entrantes de chaque étape', () => {
    const arrivees = entrantes({ a: ['b'], b: ['c'], c: [] });
    expect(arrivees).toEqual({ a: [], b: ['a'], c: ['b'] });
  });

  it('classe les étapes par profondeur', () => {
    const niveaux = profondeurs({ a: ['b'], b: ['c'], c: [] });
    expect(niveaux).toEqual({ a: 0, b: 1, c: 2 });
  });

  it('ne boucle pas sur un cycle', () => {
    // La table réelle n'en comporte pas, mais le calcul doit rester borné.
    const niveaux = profondeurs({ a: ['b'], b: ['a'] });
    expect(Number.isFinite(niveaux.a)).toBe(true);
    expect(Number.isFinite(niveaux.b)).toBe(true);
  });

  it('dérive le graphe de la table de transitions réelle', () => {
    const graphe = construireGraphe();

    // Le diagramme décrivait un processus « Batch Management » absent de la plateforme.
    expect(graphe.noeuds).toHaveLength(Object.keys(ALLOWED_TRANSITIONS).length);
    expect(graphe.liens).toHaveLength(
      Object.values(ALLOWED_TRANSITIONS).reduce((somme, cibles) => somme + cibles.length, 0)
    );
    expect(graphe.noeuds.map((noeud) => noeud.statut)).toContain('prepared');
    expect(graphe.noeuds.map((noeud) => noeud.statut)).not.toContain('fill_batch');
  });

  it('identifie points d’entrée et états terminaux', () => {
    const graphe = construireGraphe();
    const prepare = graphe.noeuds.find((noeud) => noeud.statut === 'prepared');
    const paye = graphe.noeuds.find((noeud) => noeud.statut === 'paid');

    expect(prepare?.estInitial).toBe(true);
    expect(prepare?.couloirLabel).toBe('Production');
    expect(paye?.estFinal).toBe(true);
  });

  it('positionne les étapes dans les couloirs de leur module', () => {
    const graphe = construireGraphe();
    const couloirs = graphe.couloirs.map((couloir) => couloir.label);
    expect(couloirs).toContain('Production');
    expect(couloirs).toContain('Raffinerie');
    expect(graphe.largeur).toBeGreaterThan(0);
    expect(graphe.hauteur).toBeGreaterThan(0);
  });

  it('donne un libellé français à chaque étape', () => {
    const graphe = construireGraphe();
    // Trois étapes retombaient sur leur identifiant technique anglicisé.
    const libelles = new Map(graphe.noeuds.map((noeud) => [noeud.statut, noeud.libelle]));
    expect(libelles.get('waiting_for_customs_approval')).toBe('En attente d’approbation douanière');
    expect(libelles.get('in_inventory')).toBe('En stock');
    expect(libelles.get('paid')).toBe('Payé');
    // Aucune étape ne doit retomber sur son identifiant technique mis en forme.
    expect(libelles.get('waiting_for_customs_approval')).not.toBe('Waiting For Customs Approval');
    expect(libelles.get('in_inventory')).not.toBe('In Inventory');
  });

  it('trace un lien de la sortie vers l’entrée', () => {
    const source = { x: 100, y: 50 } as NoeudWorkflow;
    const cible = { x: 300, y: 120 } as NoeudWorkflow;
    expect(trace(source, cible)).toMatch(/^M 176 50 C .* 224 120$/);
  });
});

describe('GoldShippingWorkflow', () => {
  it('rend le diagramme et ses indicateurs', () => {
    render(<GoldShippingWorkflow />);

    expect(screen.getByRole('heading', { name: 'Circuit de traçabilité' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Diagramme du circuit de traçabilité' })).toBeInTheDocument();

    const indicateurs = within(screen.getByRole('region', { name: 'Portée du circuit' }));
    expect(indicateurs.getByText('Étapes')).toBeInTheDocument();
    expect(indicateurs.getByText('Transitions')).toBeInTheDocument();

    // Le diagramme était intégralement en anglais.
    expect(screen.queryByText(/Batch Management/)).not.toBeInTheDocument();
    expect(screen.queryByText('Export')).not.toBeInTheDocument();
  });

  it('détaille une étape sélectionnée et permet de naviguer', () => {
    render(<GoldShippingWorkflow />);

    fireEvent.click(screen.getByRole('button', { name: 'Étape Préparé' }));

    const detail = within(screen.getByRole('complementary', { name: 'Détail de l’étape' }));
    expect(detail.getByText('Production')).toBeInTheDocument();
    expect(detail.getByText('Point d’entrée')).toBeInTheDocument();
    expect(detail.getByText('prepared')).toBeInTheDocument();
    expect(detail.getByText(/Aucune : c’est un point d’entrée/)).toBeInTheDocument();

    // On peut suivre la chaîne depuis le volet.
    fireEvent.click(detail.getByRole('button', { name: /Prêt pour la douane/ }));
    expect(
      within(screen.getByRole('complementary', { name: 'Détail de l’étape' })).getByText('ready_for_customs')
    ).toBeInTheDocument();
  });

  it('borne le zoom', () => {
    render(<GoldShippingWorkflow />);

    const reduire = screen.getByRole('button', { name: 'Réduire le diagramme' });
    for (let clic = 0; clic < 10; clic += 1) fireEvent.click(reduire);
    expect(reduire).toBeDisabled();

    const agrandir = screen.getByRole('button', { name: 'Agrandir le diagramme' });
    for (let clic = 0; clic < 20; clic += 1) fireEvent.click(agrandir);
    expect(agrandir).toBeDisabled();
  });
});
