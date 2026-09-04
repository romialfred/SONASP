import { render, screen } from '@testing-library/react';
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
