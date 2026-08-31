import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Note } from '@/components/ui/sn';
import type { DocumentDossier } from '@/services/dossierService';
import { downloadPaymentDocument, getInternationalPaymentDetail, type InternationalPaymentDetail } from '@/services/internationalPaymentDetailService';
import { InternationalPaymentDetailView } from './InternationalPaymentDetailView';

export function PaymentDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const scope = JSON.stringify([id, user?.id, user?.role, user?.is_active, user?.organization_id, user?.mining_company_id,
    [...(user?.capabilities || [])].sort(), [...(user?.module_codes || [])].sort()]);
  const active = Boolean(id && user?.id && user.is_active);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ scope: string; data?: InternationalPaymentDetail; loading: boolean; error?: boolean }>({ scope: '', loading: true });
  const downloadAbort = useRef<AbortController | null>(null);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  useEffect(() => () => { downloadAbort.current?.abort(); }, [scope]);
  useEffect(() => {
    const abort = new AbortController();
    if (!active || !id) {
      setState({ scope, loading: false, error: true });
      return () => abort.abort();
    }
    setState((previous) => previous.scope === scope ? { ...previous, loading: true, error: false } : { scope, loading: true });
    void getInternationalPaymentDetail(id, abort.signal).then((data) => {
      if (!abort.signal.aborted) setState({ scope, data, loading: false });
    }).catch(() => { if (!abort.signal.aborted) setState({ scope, loading: false, error: true }); });
    return () => abort.abort();
  }, [scope, active, id, revision]);
  const sameScope = state.scope === scope;
  async function download(document: DocumentDossier) {
    if (!active || currentScope.current !== scope) throw new Error('Session modifiée.');
    downloadAbort.current?.abort();
    const abort = new AbortController(); downloadAbort.current = abort;
    await downloadPaymentDocument(document, abort.signal);
  }
  return <NationalDashboardLayout>
    {sameScope && state.data ? <InternationalPaymentDetailView key={scope} detail={state.data} refreshing={state.loading} onRefresh={() => setRevision((value) => value + 1)} onDownload={download} />
      : <div className="sn-page ipd-page"><Link className="sn-btn" to="/payments">Retour aux paiements</Link><h1>Détail du paiement</h1>
        {sameScope && state.error ? <><Note tone="danger">Paiement indisponible dans votre périmètre, ou chargement impossible. Aucune donnée d’un autre compte n’est affichée.</Note><button className="sn-btn" onClick={() => setRevision((value) => value + 1)}>Réessayer</button></> : <div className="ipd-loading" role="status">Chargement du paiement et de son dossier…</div>}
      </div>}
  </NationalDashboardLayout>;
}
