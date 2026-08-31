import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { Loading } from '@/components/ui/Loading';
import { Note } from '@/components/ui/sn';
import { useAuth } from '@/contexts/AuthContext';
import { CAPABILITIES, hasSensitiveCapability } from '@/lib/capabilities';
import { getInternationalSaleDetail, type InternationalSaleDetail } from '@/services/internationalSaleDetailService';
import { approveSale, rejectSale } from '@/services/approvalService';
import { downloadSaleDocument, type SaleDocument } from '@/services/saleDocumentsService';
import { InternationalSaleDetailView } from './InternationalSaleDetailView';

const DossierComplet = lazy(() => import('@/components/dossier/DossierComplet').then((module) => ({ default: module.DossierComplet })));

export function SaleDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const en = i18n.language.startsWith('en');
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ key: string; data?: InternationalSaleDetail; error?: boolean }>({ key: '' });
  // A token refresh/focus does not reload the file; a tenant change clears it.
  const scope = JSON.stringify([id, user?.id, user?.email, user?.role, user?.is_active, user?.mining_company_id, user?.organization_id,
    [...(user?.capabilities || [])].sort(), [...(user?.module_codes || [])].sort()]);
  const requestKey = `${scope}:${String(revision)}`;
  useEffect(() => {
    const controller = new AbortController();
    if (id && user?.is_active) {
      void getInternationalSaleDetail(id, controller.signal).then((data) => {
        if (!controller.signal.aborted) setState({ key: requestKey, data });
      }).catch(() => { if (!controller.signal.aborted) setState({ key: requestKey, error: true }); });
    }
    return () => { controller.abort(); };
  }, [id, user?.is_active, requestKey]);
  const ready = state.key === requestKey;
  const detail = ready ? state.data : undefined;
  async function decide(decision: 'approve' | 'reject', reason: string) {
    if (!id) return;
    const result = decision === 'approve' ? await approveSale(id, undefined, reason) : await rejectSale(id, undefined, reason);
    if (!result.success) throw new Error(result.error);
    setRevision((value) => value + 1);
  }
  async function download(document: SaleDocument) {
    const result = await downloadSaleDocument(document.type, document.documentId, id);
    if (!result.success || !result.url) throw new Error(result.error);
    window.open(result.url, '_blank', 'noopener,noreferrer');
  }
  return <NationalDashboardLayout>
    {!ready && user?.is_active ? <div className="sn-page"><Loading message={en ? 'Loading sale…' : 'Chargement de la vente…'} /></div>
      : !detail ? <div className="sn-page"><Note tone="danger">{en ? 'Sale unavailable in your access scope. Please retry.' : 'Vente introuvable ou indisponible dans votre périmètre. Réessayez.'}</Note><div className="isd-form-actions"><Link className="sn-btn" to="/sales">{en ? 'Back to sales' : 'Retour aux ventes'}</Link><button className="sn-btn" type="button" onClick={() => { setRevision((v) => v + 1); }}>{en ? 'Retry' : 'Réessayer'}</button></div></div>
        : <InternationalSaleDetailView key={scope} detail={detail}
          canPay={hasSensitiveCapability(user, CAPABILITIES.FINANCE_EXECUTE)}
          canApprove={hasSensitiveCapability(user, CAPABILITIES.SONASP_APPROVE) && detail.sale.created_by !== user?.id}
          onDecision={decide} onDownload={download}
          historyContent={<Suspense fallback={<Loading />}><DossierComplet type="vente" id={detail.sale.id} /></Suspense>} />}
  </NationalDashboardLayout>;
}
