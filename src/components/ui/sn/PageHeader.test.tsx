import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHeader } from './index';

describe('PageHeader', () => {
  it('exposes the page title as the unique level-one heading', () => {
    render(<PageHeader title="Préparations d’expéditions" subtitle="Suivi logistique" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Préparations d’expéditions' }))
      .toHaveClass('sn-page__title');
    expect(screen.queryByRole('heading', { level: 2, name: 'Préparations d’expéditions' }))
      .not.toBeInTheDocument();
  });
});
