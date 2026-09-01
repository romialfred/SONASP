import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, it, expect } from 'vitest';
import { PublicLocaleProvider, usePublicLocale } from './PublicLocaleContext';
function Probe() {
  const { locale, setLocale } = usePublicLocale();
  return <><span>{locale}</span><button onClick={() => setLocale('fr')}>French</button></>;
}
describe('Public locale preference', () => {
  beforeEach(() => localStorage.clear());
  it('defaults to English and persists an explicit preference', () => {
    const { unmount } = render(<PublicLocaleProvider><Probe /></PublicLocaleProvider>);
    expect(screen.getByText('en')).toBeInTheDocument(); expect(document.documentElement.lang).toBe('en');
    fireEvent.click(screen.getByRole('button', { name: 'French' }));
    expect(localStorage.getItem('sonasp-public-locale')).toBe('fr'); unmount();
    render(<PublicLocaleProvider><Probe /></PublicLocaleProvider>);
    expect(screen.getByText('fr')).toBeInTheDocument();
  });
});
