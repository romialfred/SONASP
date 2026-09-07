import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import '../../src/i18n/config';
import '../../src/index.css';
import AffiliationsCartes from '../../src/pages/artisan-minier/AffiliationsCartes';
import { setQaActor, type QA_ACTORS } from './workflow-auth';

function Fixture() {
  const [actor, setActor] = React.useState('maker');
  return <BrowserRouter>
    <label style={{ position: 'fixed', right: 12, bottom: 0, zIndex: 9999, background: '#fff8dd', padding: '3px 8px', border: '1px solid #e0bf63', fontSize: 11 }}>
      Recette isolée · Base SQL locale · <select aria-label="Acteur de recette" value={actor} onChange={(event) => { setQaActor(event.target.value as keyof typeof QA_ACTORS); setActor(event.target.value); }}>
        <option value="maker">Agent de saisie</option><option value="checker">Agent de contrôle</option><option value="outsider">Agent hors périmètre</option>
      </select> <a href="/__affiliation_qa/state" target="_blank" rel="noreferrer">Preuve SQL</a>
    </label>
    <Routes><Route path="*" element={<AffiliationsCartes key={actor} />} /></Routes>
  </BrowserRouter>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
