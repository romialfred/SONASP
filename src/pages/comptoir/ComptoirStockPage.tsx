import { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Boxes, RefreshCw, Scale, ShoppingBasket, Store } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from '@/lib/recharts';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { useComptoirWorkspace } from '@/hooks/useComptoirWorkspace';
import { comptoirPortalService, type ComptoirStockMovement } from '@/services/comptoirPortalService';
import './comptoir-portal.css';

const decimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const typeLabels: Record<string, string> = { purchase: 'Achat', sale: 'Cession SONASP', transfer: 'Transfert', tax: 'Taxe', adjustment: 'Ajustement', reversal: 'Compensation' };

export default function ComptoirStockPage() {
  const { workspace, displayName } = useComptoirWorkspace();
  const [movements, setMovements] = useState<ComptoirStockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!workspace?.id) return;
    setLoading(true);
    setError(null);
    try { setMovements(await comptoirPortalService.getStock(workspace.id)); }
    catch (loadError) {
      console.error(loadError);
      setError('Le journal du stock est momentanément indisponible.');
    }
    finally { setLoading(false); }
  };

  useEffect(() => { if (workspace?.id) void load(); }, [workspace?.id]);

  const summary = useMemo(() => {
    const purchases = movements.filter((m) => m.direction === 'in').reduce((s, m) => s + m.quantityGrams, 0);
    const sales = movements.filter((m) => m.direction === 'out').reduce((s, m) => s + m.quantityGrams, 0);
    return { purchases, sales, balance: purchases - sales };
  }, [movements]);

  const monthly = useMemo(() => {
    const months = new Map<string, { month: string; entries: number; exits: number }>();
    movements.forEach((movement) => {
      const key = movement.date.slice(0, 7);
      const row = months.get(key) || { month: new Date(`${key}-01`).toLocaleDateString('fr-FR', { month: 'short' }), entries: 0, exits: 0 };
      if (movement.direction === 'in') row.entries += movement.quantityGrams;
      else row.exits += movement.quantityGrams;
      months.set(key, row);
    });
    return [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([, row]) => row);
  }, [movements]);

  return (
    <NationalDashboardLayout>
      <main className="comptoir-page" aria-busy={loading}>
        <header className="comptoir-page__heading">
          <div><span className="comptoir-page__eyebrow">Stock · {displayName}</span><h1>Suivi du stock</h1><p>Entrées certifiées, cessions à la SONASP et solde disponible.</p></div>
          <button className="comptoir-button is-secondary" type="button" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? 'is-spinning' : ''} aria-hidden="true" />Actualiser</button>
        </header>

        {error && <div className="comptoir-alert" role="alert">{error}</div>}
        {loading && <div className="comptoir-progress" role="status"><RefreshCw className="is-spinning" aria-hidden="true" /> Chargement du journal de stock…</div>}

        <section className="comptoir-kpis is-three" aria-label="Situation du stock">
          <Kpi icon={Scale} label="Disponible" value={summary.balance} tone="copper" />
          <Kpi icon={ShoppingBasket} label="Achats intégrés" value={summary.purchases} tone="green" />
          <Kpi icon={Store} label="Cédé à la SONASP" value={summary.sales} tone="gold" />
        </section>

        <section className="comptoir-grid">
          <article className="comptoir-panel comptoir-trend">
            <div className="comptoir-panel__head"><div><span>6 derniers mois</span><h2>Flux du stock</h2></div></div>
            {monthly.length === 0 ? <p className="comptoir-muted">Aucun mouvement enregistré.</p> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthly} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#eadfd9" strokeDasharray="3 5" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
                  <Tooltip formatter={(value) => `${decimal.format(Number(value))} g`} />
                  <Bar dataKey="entries" name="Entrées" fill="#3f7d68" radius={[5, 5, 0, 0]} />
                  <Bar dataKey="exits" name="Sorties SONASP" fill="#b7791f" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </article>
          <aside className="comptoir-panel comptoir-stock-rule">
            <Boxes aria-hidden="true" />
            <h2>Stock certifié</h2>
            <p>Une entrée apparaît uniquement après certification DGI et finalisation du paiement. Toute correction crée une écriture compensatoire traçable.</p>
          </aside>
        </section>

        <section className="comptoir-panel comptoir-recent">
          <div className="comptoir-panel__head"><div><span>Journal inaltérable</span><h2>Mouvements récents</h2></div></div>
          <div className="comptoir-table-wrap"><table><caption className="sr-only">Mouvements de stock du comptoir</caption><thead><tr><th>Date</th><th>Référence</th><th>Nature</th><th className="is-number">Entrée</th><th className="is-number">Sortie</th></tr></thead><tbody>
            {movements.length === 0 ? <tr><td colSpan={5} className="comptoir-table-empty">Aucun mouvement de stock.</td></tr> : movements.map((movement) => <tr key={movement.id}><td>{new Date(movement.date).toLocaleString('fr-FR')}</td><td><strong>{movement.reference}</strong></td><td>{typeLabels[movement.type] || movement.type}</td><td className="is-number is-positive">{movement.direction === 'in' ? <><ArrowDownLeft aria-hidden="true" /> {decimal.format(movement.quantityGrams)} g</> : '—'}</td><td className="is-number is-negative">{movement.direction === 'out' ? <><ArrowUpRight aria-hidden="true" /> {decimal.format(movement.quantityGrams)} g</> : '—'}</td></tr>)}
          </tbody></table></div>
        </section>
      </main>
    </NationalDashboardLayout>
  );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: typeof Scale; label: string; value: number; tone: string }) {
  return <article className={`comptoir-kpi is-${tone}`}><span><Icon aria-hidden="true" /></span><div><small>{label}</small><strong>{decimal.format(value / 1000)} kg</strong><p>{decimal.format(value)} g</p></div></article>;
}
