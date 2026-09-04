const visualUser = {
  id: 'visual-owner',
  email: 'controle-visuel@example.invalid',
  full_name: 'TIEGNAN Romuald',
  role: 'owner',
  is_active: true,
  capabilities: ['referentials.manage'],
};

export const useAuth = () => ({ user: visualUser });
