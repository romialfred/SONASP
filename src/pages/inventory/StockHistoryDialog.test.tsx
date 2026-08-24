import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StockHistoryDialog } from './StockHistoryDialog';

describe('StockHistoryDialog', () => {
  it('affiche les références réelles du poste et se ferme avec Échap', () => {
    const onClose = vi.fn();
    render(
      <StockHistoryDialog
        titre="Disponible à la vente"
        totalOz={125.5}
        lignes={[
          {
            id: 'stock-1',
            poste: 'disponible',
            date: '2026-08-20',
            reference: 'CERT-SOP-001',
            quantiteOz: 125.5,
            libelle: 'Stock mobilisable',
            detail: 'Coffre principal',
          },
        ]}
        onClose={onClose}
      />
    );

    expect(screen.getByRole('dialog', { name: 'Disponible à la vente' })).toBeInTheDocument();
    expect(screen.getByText('CERT-SOP-001')).toBeInTheDocument();
    expect(screen.getByText(/Coffre principal/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fermer l’historique' })).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('présente un état vide explicite', () => {
    render(<StockHistoryDialog titre="À l’aéroport" totalOz={0} lignes={[]} onClose={() => undefined} />);
    expect(screen.getByText('Aucun mouvement disponible')).toBeInTheDocument();
  });
});
