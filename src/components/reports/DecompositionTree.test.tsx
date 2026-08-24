import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DecompositionTree } from './DecompositionTree';

const items = [
  { id: 'centre', label: 'Centre', value: 72, secondary: 72, share: 72, records: 8 },
  { id: 'sahel', label: 'Sahel', value: 28, secondary: 28, share: 28, records: 3 },
];

describe('DecompositionTree', () => {
  it('présente les contributions comme un diagnostic sélectionnable', () => {
    const onSelect = vi.fn();

    render(
      <DecompositionTree
        view="production"
        dimension="region"
        dimensions={['region', 'site']}
        items={items}
        total={100}
        unit="oz"
        selectedId={null}
        onDimensionChange={vi.fn()}
        onSelect={onSelect}
        formatValue={(value, unit) => `${value} ${unit}`}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Décomposer l’indicateur' })).toBeInTheDocument();
    expect(screen.getByRole('treeitem', { name: /Centre, 72 oz, 72.0 pour cent, 8 opérations/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('treeitem', { name: /Sahel, 28 oz/ }));
    expect(onSelect).toHaveBeenCalledWith(items[1]);
  });

  it('change l’axe sans simuler de données supplémentaires', () => {
    const onDimensionChange = vi.fn();

    render(
      <DecompositionTree
        view="national"
        dimension="region"
        dimensions={['region', 'site', 'actor']}
        items={[]}
        total={0}
        unit="oz"
        selectedId={null}
        onDimensionChange={onDimensionChange}
        onSelect={vi.fn()}
        formatValue={(value, unit) => `${value} ${unit}`}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Site minier' }));
    expect(onDimensionChange).toHaveBeenCalledWith('site');
    expect(screen.getByText('Aucune contribution pour la sélection courante.')).toBeInTheDocument();
  });
});
