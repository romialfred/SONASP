import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '@/contexts/AuthContext';
import { Login } from './Login';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }));

const translations: Record<string, string> = {
  'login.officialPlatform': 'Plateforme officielle SONASP',
  'login.heroTitleLine1': 'Collecte et vente des',
  'login.heroTitleLine2': 'substances précieuses',
  'login.heroSubtitleLine1': 'Une plateforme sécurisée pour gérer les opérations,',
  'login.heroSubtitleLine2': 'les transactions et les données du secteur.',
  'login.pillar1': 'Transactions sécurisées',
  'login.pillar2': 'Suivi des opérations',
  'login.pillar3': 'Données fiables',
  'login.securedSpace': 'Espace professionnel sécurisé',
  'auth.login': 'Connexion',
  'login.cardSubtitle': 'Accédez à votre espace SONASP',
  'login.usernameLabel': 'Nom d’utilisateur',
  'login.usernamePlaceholder': 'Entrez votre nom d’utilisateur',
  'auth.password': 'Mot de passe',
  'login.passwordPlaceholder': 'Entrez votre mot de passe',
  'login.showPassword': 'Afficher le mot de passe',
  'login.hidePassword': 'Masquer le mot de passe',
  'auth.rememberMe': 'Se souvenir de moi',
  'login.forgotPassword': 'Mot de passe oublié ?',
  'login.backToShowcase': 'Retour à la vitrine',
  'auth.loginButton': 'Se connecter',
  'auth.loggingIn': 'Connexion…',
  'login.encrypted': 'Connexion chiffrée et accès protégé',
  'login.needHelp': 'Besoin d’aide ?',
  'login.contactAdmin': 'Contactez l’administrateur',
  'login.usernameRequired': 'Veuillez renseigner votre nom d’utilisateur.',
  'login.passwordRequired': 'Veuillez renseigner votre mot de passe.',
  'login.unavailable': 'La connexion est momentanément indisponible. Veuillez réessayer.',
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOptions?: string | { year?: number; language?: string }) => {
      if (key === 'login.copyright') return '© 2026 SONASP. Tous droits réservés.';
      if (key === 'header.currentLanguage') return `Actuel: ${(fallbackOrOptions as { language?: string })?.language}`;
      return translations[key] ?? (typeof fallbackOrOptions === 'string' ? fallbackOrOptions : key);
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

describe('page de connexion SONASP', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signIn.mockResolvedValue({});
    mockedUseAuth.mockReturnValue({ signIn } as unknown as ReturnType<typeof useAuth>);
  });

  it('affiche le logo officiel SONASP complet', () => {
    renderLogin();

    expect(screen.getByRole('img', { name: 'SONASP' })).toHaveAttribute('src', '/sonasp_logo.png');
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

  it('affiche et remasque le mot de passe sans soumettre le formulaire', async () => {
    const user = userEvent.setup();
    renderLogin();
    const password = screen.getByLabelText('Mot de passe');

    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Afficher le mot de passe' }));
    expect(password).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Masquer le mot de passe' }));
    expect(password).toHaveAttribute('type', 'password');
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
});
