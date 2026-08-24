import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  History,
  RefreshCw,
  X,
  XCircle,
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { CAPABILITIES, hasCapability } from '@/lib/capabilities';
import {
  ComptoirSaleTransitionConflictError,
  comptoirPortalService,
  type ComptoirSaleHistoryEvent,
  type ComptoirSonaspSale,
} from '@/services/comptoirPortalService';
import './comptoir-portal.css';

type Decision = 'accepted' | 'rejected' | 'paid';

const integer = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });
const statusLabels: Record<ComptoirSonaspSale['status'], string> = {
  submitted: 'Soumise',
  accepted: 'Acceptée',
  rejected: 'Rejetée',
  paid: 'Payée',
  cancelled: 'Annulée',
};
const decisionLabels: Record<Decision, string> = {
  accepted: 'Accepter la cession',
  rejected: 'Rejeter la cession',
  paid: 'Marquer comme payée',
};

function readableError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function displayDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('fr-FR');
}

export default function SonaspComptoirSalesInboxPage() {
  const { user } = useAuth();
  const canApprove = hasCapability(user, CAPABILITIES.SONASP_APPROVE);
  const canPay = hasCapability(user, CAPABILITIES.FINANCE_EXECUTE);
  const [sales, setSales] = useState<ComptoirSonaspSale[]>([]);
  const [history, setHistory] = useState<ComptoirSaleHistoryEvent[]>([]);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | ComptoirSonaspSale['status']>('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [selectedSale, setSelectedSale] = useState<ComptoirSonaspSale | null>(null);
  const [comment, setComment] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setHistoryError(null);
    try {
      const rows = await comptoirPortalService.getSonaspSalesInbox();
      setSales(rows);
      try {
        setHistory(await comptoirPortalService.getSonaspSaleHistory(rows.map((sale) => sale.id)));
      } catch (error) {
        console.error(error);
        setHistory([]);
        setHistoryError('L’historique de contrôle est momentanément indisponible.');
      }
    } catch (error) {
      console.error(error);
      setSales([]);
      setHistory([]);
      setLoadError('La boîte de réception des cessions est momentanément indisponible.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!decision) return undefined;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) setDecision(null);
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [decision, saving]);

  const filteredSales = useMemo(
    () => statusFilter === 'all' ? sales : sales.filter((sale) => sale.status === statusFilter),
    [sales, statusFilter],
  );
  const historyBySale = useMemo(() => {
    const result = new Map<string, ComptoirSaleHistoryEvent[]>();
    history.forEach((event) => result.set(event.saleId, [...(result.get(event.saleId) || []), event]));
    return result;
  }, [history]);

  const openDecision = (sale: ComptoirSonaspSale, target: Decision) => {
    setSelectedSale(sale);
    setDecision(target);
    setComment('');
    setActionError(null);
  };

  const submitDecision = async (event: FormEvent) => {
    event.preventDefault();
    if (!decision || !selectedSale) return;
    if (decision === 'rejected' && comment.trim().length < 3) {
      setActionError('Le motif du rejet doit contenir au moins 3 caractères.');
      return;
    }
    setSaving(true);
    setActionError(null);
    setSuccess(null);
    try {
      await comptoirPortalService.transitionSaleToSonasp(selectedSale.id, decision, comment);
      setDecision(null);
      setSelectedSale(null);
      setSuccess(`La cession ${selectedSale.reference} a été mise à jour.`);
      await load();
    } catch (error) {
      setActionError(readableError(error, 'La décision n’a pas pu être enregistrée.'));
      if (error instanceof ComptoirSaleTransitionConflictError) await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <NationalDashboardLayout>
      <main className="comptoir-page" aria-busy={loading}>
        <header className="comptoir-page__heading">
          <div>
            <span className="comptoir-page__eyebrow">SONASP · circuit national sécurisé</span>
            <h1>Cessions reçues des comptoirs</h1>
            <p>Contrôle, décision et règlement des offres de stock artisanal.</p>
          </div>
          <div className="comptoir-heading-actions">
            <label className="comptoir-filter">
              <span>État</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                <option value="all">Tous</option>
                <option value="submitted">Soumises</option>
                <option value="accepted">Acceptées</option>
                <option value="rejected">Rejetées</option>
                <option value="paid">Payées</option>
                <option value="cancelled">Annulées</option>
              </select>
            </label>
            <button className="comptoir-button is-secondary" type="button" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={loading ? 'is-spinning' : ''} aria-hidden="true" />Actualiser
            </button>
          </div>
        </header>

        {loadError && <div className="comptoir-alert" role="alert">{loadError}</div>}
        {historyError && <div className="comptoir-alert" role="alert">{historyError}</div>}
        {success && <div className="comptoir-success" role="status">{success}</div>}
        {loading && <div className="comptoir-progress" role="status"><RefreshCw className="is-spinning" aria-hidden="true" /> Chargement de la file SONASP…</div>}

        <section className="comptoir-panel comptoir-recent">
          <div className="comptoir-panel__head">
            <div><span>Boîte de réception</span><h2>{filteredSales.length} cession{filteredSales.length > 1 ? 's' : ''}</h2></div>
          </div>
          <div className="comptoir-table-wrap">
            <table>
              <caption className="sr-only">Cessions proposées par les comptoirs à la SONASP</caption>
              <thead><tr><th>Comptoir / référence</th><th>Date</th><th className="is-number">Quantité</th><th className="is-number">Montant</th><th>État</th><th>Décision</th><th>Traçabilité</th></tr></thead>
              <tbody>
                {!loading && filteredSales.length === 0 && <tr><td colSpan={7} className="comptoir-table-empty">Aucune cession dans cette vue.</td></tr>}
                {filteredSales.map((sale) => {
                  const events = historyBySale.get(sale.id) || [];
                  const expanded = expandedSaleId === sale.id;
                  return [
                    <tr key={sale.id}>
                      <td><strong>{sale.comptoirName || sale.comptoirCode || `Comptoir ${sale.comptoirId?.slice(0, 8) || 'non identifié'}`}</strong><small className="comptoir-cell-note">{sale.reference}</small></td>
                      <td>{displayDate(sale.date)}</td>
                      <td className="is-number">{decimal.format(sale.quantityGrams)} g</td>
                      <td className="is-number">{integer.format(sale.totalFcfa)} FCFA</td>
                      <td><span className={`comptoir-status is-${sale.status}`}>{statusLabels[sale.status]}</span></td>
                      <td><div className="comptoir-row-actions">
                        {canApprove && sale.status === 'submitted' && <>
                          <button type="button" className="comptoir-button is-success is-small" onClick={() => openDecision(sale, 'accepted')}><CheckCircle2 aria-hidden="true" />Accepter</button>
                          <button type="button" className="comptoir-button is-danger is-small" onClick={() => openDecision(sale, 'rejected')}><XCircle aria-hidden="true" />Rejeter</button>
                        </>}
                        {canPay && sale.status === 'accepted' && <button type="button" className="comptoir-button is-primary is-small" onClick={() => openDecision(sale, 'paid')}><Banknote aria-hidden="true" />Payer</button>}
                        {((sale.status !== 'submitted' || !canApprove) && (sale.status !== 'accepted' || !canPay)) && <span className="comptoir-no-action">Aucune action</span>}
                      </div></td>
                      <td><button type="button" className="comptoir-history-toggle" aria-expanded={expanded} onClick={() => setExpandedSaleId(expanded ? null : sale.id)}><History aria-hidden="true" />Historique ({events.length}){expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}</button></td>
                    </tr>,
                    expanded && <tr key={`${sale.id}-history`} className="comptoir-history-row"><td colSpan={7}>
                      {events.length === 0 ? <p>Aucun événement visible.</p> : <ol>{events.map((item) => <li key={item.id}><strong>{item.statusBefore || 'création'} → {item.statusAfter || item.action}</strong><span>{displayDate(item.occurredAt)} · {item.actorRole || item.capabilityCode || 'acteur habilité'}</span>{item.reason && <p>{item.reason}</p>}</li>)}</ol>}
                    </td></tr>,
                  ];
                })}
              </tbody>
            </table>
          </div>
        </section>

        {decision && selectedSale && <div className="comptoir-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !saving && setDecision(null)}>
          <section className="comptoir-dialog" role="dialog" aria-modal="true" aria-labelledby="decision-dialog-title">
            <header><div><span>{selectedSale.reference}</span><h2 id="decision-dialog-title">{decisionLabels[decision]}</h2></div><button type="button" onClick={() => setDecision(null)} aria-label="Fermer" disabled={saving}><X aria-hidden="true" /></button></header>
            <form onSubmit={submitDecision}>
              <div className="comptoir-fixed-buyer"><Banknote aria-hidden="true" /><div><small>{selectedSale.comptoirName || 'Comptoir'} · {decimal.format(selectedSale.quantityGrams)} g</small><strong>{integer.format(selectedSale.totalFcfa)} FCFA</strong></div></div>
              <label><span>Commentaire {decision === 'rejected' ? <small>(obligatoire pour un rejet)</small> : <small>(facultatif)</small>}</span><textarea autoFocus rows={4} maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)} /></label>
              {actionError && <p className="comptoir-form-error" role="alert">{actionError}</p>}
              <footer><button type="button" className="comptoir-button is-secondary" onClick={() => setDecision(null)} disabled={saving}>Annuler</button><button type="submit" className={`comptoir-button ${decision === 'rejected' ? 'is-danger' : 'is-primary'}`} disabled={saving}>{saving ? 'Enregistrement…' : 'Confirmer'}</button></footer>
            </form>
          </section>
        </div>}
      </main>
    </NationalDashboardLayout>
  );
}
