import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { PlatformLoading } from './components/common/PlatformLoading';
import { PwaUpdatePrompt } from './components/common/PwaUpdatePrompt';

const PrivateApp = lazy(() => import('./PrivateApp'));
const PublicHomePage = lazy(() => import('./pages/public/PublicHomePage'));
const PublicLayout = lazy(() => import('./pages/public/PublicLayout'));
const PublicNewsPage = lazy(() => import('./pages/public/PublicNewsPage'));
const PublicNewsDetailPage = lazy(() => import('./pages/public/PublicNewsDetailPage'));
const PublicAssistancePage = lazy(() => import('./pages/public/PublicAssistancePage'));
const PublicLegalPage = lazy(() => import('./pages/public/PublicLegalPage'));
const PublicNotFoundPage = lazy(() => import('./pages/public/PublicNotFoundPage'));

export default function App() {
  return (
    <>
      <PwaUpdatePrompt />
      <BrowserRouter>
        <Suspense fallback={<PlatformLoading />}>
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
    </>
  );
}
