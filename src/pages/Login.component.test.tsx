import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '@/contexts/AuthContext';
import { Login } from './Login';
import french from '@/i18n/locales/fr/common.json';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOptions?: string | { year?: number; language?: string }) => {
      if (key === 'login.copyright') return '© 2026 Présidence du Burkina Faso. Tous droits réservés.';
      if (key === 'header.currentLanguage') return `Actuel: ${(fallbackOrOptions as { language?: string })?.language}`;
      const translated = key.split('.').reduce<unknown>((value, part) => (value as Record<string, unknown>)?.[part], french);
      return translated ?? (typeof fallbackOrOptions === 'string' ? fallbackOrOptions : key);
    },
    i18n: {
      language: 'fr',
      resolvedLanguage: 'fr',
      changeLanguage: vi.fn().mockResolvedValue(undefined),
    },
  }),
}));

const mockedUseAuth = vi.mocked(useAuth);
const signIn = vi.fn();

function renderLogin() {
  return render(<MemoryRouter><Login /></MemoryRouter>);
}

describe('page de connexion Faso SANAMA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    signIn.mockResolvedValue({});
    mockedUseAuth.mockReturnValue({ signIn } as unknown as ReturnType<typeof useAuth>);
  });

  it('affiche la marque Faso SANAMA et conserve SONASP parmi les institutions', () => {
    renderLogin();

    expect(screen.getByRole('img', { name: 'Faso SANAMA' })).toHaveAttribute('src', '/login-faso/faso-sanama.png');
    expect(screen.getByRole('img', { name: 'SONASP' })).toHaveAttribute('src', '/sonasp_logo.png');
    const identity = screen.getByRole('banner');
    expect(within(identity).getAllByRole('img').map((image) => image.getAttribute('alt'))).toEqual(['Armoiries du Burkina Faso', 'Faso SANAMA']);
  });

  it('annonce les deux champs requis et place le focus sur le premier', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(screen.getByText('Veuillez renseigner votre nom d’utilisateur.')).toBeInTheDocument();
    expect(screen.getByText('Veuillez renseigner votre mot de passe.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Nom d’utilisateur' })).toHaveFocus();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('garde la marque lisible si le fichier du logo ne peut pas être chargé', () => {
    renderLogin();
    fireEvent.error(screen.getByRole('img', { name: 'Faso SANAMA' }));
    expect(screen.queryByRole('img', { name: 'Faso SANAMA' })).not.toBeInTheDocument();
    expect(screen.getByText('Faso SANAMA')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeEnabled();
  });

  it('affiche et remasque le mot de passe sans soumettre le formulaire', async () => {
    const user = userEvent.setup();
    renderLogin();
    const password = screen.getByLabelText('Mot de passe');

    await user.type(password, 'valeur-confidentielle');
    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Afficher le mot de passe' }));
    expect(password).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Masquer le mot de passe' }));
    expect(password).toHaveAttribute('type', 'password');
    expect(password).toHaveValue('valeur-confidentielle');
    expect(signIn).not.toHaveBeenCalled();
  });

  it('transmet les identifiants sans proposer de session persistante', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByRole('textbox', { name: 'Nom d’utilisateur' }), ' Agent@Sonasp.bf ');
    await user.type(screen.getByLabelText('Mot de passe'), 'mot-de-passe');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(signIn).toHaveBeenCalledWith(' Agent@Sonasp.bf ', 'mot-de-passe');
    expect(screen.queryByRole('checkbox', { name: 'Se souvenir de moi' })).not.toBeInTheDocument();
  });

  it('relie les actions secondaires aux routes existantes', () => {
    renderLogin();
    expect(screen.getByRole('link', { name: 'Retour à la vitrine' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Mot de passe oublié ?' })).toHaveAttribute('href', '/recuperer-acces');
    expect(screen.getByRole('link', { name: 'Contactez l’administrateur' })).toHaveAttribute('href', '/assistance#incident');
    expect(screen.getByRole('link', { name: 'Confidentialité' })).toHaveAttribute('href', '/confidentialite');
    expect(screen.getByRole('link', { name: 'Assistance' })).toHaveAttribute('href', '/assistance');
  });

  it('présente le français comme langue active et réserve l’anglais à une prochaine version', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole('button', { name: /Actuel: Français/ }));

    expect(screen.getByRole('menuitemradio', { name: 'Français' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: 'Anglais — bientôt disponible' })).toBeDisabled();
  });

  it('suit un ordre de tabulation logique', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.tab();
    expect(screen.getByRole('link', { name: 'Retour à la vitrine' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: /Actuel: Français/ })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('textbox', { name: 'Nom d’utilisateur' })).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Mot de passe')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Afficher le mot de passe' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('link', { name: 'Mot de passe oublié ?' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Se connecter' })).toHaveFocus();
  });
  it('respecte les textes validés et les cinq institutions dans leur ordre', () => {
    renderLogin();
    const title = screen.getByRole('heading', { level: 1 });
    expect(Array.from(title.children).map((line) => line.textContent)).toEqual([
      'Plateforme Nationale', 'de Traçabilité du', 'Secteur Minier',
    ]);
    expect(screen.getByText('Accédez à votre espace Faso SANAMA')).toBeInTheDocument();
    expect(screen.getByText('La performance minière au service du citoyen')).toBeInTheDocument();
    expect(screen.getByText('Production, collecte et vente')).toBeInTheDocument();
    expect(screen.getByText('Impôts et taxes · Artisans miniers')).toBeInTheDocument();
    const band = screen.getByRole('region', { name: 'Institutions du secteur minier' });
    expect(within(band).getAllByRole('img').map((logo) => logo.getAttribute('alt'))).toEqual([
      'Présidence du Faso', 'SONASP', 'Ministère des Finances', 'Ministère des Mines et de l’Énergie', 'BUMIGEB',
    ]);
    expect(within(band).getAllByRole('listitem')).toHaveLength(5);
    expect(within(band).queryByText(/DGMG/)).not.toBeInTheDocument();
    expect(screen.getByText('© 2026 Présidence du Burkina Faso. Tous droits réservés.')).toBeInTheDocument();
    expect(screen.getByText('Conception & support : Quantix Solutions Burkina Faso')).toBeInTheDocument();
  });

  it('limite les nouvelles métadonnées à la page de connexion', () => {
    const previousTitle = document.title;
    const { unmount } = renderLogin();
    expect(document.title).toBe('Connexion | Faso SANAMA');
    expect(document.querySelector('meta[property="og:site_name"]')).toHaveAttribute('content', 'Faso SANAMA');
    unmount();
    expect(document.title).toBe(previousTitle);
  });

  it('soumet avec Entrée et empêche les soumissions concurrentes', async () => {
    const user = userEvent.setup();
    let finish!: (value: { error?: string }) => void;
    signIn.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    renderLogin();
    await user.type(screen.getByRole('textbox', { name: 'Nom d’utilisateur' }), 'agent@example.test');
    await user.type(screen.getByLabelText('Mot de passe'), 'valeur-confidentielle{Enter}');
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('form', { name: 'Connexion' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: /Connexion/ })).toBeDisabled();
    fireEvent.submit(screen.getByRole('form', { name: 'Connexion' }));
    fireEvent.submit(screen.getByRole('form', { name: 'Connexion' }));
    expect(signIn).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ error: 'Invalid login credentials' }); });
    expect(screen.getByRole('alert')).toHaveTextContent('Nom d’utilisateur ou mot de passe incorrect.');
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeEnabled();
  });

  it('gère une erreur réseau sans exposer le détail technique et permet de réessayer', async () => {
    const user = userEvent.setup();
    signIn.mockRejectedValueOnce(new Error('Failed to fetch: internal network details'));
    renderLogin();
    await user.type(screen.getByRole('textbox', { name: 'Nom d’utilisateur' }), 'agent@example.test');
    await user.type(screen.getByLabelText('Mot de passe'), 'valeur-confidentielle');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect(screen.getByRole('alert')).toHaveTextContent('La connexion est momentanément indisponible. Veuillez réessayer.');
    expect(screen.queryByText(/internal network details/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect(signIn).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('ferme le choix de langue avec Échap et rend le focus au bouton', async () => {
    const user = userEvent.setup();
    renderLogin();
    const trigger = screen.getByRole('button', { name: /Actuel: Français/ });
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

});
