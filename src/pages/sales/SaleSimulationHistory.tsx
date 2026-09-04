import { useEffect, useState } from 'react';
import { ArrowLeft, Calculator, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { formatCompactXof, formatDateFr, formatNumberFr } from '@/components/sales/simulator/saleSimulationFormatters';
import { listSaleSimulations, type SavedSaleSimulation } from '@/services/saleSimulationService';
import './international-sale-simulator.css';

export function SaleSimulationHistory() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<SavedSaleSimulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listSaleSimulations());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'L’historique est momentanément indisponible.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  return (
    <MainLayout>
      <main className="sn-page sale-simulator sale-simulator--history" id="main-content">
        <header className="sale-simulator__page-header">
          <div>
            <nav aria-label="Fil d’Ariane"><span>Vente internationale</span><span aria-hidden="true">/</span><strong>Historique des simulations</strong></nav>
            <h1>Historique des simulations</h1>
            <p>Scénarios financiers enregistrés avant validation d’une vente internationale</p>
          </div>
          <button type="button" className="sale-simulator__button sale-simulator__button--secondary" onClick={() => navigate('/sales/simulator')}>
            <ArrowLeft aria-hidden="true" /> Retour au simulateur
          </button>
        </header>

        <section className="sale-simulator__history-card" aria-labelledby="simulation-history-title">
          <header>
            <div><h2 id="simulation-history-title">Simulations enregistrées</h2><p>{rows.length} scénario{rows.length > 1 ? 's' : ''} visible{rows.length > 1 ? 's' : ''}</p></div>
            <button type="button" onClick={() => void load()} disabled={loading} aria-label="Actualiser l’historique"><RefreshCw className={loading ? 'is-spinning' : ''} aria-hidden="true" /></button>
          </header>

          {loading && <p className="sale-simulator__history-state" role="status">Chargement de l’historique…</p>}
          {!loading && error && <div className="sale-simulator__history-state" role="alert"><p>{error}</p><button type="button" onClick={() => void load()}>Réessayer</button></div>}
          {!loading && !error && rows.length === 0 && (
            <div className="sale-simulator__history-state"><Calculator aria-hidden="true" /><strong>Aucune simulation enregistrée</strong><p>Lancez une simulation pour constituer l’historique.</p></div>
          )}
          {!loading && !error && rows.length > 0 && (
            <div className="sale-simulator__history-table-wrap">
              <table>
                <thead><tr><th>Référence</th><th>Date</th><th>Contrepartie</th><th>Quantité</th><th>Cours</th><th>Produit net</th><th>Marge</th><th>État</th></tr></thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <th scope="row">{row.simulation_reference}</th>
                      <td>{formatDateFr(row.value_date)}<small>{new Date(row.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</small></td>
                      <td>{row.counterparty_name_snapshot}<small>{row.counterparty_type === 'refinery' ? 'Raffineur' : 'Acheteur'}</small></td>
                      <td>{formatNumberFr(row.quantity_oz, 3)} oz</td>
                      <td>{formatNumberFr(row.reference_price_usd_oz, 2, 2)} USD/oz</td>
                      <td>{formatCompactXof(row.net_proceeds_xof)}</td>
                      <td>{formatNumberFr(row.net_margin_pct, 2, 2)} %</td>
                      <td><span className="sale-simulator__status is-ready">Terminée</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </MainLayout>
  );
}
