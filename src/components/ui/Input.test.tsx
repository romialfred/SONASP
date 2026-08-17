import { render, screen } from '@testing-library/react';
import { Search } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { Input } from './Input';

describe('Input', () => {
  it('renders a forwardRef icon component without treating it as a React child', () => {
    render(<Input aria-label="Recherche" icon={Search} />);

    expect(screen.getByRole('textbox', { name: 'Recherche' })).toBeInTheDocument();
    expect(document.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
