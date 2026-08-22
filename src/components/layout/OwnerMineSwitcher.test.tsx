import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '@/contexts/AuthContext';
import { minePortalService } from '@/services/minePortalService';
import { OwnerMineSwitcher } from './OwnerMineSwitcher';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('@/services/minePortalService', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/minePortalService')>();
  return { ...original, minePortalService: { ...original.minePortalService, listCompanies: vi.fn() } };
});
const mockedUseAuth = vi.mocked(useAuth);
const mockedList = vi.mocked(minePortalService.listCompanies);

function LocationProbe() { const location = useLocation(); return <output>{location.pathname}{location.search}</output>; }

describe('OwnerMineSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAuth.mockReturnValue({ user: { role: 'owner', is_active: true } } as ReturnType<typeof useAuth>);
    mockedList.mockResolvedValue([{ id: 'mine-1', name: 'Mine A', abbreviation: 'MA', code: 'M-A' }]);
  });

  it('ouvre le portail réel de la société choisie', async () => {
    render(<MemoryRouter initialEntries={['/dashboard']}><OwnerMineSwitcher /><Routes><Route path="*" element={<LocationProbe />} /></Routes></MemoryRouter>);
    const select = await screen.findByLabelText('Choisir une société minière');
    await waitFor(() => expect(select).not.toBeDisabled());
    await userEvent.selectOptions(select, 'mine-1');
    expect(screen.getByText('/portail-mine?mine=mine-1')).toBeInTheDocument();
  });
});
