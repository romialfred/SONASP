import React from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route,Navigate} from 'react-router-dom';
import '../../src/i18n/config';
import '../../src/index.css';
import CollectorForm from '../../src/pages/collector/CollectorForm';
import CollectorsPage from '../../src/pages/collector/CollectorsPage';
import CollectionSalesPage from '../../src/pages/collector/CollectionSalesPage';
import {setQaRole} from './mock-auth';
createRoot(document.getElementById('root')!).render(<BrowserRouter>
  <label style={{position:'fixed',right:18,bottom:0,zIndex:9999,background:'white',fontSize:10}}>Scénario local de test : <select aria-label="Profil de test" onChange={e=>setQaRole(e.target.value)}><option value="owner">Administration</option><option value="collector">Collecteur</option><option value="comptoir">Comptoir</option></select></label>
  <Routes><Route path="/artisan-minier/collecteurs/nouveau" element={<CollectorForm/>}/><Route path="/artisan-minier/collecteurs/:id/modifier" element={<CollectorForm/>}/><Route path="/artisan-minier/collecteurs/:id" element={<CollectorsPage/>}/><Route path="/artisan-minier/collecteurs" element={<CollectorsPage/>}/><Route path="/collecte/ventes/nouvelle" element={<CollectionSalesPage create/>}/><Route path="/collecte/ventes" element={<CollectionSalesPage/>}/><Route path="*" element={<Navigate to="/artisan-minier/collecteurs/nouveau" replace/>}/></Routes>
</BrowserRouter>);
