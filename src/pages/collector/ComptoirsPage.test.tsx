import { act, fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ComptoirsPage from './ComptoirsPage';
import { emptyComptoir } from '@/lib/comptoirDossier';

const mocks = vi.hoisted(() => ({ list:vi.fn() }));
vi.mock('@/services/comptoirService', () => ({ comptoirService:mocks }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth:() => ({user:{id:'owner',role:'owner',is_active:true}}) }));
vi.mock('@/components/layout/NationalDashboardLayout', () => ({ NationalDashboardLayout:({children}:{children:React.ReactNode}) => children }));
beforeEach(() => { vi.resetAllMocks(); });
const show = () => render(<MemoryRouter><Link to="/nouvelle-lecture">Nouvelle lecture</Link><ComptoirsPage /></MemoryRouter>);

describe('Lecture du registre des comptoirs', () => {
  it('ne présente pas de zéros avant la fin du chargement', () => {
    mocks.list.mockImplementation(() => new Promise(() => {}));
    show();
    expect(screen.queryByRole('region', { name:'Synthèse des comptoirs' })).not.toBeInTheDocument();
  });
  it('ne présente pas de statistiques à zéro après un refus de lecture', async () => {
    mocks.list.mockRejectedValue(new Error('Lecture indisponible'));
    show();
    await screen.findByText('Lecture indisponible');
    expect(screen.queryByRole('region', { name:'Synthèse des comptoirs' })).not.toBeInTheDocument();
    expect(screen.getByText('La liste est indisponible. Réessayez le chargement.')).toBeInTheDocument();
  });
  it('affiche le vide vérifié après une reprise réussie', async () => {
    mocks.list.mockRejectedValueOnce(new Error('Lecture indisponible')).mockResolvedValueOnce([]);
    show();
    fireEvent.click(await screen.findByRole('button', { name:'Réessayer' }));
    expect(await screen.findByText('Aucun comptoir ne correspond à la recherche.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name:'Synthèse des comptoirs' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('retire les anciens compteurs quand une actualisation échoue', async () => {
    mocks.list.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('Lecture indisponible'));
    show();
    await screen.findByRole('region', { name:'Synthèse des comptoirs' });
    fireEvent.click(screen.getByRole('button', { name:'Actualiser' }));
    await screen.findByText('Lecture indisponible');
    expect(screen.queryByRole('region', { name:'Synthèse des comptoirs' })).not.toBeInTheDocument();
  });
  it('ignore une réponse ancienne après un nouveau chargement de route', async () => {
    let resolvePrevious!:(value:unknown[])=>void;
    mocks.list.mockImplementationOnce(()=>new Promise(resolve=>{resolvePrevious=resolve;})).mockResolvedValueOnce([]);
    show();
    fireEvent.click(screen.getByRole('link',{name:'Nouvelle lecture'}));
    await screen.findByText('Aucun comptoir ne correspond à la recherche.');
    await act(async()=>resolvePrevious([{
      id:'ancienne-fiche',name:'Ancien résultat',code:'CPT-ANCIEN',documents:[],values:emptyComptoir(),
    }]));
    expect(screen.queryByText('Ancien résultat')).not.toBeInTheDocument();
    expect(screen.getByText('Aucun comptoir ne correspond à la recherche.')).toBeInTheDocument();
  });
});
