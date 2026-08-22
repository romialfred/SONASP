import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './i18n/config';

// Un ancien service worker de développement peut continuer à contrôler
// localhost et déclencher un rechargement à la reprise d'un onglet. Il n'a
// aucune utilité avec le serveur Vite : on le désenregistre sans interrompre
// la page courante. La PWA de production reste inchangée.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations().then((registrations) =>
    Promise.all(
      registrations
        .filter((registration) => registration.scope.startsWith(window.location.origin))
        .map((registration) => registration.unregister()),
    ),
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
