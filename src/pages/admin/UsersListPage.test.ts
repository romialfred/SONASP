import { describe, expect, it } from 'vitest';
import { EMPTY_USER_FILTERS, filterUsers, type AdminUser } from './UsersListPage';

const users: AdminUser[] = [
  {
    id: 'comptoir-1',
    full_name: 'Comptoir NAFO',
    email: 'nafo@comptoir.bf',
    role: 'customer',
    account_type: 'comptoir',
    mining_company_names: ['NAFO'],
    is_active: true,
    last_login_at: null,
    created_at: '2026-08-24T00:00:00Z',
  },
  {
    id: 'client-1',
    full_name: 'Client export',
    email: 'client@example.com',
    role: 'customer',
    account_type: null,
    mining_company_names: [],
    is_active: true,
    last_login_at: null,
    created_at: '2026-08-24T00:00:00Z',
  },
];

describe('filtrage des profils métier', () => {
  it('distingue le Comptoir d’achat du rôle technique Client', () => {
    expect(filterUsers(users, { ...EMPTY_USER_FILTERS, role: 'comptoir' })).toEqual([users[0]]);
    expect(filterUsers(users, { ...EMPTY_USER_FILTERS, role: 'customer' })).toEqual([users[1]]);
  });
});
