// Local visual fixture: actual reusable component, no authentication or business API.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { AffiliationDigitalCard } from '../../src/components/artisan/AffiliationDigitalCard';
import type { AffiliationCard } from '../../src/lib/affiliationCard';
import '../../src/index.css';
const card: AffiliationCard = { id: 'test', artisan_id: 'test', numero_carte: 'FS-TEST-000001', numero_affiliation: 'FS-TEST-000001', version: 1, template_version: 'faso-sanama-id1-v1', statut: 'en_cours', statut_effectif: 'non_validee', snapshot: null, validated_at: null, activated_at: null, valid_from: null, valid_until: null, jours_restants: null, server_date: '2026-09-06', render_status: 'ready', render_revision: 1, recto_path: '/recto.png', verso_path: '/verso.png', pdf_path: '/pdf.pdf', verification_token: 'test', created_at: '2026-09-06', replaced_by: null };
function Fixture() {
 const [active, setActive] = React.useState(false);
 const shown: AffiliationCard = active ? { ...card, statut: 'en_exploitation', statut_effectif: 'active', activated_at: '2026-09-06T12:00:00Z', validated_at: '2026-09-06T11:00:00Z', valid_from: '2026-09-06', valid_until: '2027-09-05', jours_restants: 364, recto_path: '/recto-actif-test.png', verso_path: '/verso-actif-test.png', pdf_path: null, render_revision: 2 } : card;
 return <main style={{ maxWidth: 980, margin: '32px auto', padding: '0 20px' }}><p style={{ color: '#806119', fontSize: 12, marginBottom: 12 }}>CONTRÔLE LOCAL · DONNÉES DE TEST</p><h1 style={{ fontSize: 28, marginBottom: 24 }}>Carte professionnelle</h1><label style={{ display: 'block', marginBottom: 16 }}><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /> Afficher l’état actif de test</label><div className="affiliation-panel"><AffiliationDigitalCard card={shown} /></div></main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
