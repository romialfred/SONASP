import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BankAccountForm, type BankAccount } from './BankAccountForm';

const bank: BankAccount = {
  bankName: 'Coris Bank International',
  country: 'Burkina Faso',
  city: 'Ouagadougou',
  accountNumber: '',
  iban: '',
  swiftCode: '',
  currency: 'XOF',
  isPrimary: true,
  isActive: true,
};

describe('BankAccountForm', () => {
  it('affiche les banques ivoiriennes avec la valeur historique anglaise du pays', () => {
    render(<BankAccountForm banks={[{ ...bank, country: 'Ivory Coast', bankName: 'Ecobank Côte d\'Ivoire' }]} onChange={vi.fn()} />);
    expect(screen.getByRole('option', { name: 'Côte d’Ivoire' })).toHaveValue('Ivory Coast');
    expect(screen.getByRole('option', { name: 'Ecobank Côte d\'Ivoire' })).toBeInTheDocument();
  });

  it('ne propose pas les banques de Guinée à un compte de Papouasie-Nouvelle-Guinée', () => {
    render(<BankAccountForm banks={[{ ...bank, country: 'Papua New Guinea', bankName: 'Banque locale' }]} onChange={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: /Nom de la banque/ })).toHaveValue('Banque locale');
    expect(screen.queryByRole('option', { name: 'Ecobank Guinée' })).not.toBeInTheDocument();
  });

  it('permet de saisir et conserver intégralement une banque hors catalogue', async () => {
    function Dossier() { const [banks, setBanks] = useState([bank]); return <BankAccountForm banks={banks} onChange={setBanks} />; }
    render(<Dossier />);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText(/Nom de la banque/), '__other__');
    await user.type(screen.getByRole('textbox', { name: /Nom de la banque hors catalogue/ }), 'Banque de recette');
    expect(screen.getByRole('textbox', { name: /Nom de la banque hors catalogue/ })).toHaveValue('Banque de recette');
  });

  it('conserve une banque hors catalogue lors de la réouverture', () => {
    render(<BankAccountForm banks={[{ ...bank, bankName: 'Banque de recette' }]} onChange={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: /Nom de la banque hors catalogue/ })).toHaveValue('Banque de recette');
  });

  it('change le compte principal sans muter les objets reçus', async () => {
    const original = Object.freeze({ ...bank });
    const second = Object.freeze({ ...bank, id: 'second', isPrimary: false });
    const change = vi.fn();
    render(<BankAccountForm banks={[original, second]} onChange={change} />);
    await userEvent.click(screen.getByRole('button', { name: /Ouvrir le compte bancaire 2/ }));
    await userEvent.click(screen.getByLabelText('Définir comme compte bancaire principal'));
    expect(original.isPrimary).toBe(true);
    expect(change).toHaveBeenLastCalledWith([{ ...original, isPrimary: false }, { ...second, isPrimary: true }]);
  });
  it('affiche l’état vide et son action en français', () => {
    render(<BankAccountForm banks={[]} onChange={vi.fn()} />);

    expect(screen.getByText('Aucun compte bancaire ajouté')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ajouter le premier compte bancaire' })).toBeInTheDocument();
  });

  it('traduit les libellés sans modifier les codes métier', () => {
    render(<BankAccountForm banks={[bank]} onChange={vi.fn()} />);

    expect(screen.getByText('Principal')).toBeInTheDocument();
    expect(screen.getByText('Code SWIFT/BIC')).toBeInTheDocument();
    const xof = screen.getByRole('option', { name: 'XOF — franc CFA d’Afrique de l’Ouest' });
    expect(xof).toHaveValue('XOF');
  });
});
