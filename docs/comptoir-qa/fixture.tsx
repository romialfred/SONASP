import React from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route,Navigate} from 'react-router-dom';
import '../../src/i18n/config';
import '../../src/index.css';
import ComptoirForm from '../../src/pages/collector/ComptoirForm';
import ComptoirsPage from '../../src/pages/collector/ComptoirsPage';
createRoot(document.getElementById('root')!).render(<BrowserRouter>
 <div style={{position:'fixed',bottom:0,right:12,zIndex:10000,padding:'3px 7px',background:'#fff4cc',fontSize:10}}>QA locale · client Supabase réel · PostgreSQL jetable</div>
 <Routes><Route path="/artisan-minier/comptoirs/nouveau" element={<ComptoirForm/>}/><Route path="/artisan-minier/comptoirs/:id/modifier" element={<ComptoirForm/>}/><Route path="/artisan-minier/comptoirs/:id" element={<ComptoirForm readOnly/>}/><Route path="/artisan-minier/comptoirs" element={<ComptoirsPage/>}/><Route path="*" element={<Navigate to="/artisan-minier/comptoirs/nouveau" replace/>}/></Routes>
</BrowserRouter>);
