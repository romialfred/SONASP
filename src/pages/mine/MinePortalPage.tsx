import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  ClipboardCheck,
  FileCheck2,
  FileText,
  FlaskConical,
  LogOut,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useMinePortalAccess } from '@/components/auth/MinePortalGuard';
import { Loading } from '@/components/ui/Loading';
import {
  MinePortalDataError,
  minePortalService,
  type MinePortalSnapshot,
} from '@/services/minePortalService';

const money = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const quantity = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

function formatDate(value: string | null): string {
  if (!value) return 'Non renseignée';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 'Non renseignée' : date.toLocaleDateString('fr-FR');
}

function statusLabel(value: string): string {
  const labels: Record<string, string> = {
    actif: 'Actif', signe: 'Signé', suspendu: 'Suspendu', echu: 'Échu', cloture: 'Clôturé',
    soumise: 'Soumise', envoyee: 'Envoyée', acceptee: 'Acceptée', approuvee: 'Approuvée', rejetee: 'Rejetée',
    emise: 'Émise', partiellement_payee: 'Partiellement payée', payee: 'Payée', en_retard: 'En retard',
    execute: 'Exécuté', rapproche: 'Rapproché', en_attente: 'En attente', analysee: 'Analysée', tranchee: 'Tranchée',
    notifiee: 'Notifiée', accusee: 'Accusée', en_execution: 'En exécution', executee: 'Exécutée',
  };
  return labels[value] || value.split('_').join(' ');
}

export default function MinePortalPage() {
  const { companyId, user } = useMinePortalAccess();
  const { signOut } = useAuth();
  const [data, setData] = useState<MinePortalSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await minePortalService.load(companyId));
    } catch (loadError) {
      setData(null);
      setError(loadError instanceof MinePortalDataError
        ? loadError.message
        : 'Le Portail Mine est momentanément indisponible. Réessayez plus tard.');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-screen bg-[#f5f7f5] text-slate-900">
      <a href="#mine-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:shadow-lg">
        Aller au contenu
      </a>
      <header className="border-b border-emerald-900/20 bg-[#075c3f] text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <img src="/sonasp-logo-clair.png" alt="SONASP" className="h-11 w-auto" width={118} height={45} />
            <div className="border-l border-white/25 pl-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">Portail Mine</p>
              <p className="truncate text-sm text-emerald-50">{data?.company.name || 'Espace sécurisé'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-right text-sm sm:block">
              <strong className="block">{user.full_name || user.email}</strong>
              <span className="text-emerald-100">Compte de société minière</span>
            </span>
            <button type="button" onClick={() => void signOut()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/30 px-3 py-2 text-sm font-semibold transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      <main id="mine-main" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Périmètre de données vérifié
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Vos opérations avec la SONASP</h1>
            <p className="mt-2 max-w-3xl text-slate-600">
              Contrats, demandes, factures, règlements et analyses rattachés exclusivement à votre société.
            </p>
          </div>
          <Link to="/" className="text-sm font-semibold text-emerald-800 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
            Retour à la vitrine institutionnelle
          </Link>
        </div>

        {loading && (
          <div className="mt-10 flex min-h-80 items-center justify-center rounded-2xl border border-slate-200 bg-white" aria-live="polite">
            <div className="text-center"><Loading size="lg" /><p className="mt-4 text-slate-600">Chargement de votre périmètre…</p></div>
          </div>
        )}

        {!loading && error && (
          <section className="mt-10 rounded-2xl border border-red-200 bg-white p-8 text-center" role="alert" aria-labelledby="mine-error-title">
            <h2 id="mine-error-title" className="text-xl font-bold text-slate-900">Données indisponibles</h2>
            <p className="mx-auto mt-2 max-w-2xl text-slate-600">{error}</p>
            <button type="button" onClick={() => void load()} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2">
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Réessayer
            </button>
          </section>
        )}

        {!loading && data && <PortalContent data={data} />}
      </main>
    </div>
  );
}

function PortalContent({ data }: { data: MinePortalSnapshot }) {
  const pendingAnalyses = data.analyses.filter((item) => !['tranchee', 'annulee'].includes(item.statut)).length;
  const pendingRequests = data.requests.filter((item) => !['approuvee', 'rejetee', 'annulee'].includes(item.statut)).length;

  return (
    <div className="mt-10 space-y-8">
      <section aria-label="Indicateurs du Portail Mine" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={FileCheck2} label="Contrats visibles" value={String(data.contracts.length)} />
        <Metric icon={ClipboardCheck} label="Demandes à traiter" value={String(pendingRequests)} />
        <Metric icon={WalletCards} label="Solde à recevoir" value={`${money.format(data.situation?.reste_du || 0)} FCFA`} />
        <Metric icon={FlaskConical} label="Analyses en cours" value={String(pendingAnalyses)} />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Contrats et engagements" icon={FileText} empty="Aucun contrat accessible dans votre périmètre.">
          {data.contracts.map((contract) => (
            <Row key={contract.id} title={contract.numero_contrat} subtitle={`${contract.intitule} · échéance ${formatDate(contract.date_fin)}`} value={contract.quantite_totale == null ? null : `${quantity.format(contract.quantite_totale)} ${contract.unite}`} status={contract.statut} />
          ))}
        </Panel>

        <Panel title="Demandes et réquisitions" icon={ClipboardCheck} empty="Aucune demande ou réquisition ne requiert votre attention.">
          {data.requests.map((request) => (
            <Row key={request.id} title={request.numero_demande} subtitle={`Réponse avant le ${formatDate(request.date_limite_reponse)}`} value={`${quantity.format(request.quantite_demandee_oz)} oz`} status={request.statut} />
          ))}
          {data.requisitions.map((requisition) => (
            <Row key={requisition.id} title={requisition.reference} subtitle={requisition.objet} value={requisition.quantite_oz == null ? null : `${quantity.format(requisition.quantite_oz)} ${requisition.unite}`} status={requisition.statut} />
          ))}
        </Panel>

        <Panel title="Factures et règlements" icon={ReceiptText} empty="Aucune facture ou aucun règlement enregistré.">
          {data.invoices.map((invoice) => (
            <Row key={invoice.id} title={invoice.numero_facture} subtitle={`Échéance ${formatDate(invoice.date_echeance)}`} value={`${money.format(invoice.montant_ttc_fcfa)} ${invoice.devise}`} status={invoice.statut} />
          ))}
          {data.payments.map((payment) => (
            <Row key={payment.id} title={payment.reference_reglement} subtitle={`Règlement du ${formatDate(payment.date_reglement)}`} value={`${money.format(payment.montant_fcfa)} ${payment.devise}`} status={payment.statut} />
          ))}
        </Panel>

        <Panel title="Analyses de teneur" icon={FlaskConical} empty="Aucune analyse de teneur disponible.">
          {data.analyses.map((analysis) => (
            <Row key={analysis.id} title={analysis.reference} subtitle={`Prélèvement ${formatDate(analysis.date_prelevement)}`} value={analysis.teneur_retenue_pct == null ? `Déclarée ${quantity.format(analysis.teneur_declaree_pct)} %` : `Retenue ${quantity.format(analysis.teneur_retenue_pct)} %`} status={analysis.statut} />
          ))}
        </Panel>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3"><span className="rounded-lg bg-emerald-100 p-2 text-emerald-800"><Icon className="h-5 w-5" aria-hidden="true" /></span><p className="text-sm font-semibold text-slate-600">{label}</p></div>
      <p className="mt-4 text-2xl font-bold tracking-tight text-slate-950">{value}</p>
    </article>
  );
}

function Panel({ title, icon: Icon, empty, children }: { title: string; icon: typeof Building2; empty: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children.flat().filter(Boolean) : children ? [children] : [];
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4"><Icon className="h-5 w-5 text-emerald-700" aria-hidden="true" /><h2 className="text-lg font-bold">{title}</h2></div>
      {items.length > 0 ? <div className="divide-y divide-slate-100">{children}</div> : <p className="px-5 py-10 text-center text-sm text-slate-500">{empty}</p>}
    </section>
  );
}

function Row({ title, subtitle, value, status }: { title: string; subtitle: string; value: string | null; status: string }) {
  return (
    <article className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0"><h3 className="truncate font-semibold text-slate-900">{title}</h3><p className="mt-1 line-clamp-2 text-sm text-slate-500">{subtitle}</p></div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">{value && <span className="text-sm font-semibold tabular-nums text-slate-700">{value}</span>}<span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-700">{statusLabel(status)}</span></div>
    </article>
  );
}
