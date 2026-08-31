import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Scale } from 'lucide-react';
import { Badge, DataTable, Note, PageHeader, Section, type Column } from '@/components/ui/sn';
import { errorMessage } from '@/lib/errorMessage';
import { supabase } from '@/lib/supabase';
import './institutional-work-queue.css';

interface FiscalPaymentRow {
  id: string;
  reference_paiement: string;
  numero_facture: string | null;
  montant_paye: number;
  montant_taxes_retenues: number;
  statut: string;
  date_paiement: string | null;
}

const money = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export function DgiFiscalPaymentsPage() {
  const [rows, setRows] = useState<FiscalPaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase.rpc('snp_dgi_lister_paiements_fiscaux', {
      p_limit: 200,
      p_offset: 0,
    });
    if (error) {
      setRows([]);
      setLoadError(errorMessage(error, 'Impossible de charger la situation fiscale des paiements.'));
    } else {
      setRows(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const columns = useMemo<Column<FiscalPaymentRow>[]>(() => [
    { key: 'reference_paiement', header: 'Référence' },
    { key: 'numero_facture', header: 'Facture' },
    {
      key: 'date_paiement', header: 'Date',
      render: (row) => row.date_paiement ? new Date(row.date_paiement).toLocaleDateString('fr-FR') : '—',
    },
    {
      key: 'montant_paye', header: 'Montant payé', numeric: true,
      render: (row) => `${money.format(row.montant_paye)} FCFA`,
    },
    {
      key: 'montant_taxes_retenues', header: 'Taxes retenues', numeric: true,
      render: (row) => `${money.format(row.montant_taxes_retenues)} FCFA`,
    },
    { key: 'statut', header: 'Statut', render: (row) => <Badge tone="info">{row.statut}</Badge> },
  ], []);

  return (
    <div className="sn-page institutional-work-queue">
      <PageHeader
        icon={Scale}
        title="Paiements fiscaux"
        subtitle="Lecture DGI limitée aux montants, retenues et états nécessaires au contrôle fiscal."
        breadcrumb={[{ label: 'Portail DGI', to: '/portail-dgi' }, { label: 'Paiements fiscaux' }]}
        actions={(
          <button className="institutional-work-queue__button" type="button" onClick={() => void load()} disabled={loading}>
            <RefreshCw aria-hidden="true" /> Actualiser
          </button>
        )}
      />
      <Note tone="info">
        Les moyens de paiement, preuves bancaires, reçus, notes internes et identités des exécutants ne sont jamais exposés dans cet écran.
      </Note>
      {loadError && <Note tone="danger">{loadError}</Note>}
      <Section
        id="dgi-fiscal-payments"
        icon={Scale}
        title={`Règlements contrôlables (${rows.length})`}
        description="Projection fiscale en lecture seule, bornée côté serveur au compte et à l’organisation DGI."
      >
        <DataTable
          caption="Paiements visibles par la DGI"
          columns={columns}
          rows={rows}
          loading={loading}
          empty="Aucun paiement fiscal n’est disponible dans ce périmètre."
        />
      </Section>
    </div>
  );
}

export default DgiFiscalPaymentsPage;
