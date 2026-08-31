import '../../../src/index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import i18n from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { InternationalSalesRegister } from '../../../src/pages/sales/SalesDashboard';
import { saleFixture, paymentFixture } from '../../../src/pages/sales/internationalSalesList.fixture';
import { InternationalSaleDetailView } from '../../../src/pages/sales/InternationalSaleDetailView';
import { PaymentFormCase } from './PaymentFormCase';
import { PaymentsListCase } from './PaymentsListCase';
import { PaymentDetailCase } from './PaymentDetailCase';
import { detailFixture } from '../../../src/pages/sales/internationalSaleDetail.fixture';

// No authentication or API mocking: only the real, data-in/data-out register.
// This separate localhost entry is not a platform route or a deployed artifact.
const params = new URLSearchParams(location.search);
const locale = params.get('lang') === 'en' ? 'en' : 'fr';
void i18n.use(initReactI18next).init({ lng: locale, resources: {}, interpolation: { escapeValue: false } });
const names = ['Gold Trade Space', 'African Gold Refinery', 'Bullion Express Ltd', 'Global Bullion DMCC', 'Gold Dispatch SA'];
const companies = ['SONASP', 'MANA Resources SA', 'SEMADO Boungou', 'Mine industrielle SA', 'Société minière de Kalsaka'];
const countries = ['Suisse', 'Émirats Arabes Unis', 'Hong Kong', 'Singapour', 'Suisse'];
const sales = Array.from({ length: 28 }, (_, i) => saleFixture({
  id: `visual-sale-${i}`, sale_number: `VE-2026-${String(38 - i).padStart(5, '0')}`,
  customer_id: `client-${i % 5}`, customer: { id: `client-${i % 5}`, name: names[i % 5], country: countries[i % 5] },
  seller_id: `mine-${i % 5}`, companyName: companies[i % 5], invoiceNumber: `FACT-2026-${String(891 - i).padStart(5, '0')}`,
  licenseNumber: `L-2026-${String(1 + i % 5).padStart(3, '0')}`,
  shipmentDate: `2026-08-${String(27 - i % 20).padStart(2, '0')}T10:00:00Z`,
  payments: i % 3 === 0 ? [paymentFixture({ amount: 24000 })] : i % 3 === 1 ? [] : [paymentFixture({ amount: 48000 })],
}));

function CaseScreen() {
  const [metrics, setMetrics] = React.useState('Mesure du rendu…');
  React.useEffect(() => {
    const measure = () => {
      const table = document.querySelector('.international-sales__table, .ip-list__table');
      const row = document.querySelector('tbody tr');
      setMetrics(`Contrôle : viewport ${innerWidth}px ; document ${document.documentElement.scrollWidth}px ; débordement global ${document.documentElement.scrollWidth > innerWidth ? 'OUI' : 'non'} ; tableau ${Math.round(table?.getBoundingClientRect().width || 0)}px ; ligne ${Math.round(row?.getBoundingClientRect().height || 0)}px.`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    void document.fonts.ready.then(measure);
    return () => observer.disconnect();
  }, []);
  return <><I18nextProvider i18n={i18n}><MemoryRouter>{params.get('case') === 'payment-detail' ? <PaymentDetailCase /> : params.get('case') === 'payments-list' ? <PaymentsListCase /> : params.get('case') === 'payment' ? <PaymentFormCase /> : params.get('case') === 'detail' ? <InternationalSaleDetailView detail={detailFixture()} canPay canApprove={false} onDecision={() => Promise.resolve()} onDownload={() => Promise.resolve()} /> : <InternationalSalesRegister
      sales={params.get('case') === 'empty' ? [] : sales} canCreate
      loading={params.get('case') === 'loading'} failed={params.get('case') === 'error'} onRetry={() => location.reload()} />}
    </MemoryRouter></I18nextProvider>
    <output style={{ display: 'block', padding: 16, fontSize: 12 }}>{metrics}</output></>;
}

createRoot(document.getElementById('root')!).render(params.has('case')
  ? <CaseScreen />
  : <main style={{ padding: 16 }}>
      <p style={{ marginBottom: 10 }}>Contrôle du composant réel — données synthétiques, aucune écriture en base.</p>
      <nav style={{ display: 'flex', gap: 16, marginBottom: 12 }}>{[375, 768, 1134, 1208, 1324, 1688].map((width) => <a key={width} href={`?view=${params.get('view') || 'rows'}&width=${width}`}>{width}px</a>)}</nav>
      <div style={{ height: 1050 * Math.min(1, (window.innerWidth - 32) / Number(params.get('width') || 1364)) }}>
        <iframe title="Registre des ventes" src={params.get('view') === 'payment-detail' ? '/?case=payment-detail' : params.get('view') === 'payments-list' ? '/?case=payments-list' : params.get('view') === 'payment' ? '/?case=payment' : params.get('view') === 'detail' ? '/?case=detail' : '/?case=rows'} style={{ width: Number(params.get('width') || 1364), height: 1050, border: 0, transformOrigin: 'top left', transform: `scale(${Math.min(1, (window.innerWidth - 32) / Number(params.get('width') || 1364))})` }} />
      </div>
    </main>);
