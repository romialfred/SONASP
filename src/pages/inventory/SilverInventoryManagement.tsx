import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, Beaker, Coins, PackageCheck, RefreshCw, Scale, ShieldCheck,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import {
  Badge, Card, DataTable, EmptyState, Note, PageHeader, StatGrid, type Column,
} from '@/components/ui/sn';
import { useToast } from '@/components/ui/Toast';
import {
  loadSilverInventoryPosition, type SilverPositionRow,
} from './silverInventoryData';
import './silver-inventory.css';

const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const percentage = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
const date = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });

const formatDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? '—' : date.format(parsed);
};

export function SilverInventoryManagement() {
  const { addToast } = useToast();
  const [rows, setRows] = useState<SilverPositionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await loadSilverInventoryPosition());
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : 'Le chargement de la position argent a échoué.';
      setError(message);
      addToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => rows.reduce((accumulator, row) => ({
    silver: accumulator.silver + row.silver_grams,
    available: accumulator.available + row.available_silver_grams,
    allocated: accumulator.allocated + row.allocated_silver_grams,
    sold: accumulator.sold + row.sold_silver_grams,
  }), { silver: 0, available: 0, allocated: 0, sold: 0 }), [rows]);

  const weightedPurity = useMemo(() => {
    const totalWeight = rows.reduce((sum, row) => sum + row.weight_after_melting_grams, 0);
    return totalWeight > 0
      ? rows.reduce((sum, row) => sum + row.weight_after_melting_grams * row.silver_percentage, 0) / totalWeight
      : 0;
  }, [rows]);

  const columns: Column<SilverPositionRow>[] = [
    {
      key: 'reference', header: 'Lot / certificat', render: (row) => (
        <span className="silver-position__reference">
          <strong>{row.certificate_number || `STK-${row.id.slice(0, 8).toUpperCase()}`}</strong>
          <small>{formatDate(row.entry_date)}</small>
        </span>
      ),
    },
    { key: 'location', header: 'Localisation', render: (row) => row.processing_location || 'Non renseignée' },
    { key: 'melted', header: 'Poids après fonte', numeric: true, render: (row) => `${number.format(row.weight_after_melting_grams)} g` },
    { key: 'purity', header: 'Teneur Ag', numeric: true, render: (row) => <Badge tone="neutral">{percentage.format(row.silver_percentage)} %</Badge> },
    { key: 'silver', header: 'Argent associé', numeric: true, render: (row) => `${number.format(row.silver_grams)} g` },
    { key: 'available', header: 'Part disponible', numeric: true, render: (row) => `${number.format(row.available_silver_grams)} g` },
  ];

  return (
    <NationalDashboardLayout>
      <main className="sn-page silver-position">
        <PageHeader
          icon={Coins}
          title="Position argent associée"
          subtitle="Teneur en argent déclarée dans les lots d’or du stock opérationnel."
          breadcrumb={[{ label: 'Raffinage & stocks' }, { label: 'Suivi du stock d’or', to: '/inventory' }, { label: 'Position argent' }]}
          info={{
            titre: 'Périmètre de calcul',
            contenu: <>Cette vue dérive l’argent associé aux lots depuis le poids après fonte et la teneur certifiée. Elle ne constitue pas un registre d’argent autonome.</>,
          }}
          actions={(
            <button type="button" className="sn-btn sn-btn--primary" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={loading ? 'sn-spin' : undefined} aria-hidden="true" />
              {loading ? 'Actualisation…' : 'Actualiser'}
            </button>
          )}
        />

        <StatGrid ariaLabel="Synthèse de la position argent" items={[
          { label: 'Argent associé', value: `${number.format(totals.silver)} g`, hint: `${number.format(rows.length)} lot(s) documenté(s)`, icon: Coins, tone: 'gold' },
          { label: 'Part disponible', value: `${number.format(totals.available)} g`, hint: 'Ventilation proportionnelle', icon: Scale, tone: 'green' },
          { label: 'Part allouée', value: `${number.format(totals.allocated)} g`, hint: 'Lots affectés à une vente', icon: PackageCheck, tone: 'blue' },
          { label: 'Teneur moyenne pondérée', value: `${percentage.format(weightedPurity)} %`, hint: 'Pondérée par le poids après fonte', icon: Beaker, tone: 'violet' },
        ]} />

        <Note tone="info" icon={ShieldCheck}>
          Les quantités sont calculées à partir des analyses stockées en base. Toute mobilisation autonome d’argent exige un registre matière et un workflow dédiés ; aucune mutation n’est donc autorisée depuis cet écran.
        </Note>

        {error && (
          <Note tone="danger" icon={AlertCircle}>
            Impossible de charger la position argent : {error}
          </Note>
        )}

        <Card title="Lots porteurs d’argent" hint="Traçabilité de la teneur argent relevée à l’essai et rattachée au stock d’or.">
          {!loading && rows.length === 0 ? (
            <EmptyState
              title="Aucune teneur argent enregistrée"
              description="Les lots apparaîtront après l’enregistrement d’une teneur argent strictement positive sur une entrée de stock."
            />
          ) : (
            <DataTable columns={columns} rows={rows} loading={loading} caption="Position argent associée aux lots d’or" />
          )}
        </Card>
      </main>
    </NationalDashboardLayout>
  );
}
