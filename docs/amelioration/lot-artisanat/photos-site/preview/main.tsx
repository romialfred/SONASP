import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import ArtisanalSiteForm from '@/pages/artisanal-sites/ArtisanalSiteForm';
import ArtisanalSiteDetails from '@/pages/artisanal-sites/ArtisanalSiteDetails';
import ArtisanalSitesOverview from '@/pages/artisanal-sites/ArtisanalSitesOverview';
import ArtisanalSiteProduction from '@/pages/artisanal-sites/ArtisanalSiteProduction';
import { NationalDashboardChrome } from '@/components/layout/NationalDashboardLayout';
import { DialogProvider } from '@/contexts/DialogContext';
import { simulation } from './transport';
import { SITE_DATA_CHANGED } from './site-service';
import '@/index.css';
import '@/styles/design-system.css';
import '@/i18n/config';
import './preview.css';

// Fixture actions belong to this isolated test bench, never to application source.
async function selectFixtureFiles(invalid = false) {
  const input = document.querySelector<HTMLInputElement>('input[aria-label="Ajouter des photos du site"]');
  if (!input) return;
  const image = await (await fetch('/login-gold-background.webp')).blob();
  const transfer = new DataTransfer();
  transfer.items.add(new File([image], 'photo-qa-valide.webp', { type: 'image/webp' }));
  if (invalid) transfer.items.add(new File(['invalid image deliberately supplied by QA'], 'photo-qa-illisible.png', { type: 'image/png' }));
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
function BenchControls() {
  const [, update] = useState(0);
  useEffect(() => { const refresh = () => update(value => value + 1); window.addEventListener('qa-log', refresh); return () => window.removeEventListener('qa-log', refresh); }, []);
  return <details className="photo-qa-controls"><summary>Commandes du banc isolé</summary>
    <nav><Link to="/artisan-sites">Vue d'ensemble</Link> <Link to="/artisan-sites/production">Production</Link> <Link to="/artisan-sites/qa-site/modifier">Modifier la fixture</Link> <Link to="/artisan-sites/new">Créer</Link> <Link to="/artisan-sites/qa-site">Détails</Link></nav>
    {(['uploadError', 'readError', 'removeError', 'saveError'] as const).map((name, index) => <label key={name}><input type="checkbox" checked={simulation[name]} onChange={event => { simulation[name] = event.target.checked; update(value => value + 1); }} /> {['Refuser les dépôts simulés', 'Refuser la seconde lecture simulée', 'Refuser les retraits simulés', 'Refuser la sauvegarde simulée'][index]}</label>)}
    {(['dataError', 'dataDelay', 'emptySites'] as const).map((name, index) => <label key={name}><input type="checkbox" checked={simulation[name]} onChange={event => { simulation[name] = event.target.checked; update(value => value + 1); }} /> {['Refuser la lecture du dossier simulé', 'Retarder la lecture du dossier de 5 secondes', 'Retourner une liste de sites vide'][index]}</label>)}
    <button onClick={() => window.dispatchEvent(new Event(SITE_DATA_CHANGED))}>Relire les données simulées</button>
    <button onClick={() => {
      window.dispatchEvent(new Event('blur'));
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('pageshow'));
    }}>Retour d’onglet simulé</button>
    <button onClick={() => void selectFixtureFiles()}>Sélection QA : photo valide</button>
    <button onClick={() => void selectFixtureFiles(true)}>Sélection QA : valide + illisible</button>
    <p>Transport en mémoire : {simulation.objects.size} objet(s). Aucun serveur de données.</p>
    <ol>{simulation.calls.slice(-5).map((call, i) => <li key={i}>{call}</li>)}</ol>
  </details>;
}
function App() { return <DialogProvider>
  <div className="photo-qa-banner" role="note">BANC LOCAL — données fictives, Auth et Storage simulés, sauvegarde en mémoire uniquement</div>
  <NationalDashboardChrome><Routes>
    <Route path="/artisan-sites" element={<ArtisanalSitesOverview />} />
    <Route path="/artisan-sites/production" element={<ArtisanalSiteProduction />} />
    <Route path="/artisan-sites/new" element={<ArtisanalSiteForm />} />
    <Route path="/artisan-sites/:siteId/modifier" element={<ArtisanalSiteForm />} />
    <Route path="/artisan-sites/:siteId" element={<ArtisanalSiteDetails />} />
    <Route path="/" element={<Navigate to="/artisan-sites/qa-site/modifier" replace />} />
    <Route path="*" element={<div className="sn-page"><h2>Banc photos de sites</h2><p>Aucune navigation vers l’application distante.</p><Link to="/artisan-sites/qa-site/modifier">Modifier la fixture</Link></div>} />
  </Routes></NationalDashboardChrome><BenchControls />
</DialogProvider>; }
ReactDOM.createRoot(document.getElementById('root')!).render(<BrowserRouter><App /></BrowserRouter>);
