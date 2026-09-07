import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { CustomerListing } from '../../../src/pages/customers/CustomerListing';
import { CustomerForm } from '../../../src/pages/customers/CustomerForm';
import { CustomerProfile } from '../../../src/pages/customers/CustomerProfile';
import { NationalDashboardChrome } from '../../../src/components/layout/NationalDashboardLayout';
import { DialogProvider } from '../../../src/contexts/DialogContext';
import '../../../src/index.css';
import '../../../src/styles/design-system.css';
import '../../../src/i18n/config';
import './preview.css';

function App() {
  return <DialogProvider><div className="clients-preview-banner" role="note">Aperçu de présentation — données fictives, enregistrement indisponible</div>
    <NationalDashboardChrome><Routes>
      <Route path="/customers" element={<CustomerListing />} />
      <Route path="/customers/new" element={<CustomerForm />} />
      <Route path="/customers/:id/edit" element={<CustomerForm />} />
      <Route path="/customers/:id" element={<CustomerProfile />} />
      <Route path="/" element={<Navigate to="/customers" replace />} />
      <Route path="*" element={<div className="sn-page"><h2>Parcours hors de cet aperçu</h2><p>Ce banc présente uniquement le module Clients. Aucun service métier réel n’est connecté.</p><Link to="/customers">Revenir aux clients fictifs</Link></div>} />
    </Routes></NationalDashboardChrome>
  </DialogProvider>;
}
ReactDOM.createRoot(document.getElementById('root')!).render(<BrowserRouter><App /></BrowserRouter>);
