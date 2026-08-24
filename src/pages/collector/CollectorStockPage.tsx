import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, RefreshCw, Scale } from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { DataTable, Note, PageHeader, StatGrid, type Column } from '@/components/ui/sn';
import { useCollectorWorkspace } from '@/hooks/useCollectorWorkspace';
import { comptoirPortalService, type ComptoirStockMovement } from '@/services/comptoirPortalService';

const decimal = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });

export default function CollectorStockPage() {
  const { workspace } = useCollectorWorkspace();
  const [rows, setRows] = useState<ComptoirStockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!workspace) return;
    setLoading(true); setError(null);
    try { setRows(await comptoirPortalService.getStock(workspace.organizationId)); }
    catch { setRows([]); setError('Le journal de stock autorisé est momentanément indisponible.'); }
    finally { setLoading(false); }
  }, [workspace]);
  useEffect(() => { void load(); }, [load]);
  const totals = useMemo(() => rows.reduce((result, row) => ({
    in: result.in + (row.direction === 'in' ? row.quantityGrams : 0),
    out: result.out + (row.direction === 'out' ? row.quantityGrams : 0),
  }), { in: 0, out: 0 }), [rows]);
  const columns: Column<ComptoirStockMovement>[] = [
    { key: 'date', header: 'Date', render: (row) => new Date(row.date).toLocaleString('fr-FR') },
    { key: 'reference', header: 'Référence', render: (row) => <strong>{row.reference}</strong> },
    { key: 'type', header: 'Nature', render: (row) => row.type },
    { key: 'direction', header: 'Sens', render: (row) => row.direction === 'in' ? <span className="text-emerald-700"><ArrowDownLeft aria-hidden="true" className="inline h-4 w-4" /> Entrée</span> : <span className="text-amber-700"><ArrowUpRight aria-hidden="true" className="inline h-4 w-4" /> Sortie</span> },
    { key: 'quantity', header: 'Quantité', numeric: true, render: (row) => `${decimal.format(row.quantityGrams)} g` },
  ];
  return <NationalDashboardLayout><main className="sn-page" aria-busy={loading}>
    <PageHeader icon={Scale} title="Stock du comptoir de rattachement" subtitle={workspace?.organizationName || 'Registre artisanal'} breadcrumb={[{ label: 'Collecteur', to: '/portail-collecteur' }, { label: 'Stock' }]} actions={<button type="button" className="sn-btn" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? 'sn-spin' : ''} aria-hidden="true" />Actualiser</button>} />
    <div className="mt-4"><Note tone="info" icon={Scale}>Vue strictement consultative du stock agrégé du comptoir. Le modèle actuel ne possède pas de ledger individuel par Collecteur.</Note></div>
    {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800" role="alert">{error}</div>}
    <div className="mt-4"><StatGrid ariaLabel="Situation du stock" items={[
      { label: 'Entrées', value: `${decimal.format(totals.in)} g`, hint: 'Registre autorisé', icon: ArrowDownLeft, tone: 'green' },
      { label: 'Sorties', value: `${decimal.format(totals.out)} g`, hint: 'Registre autorisé', icon: ArrowUpRight, tone: 'gold' },
      { label: 'Solde physique', value: `${decimal.format(totals.in - totals.out)} g`, hint: 'Comptoir de rattachement', icon: Scale, tone: 'blue' },
    ]} /></div>
    <section className="sn-card mt-4"><div className="p-4"><DataTable columns={columns} rows={rows} loading={loading} empty="Aucun mouvement visible." caption="Journal de stock du comptoir de rattachement" /></div></section>
  </main></NationalDashboardLayout>;
}
