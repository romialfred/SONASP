import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InstitutionalPortalPage } from './InstitutionalPortalPage';

vi.mock('./DgiFiscalDashboard', () => ({
  DgiFiscalDashboard: () => <main><h1>Collecte des taxes et impôts</h1></main>,
}));

vi.mock('./DgmgRegulatoryDashboard', () => ({
  DgmgRegulatoryDashboard: () => <main><h1>Tableau de bord réglementaire</h1></main>,
}));

describe('aiguillage des portails institutionnels', () => {
  it('isole le tableau réglementaire DGMG du portail fiscal', () => {
    render(<InstitutionalPortalPage portal="dgmg" />);
    expect(screen.getByRole('heading', { name: 'Tableau de bord réglementaire' })).toBeInTheDocument();
    expect(screen.queryByText('Collecte des taxes et impôts')).not.toBeInTheDocument();
  });

  it('conserve le tableau de collecte DGI inchangé', () => {
    render(<InstitutionalPortalPage portal="dgi" />);
    expect(screen.getByRole('heading', { name: 'Collecte des taxes et impôts' })).toBeInTheDocument();
    expect(screen.queryByText('Tableau de bord réglementaire')).not.toBeInTheDocument();
  });
});
