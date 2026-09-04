import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, it, expect } from 'vitest';
import { PublicLocaleProvider, usePublicLocale } from './PublicLocaleContext';
function Probe() {
  const { locale, setLocale } = usePublicLocale();
  return <><span>{locale}</span><button onClick={() => setLocale('en')}>Demander l’anglais</button></>;
}
describe('Préférence linguistique de la vitrine publique', () => {
  beforeEach(() => localStorage.clear());
  it('utilise le français par défaut et refuse une langue encore désactivée', () => {
    const { unmount } = render(<PublicLocaleProvider><Probe /></PublicLocaleProvider>);
    expect(screen.getByText('fr')).toBeInTheDocument(); expect(document.documentElement.lang).toBe('fr');
    fireEvent.click(screen.getByRole('button', { name: 'Demander l’anglais' }));
    expect(localStorage.getItem('sonasp-language')).toBe('fr'); unmount();
    render(<PublicLocaleProvider><Probe /></PublicLocaleProvider>);
    expect(screen.getByText('fr')).toBeInTheDocument();
  });

  it('ramène une ancienne préférence anglaise au français', () => {
    localStorage.setItem('sonasp-language', 'en');
    render(<PublicLocaleProvider><Probe /></PublicLocaleProvider>);
    expect(screen.getByText('fr')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('fr');
  });
});
