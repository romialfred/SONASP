import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CollectorsPage from './CollectorsPage';

const mocks = vi.hoisted(() => ({ list: vi.fn(), user:{} as Record<string,unknown> }));
vi.mock('@/services/collectorService', () => ({ collectorService: mocks }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/components/layout/NationalDashboardLayout', () => ({ NationalDashboardLayout: ({ children }: { children:React.ReactNode }) => children }));
vi.mock('./CollectorDetails', () => ({ CollectorDetails: ({paymentForm}:{paymentForm:React.ReactNode}) => <div>Dossier chargé{paymentForm}</div> }));

function page(id = '') {
  return <MemoryRouter initialEntries={[`/artisan-minier/collecteurs${id ? `/${id}` : ''}`]}>
    <Link to="/artisan-minier/collecteurs/dossier-cible">Autre fiche</Link>
    <Routes><Route path="/artisan-minier/collecteurs/:id?" element={<CollectorsPage />} /></Routes>
  </MemoryRouter>;
}
const show = (id='') => render(page(id));
beforeEach(() => { vi.resetAllMocks(); mocks.user={id:'owner',role:'owner',is_active:true}; });

describe('Lecture du registre des collecteurs', () => {
  it('ne présente ni liste vide ni statistiques après un échec initial', async () => {
    mocks.list.mockRejectedValue(new Error('Lecture indisponible'));
    show();
    await screen.findByText('Lecture indisponible');
    expect(screen.queryByText('Aucun collecteur ne correspond à votre recherche.')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name:'Synthèse des collecteurs' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name:'Réessayer' })).toBeEnabled();
  });
  it('ne déclare pas un dossier introuvable quand sa lecture échoue', async () => {
    mocks.list.mockRejectedValue(new Error('Lecture indisponible'));
    show('dossier-cible');
    await screen.findByText('Lecture indisponible');
    expect(screen.queryByText('Collecteur introuvable dans votre périmètre.')).not.toBeInTheDocument();
  });
  it('permet de reprendre puis affiche un vide réellement vérifié', async () => {
    mocks.list.mockRejectedValueOnce(new Error('Lecture indisponible')).mockResolvedValueOnce([]);
    show();
    fireEvent.click(await screen.findByRole('button', { name:'Réessayer' }));
    expect(await screen.findByText('Aucun collecteur ne correspond à votre recherche.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(mocks.list).toHaveBeenCalledTimes(2);
  });
  it('conserve le message introuvable après une lecture complète réussie', async () => {
    mocks.list.mockResolvedValue([]);
    show('dossier-cible');
    expect(await screen.findByText('Collecteur introuvable dans votre périmètre.')).toBeInTheDocument();
  });
  it('retire les anciens compteurs si une actualisation échoue', async () => {
    mocks.list.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('Lecture indisponible'));
    show();
    await screen.findByRole('region', { name:'Synthèse des collecteurs' });
    fireEvent.click(screen.getByRole('button', { name:'Actualiser' }));
    await screen.findByText('Lecture indisponible');
    await waitFor(() => expect(screen.queryByRole('region', { name:'Synthèse des collecteurs' })).not.toBeInTheDocument());
  });
  it('ignore une réponse précédente arrivée après la navigation vers une autre fiche', async () => {
    let resolvePrevious!:(value:unknown[])=>void;
    mocks.list.mockImplementationOnce(()=>new Promise(resolve=>{resolvePrevious=resolve;})).mockResolvedValueOnce([]);
    show();
    fireEvent.click(screen.getByRole('link',{name:'Autre fiche'}));
    await screen.findByText('Collecteur introuvable dans votre périmètre.');
    await act(async()=>resolvePrevious([{
      id:'dossier-cible',identity:{nom:'Ancien',prenoms:'Résultat',telephone:''},
      organization_id:'org',organization_name:'Organisme',site_ids:[],
    }]));
    expect(screen.queryByText('Dossier chargé')).not.toBeInTheDocument();
    expect(screen.getByText('Collecteur introuvable dans votre périmètre.')).toBeInTheDocument();
  });
  it('réinitialise la délégation et la fiche quand les habilitations du même compte changent', async () => {
    mocks.list.mockResolvedValue([{
      id:'dossier-cible',identity:{nom:'Collecteur',prenoms:'QA',telephone:''},
      organization_id:'org',organization_name:'Organisme',site_ids:[],
    }]);
    const {rerender}=show('dossier-cible');
    fireEvent.change(await screen.findByLabelText(/Justification/),{target:{value:'Justification du périmètre précédent'}});
    fireEvent.change(screen.getByLabelText('Autoriser jusqu’au'),{target:{value:'2026-12-31'}});
    mocks.user={...mocks.user,capabilities:['autre-capacite']};
    rerender(page('dossier-cible'));
    expect(await screen.findByLabelText(/Justification/)).toHaveValue('');
    expect(screen.getByLabelText('Autoriser jusqu’au')).toHaveValue('');
    expect(mocks.list).toHaveBeenCalledTimes(2);
  });
});
