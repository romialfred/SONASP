import '../../../src/index.css';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { InternationalSaleSimulator } from '../../../src/pages/sales/InternationalSaleSimulator';

const simulator = (
  <MemoryRouter initialEntries={['/sales/simulator']}>
    <InternationalSaleSimulator />
  </MemoryRouter>
);

const width = Number(new URLSearchParams(location.search).get('width'));
createRoot(document.getElementById('root')!).render(Number.isFinite(width) && width > 0
  ? <main style={{ minHeight: '100vh', padding: 12, background: '#e8edf2' }}>
      <iframe
        title={`Simulateur à ${width} pixels`}
        src="/"
        style={{ display: 'block', width, height: 812, border: 0, margin: '0 auto', background: 'white' }}
      />
    </main>
  : simulator);
