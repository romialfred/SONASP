import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  LockKeyhole,
  PackageCheck,
  Plus,
  RefreshCw,
  Scale,
  Store,
  X,
  type LucideIcon,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { messageErreurUtilisateur } from '@/lib/presentError';
import { useComptoirWorkspace } from '@/hooks/useComptoirWorkspace';
import {
  ComptoirStockConflictError,
  comptoirPortalService,
  computeComptoirStockSummary,
  type ComptoirSonaspSale,
  type ComptoirStockSummary,
} from '@/services/comptoirPortalService';
import './comptoir-portal.css';

const decimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const statusLabels: Record<string, string> = { submitted: 'Soumise', accepted: 'Acceptée', rejected: 'Rejetée', paid: 'Payée', cancelled: 'Annulée' };
const EMPTY_STOCK: ComptoirStockSummary = { physicalGrams: 0, reservedGrams: 0, availableGrams: 0 };

export default function ComptoirSonaspSalesPage() {
  const { workspace, displayName } = useComptoirWorkspace();
  const [sales, setSales] = useState<ComptoirSonaspSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stock, setStock] = useState<ComptoirStockSummary>(EMPTY_STOCK);
  const quantityRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!workspace?.id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [saleRows, stockRows] = await Promise.all([
        comptoirPortalService.getSalesToSonasp(workspace.id),
        comptoirPortalService.getStock(workspace.id),
      ]);
      setSales(saleRows);
      setStock(computeComptoirStockSummary(stockRows, saleRows));
    } catch (loadFailure) {
      console.error(loadFailure);
      setLoadError('Le registre des cessions est momentanément indisponible.');
    }
    finally { setLoading(false); }
  };
  useEffect(() => { if (workspace?.id) void load(); }, [workspace?.id]);

  useEffect(() => {
    if (!dialogOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) setDialogOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    quantityRef.current?.focus();
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dialogOpen, saving]);

  const total = useMemo(() => Number(quantity || 0) * Number(unitPrice || 0), [quantity, unitPrice]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const quantityGrams = Number(quantity);
    const unitPriceFcfa = Number(unitPrice);
    if (!Number.isFinite(quantityGrams) || quantityGrams <= 0 || !Number.isFinite(unitPriceFcfa) || unitPriceFcfa <= 0) {
      setError('Renseignez une quantité et un prix strictement positifs.');
      return;
    }
    if (quantityGrams > stock.availableGrams) {
      setError(`Le stock libre est de ${decimal.format(stock.availableGrams)} g.`);
      return;
    }
    setSaving(true);
    try {
      await comptoirPortalService.submitSaleToSonasp({ quantityGrams, unitPriceFcfa, notes });
      setDialogOpen(false); setQuantity(''); setUnitPrice(''); setNotes('');
      await load();
    } catch (submitError) {
      // Les conflits typés (Error) sont relayés ; les objets PostgREST bruts sont
      // classés au lieu d'exposer un message technique système.
      setError(messageErreurUtilisateur(submitError, 'La cession n’a pas pu être enregistrée.'));
      if (submitError instanceof ComptoirStockConflictError) await load();
    } finally { setSaving(false); }
  };

  return (
    <NationalDashboardLayout>
      <main className="comptoir-page" aria-busy={loading}>
        <header className="comptoir-page__heading">
          <div><span className="comptoir-page__eyebrow">Relations SONASP · {displayName}</span><h1>Cessions à la SONASP</h1><p>Le comptoir soumet son stock disponible à l’unique acheteur autorisé.</p></div>
          <div className="comptoir-heading-actions"><button className="comptoir-button is-secondary" type="button" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? 'is-spinning' : ''} aria-hidden="true" />Actualiser</button><button className="comptoir-button is-primary" type="button" onClick={() => { setError(null); setDialogOpen(true); }} disabled={loading || stock.availableGrams <= 0}><Plus aria-hidden="true" />Nouvelle cession</button></div>
        </header>

        {loadError && <div className="comptoir-alert" role="alert">{loadError}</div>}
        {loading && <div className="comptoir-progress" role="status"><RefreshCw className="is-spinning" aria-hidden="true" /> Chargement des cessions…</div>}

        <section className="comptoir-kpis is-three" aria-label="Disponibilité du stock pour cession">
          <StockKpi icon={PackageCheck} label="Stock physique" value={stock.physicalGrams} detail="Solde du registre de stock" tone="blue" />
          <StockKpi icon={LockKeyhole} label="Stock réservé" value={stock.reservedGrams} detail="Cessions soumises en attente" tone="gold" />
          <StockKpi icon={Scale} label="Stock libre" value={stock.availableGrams} detail="Maximum cessible maintenant" tone="green" />
        </section>

        <div className="comptoir-buyer-lock"><BadgeCheck aria-hidden="true" /><div><strong>Acheteur verrouillé : SONASP</strong><p>Stock libre : {decimal.format(stock.availableGrams)} g · aucune destination internationale ou tierce.</p></div></div>

        <section className="comptoir-panel comptoir-recent">
          <div className="comptoir-panel__head"><div><span>Registre</span><h2>Cessions soumises</h2></div></div>
          <div className="comptoir-table-wrap"><table><caption className="sr-only">Cessions du comptoir à la SONASP</caption><thead><tr><th>Référence</th><th>Date</th><th className="is-number">Quantité</th><th className="is-number">Prix / g</th><th className="is-number">Montant</th><th>État</th></tr></thead><tbody>
            {sales.length === 0 ? <tr><td colSpan={6} className="comptoir-table-empty">Aucune cession soumise à la SONASP.</td></tr> : sales.map((sale) => <tr key={sale.id}><td><strong>{sale.reference}</strong></td><td>{new Date(sale.date).toLocaleDateString('fr-FR')}</td><td className="is-number">{decimal.format(sale.quantityGrams)} g</td><td className="is-number">{integer.format(sale.unitPriceFcfa)} FCFA</td><td className="is-number">{integer.format(sale.totalFcfa)} FCFA</td><td><span className={`comptoir-status is-${sale.status}`}>{statusLabels[sale.status] || sale.status}</span></td></tr>)}
          </tbody></table></div>
        </section>

        {dialogOpen && <div className="comptoir-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !saving && setDialogOpen(false)}><section className="comptoir-dialog" role="dialog" aria-modal="true" aria-labelledby="sale-dialog-title"><header><div><span>Cession nationale</span><h2 id="sale-dialog-title">Soumettre à la SONASP</h2></div><button type="button" onClick={() => setDialogOpen(false)} aria-label="Fermer" disabled={saving}><X aria-hidden="true" /></button></header><form onSubmit={submit}><div className="comptoir-fixed-buyer"><Store aria-hidden="true" /><div><small>Acheteur unique · stock libre {decimal.format(stock.availableGrams)} g</small><strong>SONASP</strong></div><ArrowRight aria-hidden="true" /></div><div className="comptoir-form-grid"><label><span>Quantité (g)</span><input ref={quantityRef} type="number" min="0.001" max={stock.availableGrams} step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label><label><span>Prix unitaire (FCFA / g)</span><input type="number" min="1" step="1" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} required /></label></div><label><span>Note interne <small>(facultatif)</small></span><textarea rows={2} maxLength={400} value={notes} onChange={(event) => setNotes(event.target.value)} /></label><div className="comptoir-form-total"><span>Montant estimé</span><strong>{integer.format(total)} FCFA</strong></div>{error && <p className="comptoir-form-error" role="alert">{error}</p>}<footer><button type="button" className="comptoir-button is-secondary" onClick={() => setDialogOpen(false)} disabled={saving}>Annuler</button><button type="submit" className="comptoir-button is-primary" disabled={saving}>{saving ? 'Enregistrement…' : 'Soumettre'}</button></footer></form></section></div>}
      </main>
    </NationalDashboardLayout>
  );
}

function StockKpi({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  detail: string;
  tone: 'blue' | 'gold' | 'green';
}) {
  return <article className={`comptoir-kpi is-${tone}`}><span><Icon aria-hidden="true" /></span><div><small>{label}</small><strong>{decimal.format(value)} g</strong><p>{detail}</p></div></article>;
}
