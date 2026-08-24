import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FieldGuidePanel } from './FieldGuidePanel';

describe('FieldGuidePanel', () => {
  it('affiche tous les champs en format compact et respecte les exclusions', () => {
    render(
      <FieldGuidePanel
        title="Champs du formulaire"
        activeField="weight"
        fields={{
          date: { title: 'Date', description: 'Jour de l’opération.', required: true },
          weight: { title: 'Poids', description: 'Masse mesurée.', example: '125 g' },
          company: { title: 'Société', description: 'Périmètre du compte.' },
        }}
        excludeFields={['company']}
      />
    );

    expect(screen.getByRole('heading', { name: 'Champs du formulaire' })).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Poids')).toBeInTheDocument();
    expect(screen.getByText(/Masse mesurée/)).toHaveTextContent('Masse mesurée. · Ex. 125 g');
    expect(screen.queryByText('Société')).not.toBeInTheDocument();
    expect(screen.queryByText(/s’adapte au champ/i)).not.toBeInTheDocument();
  });
});
