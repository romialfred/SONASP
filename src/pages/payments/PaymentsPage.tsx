import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { CAPABILITIES, hasSensitiveCapability } from '@/lib/capabilities';
import { errorMessage } from '@/lib/errorMessage';
import { listInternationalPayments, type InternationalPaymentRecord } from '@/services/internationalPaymentsListService';
import { InternationalPaymentsView } from './InternationalPaymentsView';

export function PaymentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Equivalent auth/token refreshes must not remount the register or its filters.
  const scope = JSON.stringify([user?.id, user?.role, user?.is_active, user?.mining_company_id,
    user?.organization_id, [...(user?.capabilities || [])].sort(), [...(user?.module_codes || [])].sort()]);
  const active = Boolean(user?.id && user.is_active);
  const [request, setRequest] = useState(0);
  const [state, setState] = useState<{ scope: string; rows: InternationalPaymentRecord[]; loading: boolean; refreshing: boolean; error: string | null; today: string }>({
    scope: '', rows: [], loading: true, refreshing: false, error: null, today: new Date().toISOString().slice(0, 10),
  });
  useEffect(() => {
    const abort = new AbortController();
    if (!active) {
      setState({ scope, rows: [], loading: false, refreshing: false, error: 'Session indisponible. Reconnectez-vous pour consulter les paiements.', today: new Date().toISOString().slice(0, 10) });
      return () => abort.abort();
    }
    setState((previous) => previous.scope === scope && !previous.error
      ? { ...previous, refreshing: !previous.loading, error: null }
      : { scope, rows: [], loading: true, refreshing: false, error: null, today: new Date().toISOString().slice(0, 10) });
    void listInternationalPayments(abort.signal).then((rows) => {
      if (!abort.signal.aborted) setState({ scope, rows, loading: false, refreshing: false, error: null, today: new Date().toISOString().slice(0, 10) });
    }).catch((reason: unknown) => {
      if (!abort.signal.aborted) setState({ scope, rows: [], loading: false, refreshing: false, error: errorMessage(reason, 'Impossible de charger les paiements.'), today: new Date().toISOString().slice(0, 10) });
    });
    return () => abort.abort();
  }, [scope, active, request]);
  const sameScope = state.scope === scope;
  return <NationalDashboardLayout><InternationalPaymentsView key={scope}
    payments={sameScope ? state.rows : []} loading={!sameScope || state.loading}
    refreshing={sameScope && state.refreshing} error={sameScope ? state.error : null} today={state.today}
    canCreate={hasSensitiveCapability(user, CAPABILITIES.FINANCE_EXECUTE)}
    onRefresh={() => setRequest((value) => value + 1)}
    onOpenPayment={(id) => navigate(`/payments/${id}`)}
    onOpenSale={(id) => navigate(`/sales/${id}`)}
    onCreate={(saleId) => navigate(saleId ? `/payments/create?saleId=${encodeURIComponent(saleId)}` : '/payments/create')} />
  </NationalDashboardLayout>;
}
