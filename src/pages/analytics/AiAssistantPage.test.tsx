import type { ReactNode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AiAssistantPage, {
  REPONSE_INDISPONIBLE,
  SUGGESTIONS,
  initialesUtilisateur,
  titreDepuisQuestion,
} from './AiAssistantPage';

vi.mock('@/components/layout/NationalDashboardLayout', () => ({
  NationalDashboardLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { full_name: 'Awa Traoré' } }),
}));

const composeur = () => screen.getByLabelText('Votre question');

describe('titreDepuisQuestion', () => {
  it('reprend la question courte telle quelle', () => {
    expect(titreDepuisQuestion('Production de mai')).toBe('Production de mai');
  });

  it('tronque une question longue', () => {
    const titre = titreDepuisQuestion('a'.repeat(80));
    expect(titre).toHaveLength(42);
    expect(titre.endsWith('…')).toBe(true);
  });

  it('retombe sur un libellé neutre si la question est vide', () => {
    expect(titreDepuisQuestion('   ')).toBe('Nouvelle conversation');
  });
});

describe('initialesUtilisateur', () => {
  it('prend les deux premiers mots du nom', () => {
    expect(initialesUtilisateur('Awa Traoré')).toBe('AT');
  });

  it('découpe aussi une adresse électronique', () => {
    expect(initialesUtilisateur('awa.traore@sonasp.bf')).toBe('AT');
  });

  it('reste lisible sans nom', () => {
    expect(initialesUtilisateur(null)).toBe('?');
  });
});

describe('AiAssistantPage', () => {
  it('annonce que le moteur n’est pas raccordé', () => {
    render(<AiAssistantPage />);
    expect(screen.getByText('Moteur non raccordé')).toBeInTheDocument();
    expect(screen.getByText(/n’est pas encore/)).toBeInTheDocument();
  });

  it('propose des amorces à l’ouverture', () => {
    render(<AiAssistantPage />);
    expect(screen.getByText('Que souhaitez-vous analyser ?')).toBeInTheDocument();
    SUGGESTIONS.forEach((suggestion) => {
      expect(screen.getByText(suggestion.titre)).toBeInTheDocument();
    });
  });

  it('empêche l’envoi tant que rien n’est saisi', () => {
    render(<AiAssistantPage />);
    expect(screen.getByLabelText('Envoyer la question')).toBeDisabled();
    fireEvent.change(composeur(), { target: { value: 'Combien d’artisans actifs ?' } });
    expect(screen.getByLabelText('Envoyer la question')).toBeEnabled();
  });

  it('affiche la question posée et la réponse d’attente', () => {
    render(<AiAssistantPage />);
    fireEvent.change(composeur(), { target: { value: 'Combien d’artisans actifs ?' } });
    fireEvent.click(screen.getByLabelText('Envoyer la question'));

    // Le titre de la conversation reprend la question : on cible le fil.
    const fil = screen.getByLabelText('Conversation');
    expect(within(fil).getByText('Combien d’artisans actifs ?')).toBeInTheDocument();
    // La page ne fabrique aucune statistique : elle dit que rien n'a été interrogé.
    expect(screen.getByText(REPONSE_INDISPONIBLE)).toBeInTheDocument();
    expect(screen.getByText(/Aucune donnée interrogée/)).toBeInTheDocument();
    expect(composeur()).toHaveValue('');
  });

  it('nomme la conversation d’après la première question', () => {
    render(<AiAssistantPage />);
    fireEvent.change(composeur(), { target: { value: 'Taxes du trimestre' } });
    fireEvent.click(screen.getByLabelText('Envoyer la question'));

    const historique = screen.getByLabelText('Conversations');
    expect(within(historique).getByText('Taxes du trimestre')).toBeInTheDocument();
  });

  it('envoie l’amorce cliquée', () => {
    render(<AiAssistantPage />);
    fireEvent.click(screen.getByText(SUGGESTIONS[0].titre));
    expect(screen.getByText(SUGGESTIONS[0].invite)).toBeInTheDocument();
  });

  it('envoie à la touche Entrée mais insère un retour à la ligne avec Maj', () => {
    render(<AiAssistantPage />);
    fireEvent.change(composeur(), { target: { value: 'Production de mai' } });
    fireEvent.keyDown(composeur(), { key: 'Enter', shiftKey: true });
    expect(screen.queryByText(REPONSE_INDISPONIBLE)).not.toBeInTheDocument();

    fireEvent.keyDown(composeur(), { key: 'Enter' });
    expect(screen.getByText(REPONSE_INDISPONIBLE)).toBeInTheDocument();
  });

  it('ouvre une conversation vierge et la supprime', () => {
    render(<AiAssistantPage />);
    fireEvent.change(composeur(), { target: { value: 'Ventes du mois' } });
    fireEvent.click(screen.getByLabelText('Envoyer la question'));

    fireEvent.click(screen.getByText('Nouvelle conversation'));
    expect(screen.queryByText(REPONSE_INDISPONIBLE)).not.toBeInTheDocument();

    const historique = screen.getByLabelText('Conversations');
    expect(within(historique).getByText('Ventes du mois')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Supprimer « Ventes du mois »'));
    expect(within(historique).queryByText('Ventes du mois')).not.toBeInTheDocument();
  });

  it('affiche les initiales de l’utilisateur connecté', () => {
    render(<AiAssistantPage />);
    fireEvent.change(composeur(), { target: { value: 'Production de mai' } });
    fireEvent.click(screen.getByLabelText('Envoyer la question'));
    expect(screen.getByText('AT')).toBeInTheDocument();
  });
});
