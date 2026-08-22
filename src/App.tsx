import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './public-loading.css';

const PrivateApp = lazy(() => import('./PrivateApp'));
const PublicHomePage = lazy(() => import('./pages/public/PublicHomePage'));
const PublicLayout = lazy(() => import('./pages/public/PublicLayout'));
const PublicNewsPage = lazy(() => import('./pages/public/PublicNewsPage'));
const PublicNewsDetailPage = lazy(() => import('./pages/public/PublicNewsDetailPage'));
const PublicAssistancePage = lazy(() => import('./pages/public/PublicAssistancePage'));
const PublicLegalPage = lazy(() => import('./pages/public/PublicLegalPage'));
const PublicNotFoundPage = lazy(() => import('./pages/public/PublicNotFoundPage'));

function PublicLoading() {
  return (
    <div className="sonasp-loading" role="status" aria-live="polite" aria-label="Chargement de la plateforme SONASP">
      <div className="sonasp-loading__flag" aria-hidden="true"><span /><span /><span /></div>
      <div className="sonasp-loading__panel">
        <img className="sonasp-loading__logo" src="/SONASP v2.png" alt="SONASP" width="621" height="211" />
        <div className="sonasp-hourglass" aria-hidden="true">
          <span className="sonasp-hourglass__bar sonasp-hourglass__bar--top" />
          <span className="sonasp-hourglass__glass">
            <i className="sonasp-hourglass__sand sonasp-hourglass__sand--top" />
            <i className="sonasp-hourglass__stream" />
            <i className="sonasp-hourglass__sand sonasp-hourglass__sand--bottom" />
          </span>
          <span className="sonasp-hourglass__bar sonasp-hourglass__bar--bottom" />
        </div>
        <div className="sonasp-loading__copy">
          <strong>Initialisation de la plateforme</strong>
          <span>Connexion aux services sécurisés SONASP…</span>
        </div>
        <div className="sonasp-loading__progress" aria-hidden="true"><span /></div>
        <small>Plateforme nationale de collecte et de vente de l’or</small>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PublicLoading />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<PublicHomePage />} />
            <Route path="/actualites" element={<PublicNewsPage />} />
            <Route path="/actualites/:slug" element={<PublicNewsDetailPage />} />
            <Route path="/assistance" element={<PublicAssistancePage />} />
            <Route path="/mentions-legales" element={<PublicLegalPage kind="legal" />} />
            <Route path="/confidentialite" element={<PublicLegalPage kind="privacy" />} />
            <Route path="/conditions-utilisation" element={<PublicLegalPage kind="terms" />} />
            <Route path="/securite" element={<PublicLegalPage kind="security" />} />
            <Route path="/404" element={<PublicNotFoundPage />} />
          </Route>
          <Route path="/*" element={<PrivateApp />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
