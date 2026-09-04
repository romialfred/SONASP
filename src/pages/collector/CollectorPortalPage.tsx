import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, FileText, RefreshCw, Scale, ShieldAlert, Users } from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { DataTable, Note, PageHeader, StatGrid, type Column } from '@/components/ui/sn';
import { useCollectorWorkspace } from '@/hooks/useCollectorWorkspace';
import { artisanGoldSalesService, type ArtisanGoldSale } from '@/services/artisanGoldSalesService';
import artisanPaiementsService from '@/services/artisanPaiementsService';
import { artisanMinierService, type ArtisanMinier } from '@/services/artisanMinierService';
import { comptoirPortalService } from '@/services/comptoirPortalService';
import { normaliserArtisan } from '@/pages/artisan-minier/artisanRow';
import { formatStatusFr } from '@/utils/statusFormatter';

interface CollectorDashboard {
  artisans: ArtisanMinier[];
  sales: ArtisanGoldSale[];
  stockGrams: number;
  paymentsCount: number;
  taxesFcfa: number;
  documentsCount: number;
}

const EMPTY_DASHBOARD: CollectorDashboard = {
  artisans: [], sales: [], stockGrams: 0, paymentsCount: 0, taxesFcfa: 0, documentsCount: 0,
};
const integer = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });

export default function CollectorPortalPage() {
  const { workspace } = useCollectorWorkspace();
  const [data, setData] = useState<CollectorDashboard>(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workspace) return;
    setLoading(true);
    setError(null);
    try {
      const allowed = new Set(workspace.assignedArtisanIds);
      const [artisans, sales, stock, payments, taxes] = await Promise.all([
        artisanMinierService.getAll(),
        artisanGoldSalesService.getAll(),
        comptoirPortalService.getStock(workspace.organizationId),
        artisanPaiementsService.getAllPaiements(),
        artisanPaiementsService.getTaxesRetenues(),
      ]);
      const scopedArtisans = (artisans || [])
        .filter((artisan) => allowed.has(artisan.id))
        .map(normaliserArtisan);
      const documents = await Promise.all(
        scopedArtisans.map((artisan) => artisanMinierService.getDocuments(artisan.id).catch(() => [])),
      );
      setData({
        artisans: scopedArtisans,
        sales: (sales || []).filter((sale) => allowed.has(sale.artisan_id)),
        stockGrams: (stock || []).reduce(
          (sum, movement) => sum + (movement.direction === 'in' ? 1 : -1) * movement.quantityGrams,
          0,
        ),
        paymentsCount: (payments || []).filter((payment) => allowed.has(payment.artisan_id)).length,
        taxesFcfa: (taxes || [])
          .filter((tax) => allowed.has(tax.artisan_id))
          .reduce((sum, tax) => sum + Number(tax.montant_taxe || 0), 0),
        documentsCount: documents.reduce((sum, rows) => sum + (rows?.length || 0), 0),
      });
    } catch (reason) {
      console.error(reason);
      setData(EMPTY_DASHBOARD);
      setError('Les données du périmètre Collecteur sont momentanément indisponibles.');
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => { void load(); }, [load]);

  const recentSales = useMemo(
    () => [...data.sales].sort((a, b) => (b.date_vente || '').localeCompare(a.date_vente || '')).slice(0, 6),
    [data.sales],
  );
  const columns: Column<ArtisanGoldSale>[] = [
    { key: 'numero', header: 'Reçu', render: (sale) => <Link to={`/artisan-minier/ventes-or/${sale.id}`} className="font-semibold text-emerald-800">{sale.numero_recu || sale.id.slice(0, 8)}</Link> },
    { key: 'date', header: 'Date', render: (sale) => new Date(sale.date_vente).toLocaleDateString('fr-FR') },
    { key: 'quantity', header: 'Quantité', numeric: true, render: (sale) => `${decimal.format(sale.quantite_grammes)} g` },
    { key: 'amount', header: 'Montant', numeric: true, render: (sale) => `${integer.format(sale.montant_total_fcfa)} FCFA` },
    { key: 'status', header: 'État', render: (sale) => formatStatusFr(sale.statut) },
  ];

  return (
    <NationalDashboardLayout>
      <main className="sn-page" aria-busy={loading}>
        <PageHeader
          icon={Users}
          title={workspace?.collectorName || 'Portail Collecteur'}
          subtitle={`Orpailleurs assignés · comptoir ${workspace?.organizationCode || 'de rattachement'}`}
          breadcrumb={[{ label: 'Collecteur' }]}
          actions={<button type="button" className="sn-btn" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? 'sn-spin' : ''} aria-hidden="true" />Actualiser</button>}
        />

        {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800" role="alert">{error}</div>}
        <div className="mt-4">
          <Note tone="warning" icon={ShieldAlert}>
            Consultation sécurisée uniquement : le schéma actuel ne fournit aucune RPC dédiée à la création d’un achat artisanal par un Collecteur. Aucune écriture directe n’est donc exposée ; l’enregistrement et les décisions restent traités par le Comptoir habilité.
          </Note>
        </div>

        <div className="mt-4">
          <StatGrid ariaLabel="Indicateurs du Collecteur" items={[
            { label: 'Orpailleurs assignés', value: integer.format(data.artisans.length), hint: 'Affectations actives', icon: Users, tone: 'blue' },
            { label: 'Collectes visibles', value: integer.format(data.sales.length), hint: `${decimal.format(data.sales.reduce((sum, sale) => sum + sale.quantite_grammes, 0))} g`, icon: Scale, tone: 'gold' },
            { label: 'Stock du comptoir', value: `${decimal.format(data.stockGrams)} g`, hint: 'Consultation du registre', icon: Scale, tone: 'green' },
            { label: 'Paiements visibles', value: integer.format(data.paymentsCount), hint: 'Lecture seule', icon: Banknote, tone: 'violet' },
            { label: 'Taxes retenues', value: `${integer.format(data.taxesFcfa)} FCFA`, hint: 'Périmètre assigné', icon: Banknote, tone: 'red' },
            { label: 'Documents', value: integer.format(data.documentsCount), hint: 'Dossiers autorisés', icon: FileText, tone: 'blue' },
          ]} />
        </div>

        <section className="sn-card mt-4" aria-label="Accès rapides Collecteur">
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <Link className="sn-btn" to="/artisan-minier/liste"><Users aria-hidden="true" />Orpailleurs assignés</Link>
            <Link className="sn-btn" to="/artisan-minier/ventes-or"><Scale aria-hidden="true" />Registre des collectes</Link>
            <Link className="sn-btn" to="/portail-collecteur/stock"><Scale aria-hidden="true" />Stock du comptoir</Link>
            <Link className="sn-btn" to="/artisan-minier/paiements/historique"><Banknote aria-hidden="true" />Paiements</Link>
            <Link className="sn-btn" to="/artisan-minier/rapports/taxes"><Banknote aria-hidden="true" />Taxes</Link>
            <Link className="sn-btn" to="/portail-collecteur/documents"><FileText aria-hidden="true" />Documents</Link>
          </div>
        </section>

        <section className="sn-card mt-4" aria-label="Collectes récentes">
          <div className="sn-card__head"><div><h2>Collectes récentes</h2><p className="sn-card__hint">Uniquement les orpailleurs actuellement assignés.</p></div></div>
          <div className="p-4"><DataTable columns={columns} rows={recentSales} loading={loading} empty="Aucune collecte visible dans votre périmètre." caption="Collectes récentes des orpailleurs assignés" /></div>
        </section>
      </main>
    </NationalDashboardLayout>
  );
}
