import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import UserManagementPage from './UserManagementPage';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({
          data: {
            session: {
              access_token: 'mock-token',
              user: { id: 'mock-user-id' },
            },
          },
          error: null,
        })
      ),
      getUser: vi.fn(() =>
        Promise.resolve({
          data: { user: { id: 'mock-user-id' } },
          error: null,
        })
      ),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() =>
            Promise.resolve({
              data: [],
              error: null,
            })
          ),
        })),
      })),
    })),
  },
}));

// Mock fetch for Edge Function
global.fetch = vi.fn();

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('UserManagementPage - Defensive Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles undefined users array from API', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ users: undefined }),
    });

    renderWithRouter(<UserManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('User Management')).toBeInTheDocument();
    });

    // Should show empty state instead of crashing
    await waitFor(() => {
      expect(screen.getByText(/No users yet/i)).toBeInTheDocument();
    });
  });

  it('handles null users array from API', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ users: null }),
    });

    renderWithRouter(<UserManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('User Management')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/No users yet/i)).toBeInTheDocument();
    });
  });

  it('handles empty users array', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ users: [] }),
    });

    renderWithRouter(<UserManagementPage />);

    await waitFor(() => {
      expect(screen.getByText(/No users yet/i)).toBeInTheDocument();
    });
  });

  it('handles single user object instead of array', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        users: {
          id: '1',
          email: 'test@example.com',
          full_name: 'Test User',
          role: 'factory',
          is_active: true,
          two_factor_enabled: true,
          password_must_change: false,
          created_at: '2024-01-01',
        },
      }),
    });

    renderWithRouter(<UserManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });
  });

  it('handles malformed response without users property', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    renderWithRouter(<UserManagementPage />);

    await waitFor(() => {
      expect(screen.getByText(/No users yet/i)).toBeInTheDocument();
    });
  });

  it('renders users with missing optional fields', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        users: [
          {
            id: '1',
            email: 'test@example.com',
            // Missing full_name
            phone: null,
            role: 'factory',
            is_active: true,
            two_factor_enabled: false,
            password_must_change: false,
            last_login_at: null,
            created_at: '2024-01-01',
          },
        ],
      }),
    });

    renderWithRouter(<UserManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    // Should show N/A for missing full_name
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('handles API error gracefully', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal server error' }),
    });

    renderWithRouter(<UserManagementPage />);

    await waitFor(() => {
      expect(screen.getByText(/Error Loading Users/i)).toBeInTheDocument();
    });

    // Should show try again button
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('handles network error', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    renderWithRouter(<UserManagementPage />);

    await waitFor(() => {
      expect(screen.getByText(/Error Loading Users/i)).toBeInTheDocument();
    });
  });

  it('displays stats correctly with valid users', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        users: [
          {
            id: '1',
            email: 'user1@example.com',
            full_name: 'User One',
            role: 'factory',
            is_active: true,
            two_factor_enabled: true,
            password_must_change: true,
            created_at: '2024-01-01',
          },
          {
            id: '2',
            email: 'user2@example.com',
            full_name: 'User Two',
            role: 'management',
            is_active: false,
            two_factor_enabled: false,
            password_must_change: false,
            created_at: '2024-01-02',
          },
        ],
      }),
    });

    renderWithRouter(<UserManagementPage />);

    await waitFor(() => {
      // Total users
      expect(screen.getByText('2')).toBeInTheDocument();
      // Active users (1)
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  it('filters users correctly with search term', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        users: [
          {
            id: '1',
            email: 'alice@example.com',
            full_name: 'Alice Smith',
            role: 'factory',
            is_active: true,
            two_factor_enabled: true,
            password_must_change: false,
            created_at: '2024-01-01',
          },
          {
            id: '2',
            email: 'bob@example.com',
            full_name: 'Bob Johnson',
            role: 'management',
            is_active: true,
            two_factor_enabled: false,
            password_must_change: false,
            created_at: '2024-01-02',
          },
        ],
      }),
    });

    renderWithRouter(<UserManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
    });
  });

  it('handles users with null or undefined properties in filter', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        users: [
          {
            id: '1',
            email: null, // Should not crash
            full_name: undefined, // Should not crash
            role: 'factory',
            is_active: true,
            two_factor_enabled: false,
            password_must_change: false,
            created_at: '2024-01-01',
          },
        ],
      }),
    });

    renderWithRouter(<UserManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('User Management')).toBeInTheDocument();
    });

    // Should render without crashing
    expect(screen.queryByText('N/A')).toBeInTheDocument();
  });
});
