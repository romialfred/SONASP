import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('affiche le libellé français centralisé quand aucun libellé explicite n’est fourni', () => {
    render(<StatusBadge status="validated_for_refinery" />);
    expect(screen.getByText('Validé pour la raffinerie')).toBeInTheDocument();
  });

  it('n’affiche pas le code brut d’un statut inconnu', () => {
    render(<StatusBadge status="future_status" />);
    expect(screen.getByText('Statut non reconnu')).toBeInTheDocument();
    expect(screen.queryByText('future_status')).not.toBeInTheDocument();
  });
});
