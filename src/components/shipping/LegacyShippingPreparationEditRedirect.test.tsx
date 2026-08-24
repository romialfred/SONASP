import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { LegacyShippingPreparationEditRedirect } from './LegacyShippingPreparationEditRedirect';

const preparationId = '123e4567-e89b-42d3-a456-426614174000';

function renderLegacyRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/shipping/preparation/edit/:id"
          element={<LegacyShippingPreparationEditRedirect />}
        />
        <Route
          path="/shipping/preparation/:id/edit"
          element={<div>Modification canonique</div>}
        />
        <Route path="/shipping/preparation" element={<div>Liste des préparations</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ancienne route de modification Shipping', () => {
  it('redirige un UUID valide vers la route canonique', () => {
    renderLegacyRoute(`/shipping/preparation/edit/${preparationId}`);

    expect(screen.getByText('Modification canonique')).toBeInTheDocument();
  });

  it('ne propage pas un identifiant invalide dans la destination', () => {
    renderLegacyRoute('/shipping/preparation/edit/identifiant-invalide');

    expect(screen.getByText('Liste des préparations')).toBeInTheDocument();
  });
});
