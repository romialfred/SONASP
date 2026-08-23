import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Clock, Loader2, XCircle } from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { EmptyState, Note, PageHeader, Section, Segmented, StatGrid } from '@/components/ui/sn';
import { ApprovalRequestCard } from '@/components/approval/ApprovalRequestCard';
import { SalesApprovalCard } from '@/components/approval/SalesApprovalCard';
import { SalesApprovalWorkflowPanel } from '@/components/sales/SalesApprovalWorkflowPanel';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errorMessage';
import './admin.css';

export type ApprovalFilter = 'pending' | 'approved' | 'rejected' | 'all';

export interface ApprovalRequest {
  id: string;
  status: string;
  request_type: string;
  entity_id: string | null;
  requested_at: string | null;
  [key: string]: unknown;
}

const FILTRES: Array<{ value: ApprovalFilter; label: string }> = [
  { value: 'pending', label: 'En attente' },
  { value: 'approved', label: 'Approuvées' },
  { value: 'rejected', label: 'Rejetées' },
  { value: 'all', label: 'Toutes' },
];

export const LIBELLES_FILTRE: Record<ApprovalFilter, string> = {
  pending: 'en attente',
  approved: 'approuvée',
  rejected: 'rejetée',
  all: '',
};

/** Décomptes par état, calculés sur l'ensemble des demandes. */
export function compterParStatut(demandes: ApprovalRequest[]) {
  return {
    pending: demandes.filter((demande) => demande.status === 'pending').length,
    approved: demandes.filter((demande) => demande.status === 'approved').length,
    rejected: demandes.filter((demande) => demande.status === 'rejected').length,
  };
}

export const filtrerDemandes = (demandes: ApprovalRequest[], filtre: ApprovalFilter) =>
  filtre === 'all' ? demandes : demandes.filter((demande) => demande.status === filtre);

export function ApprovalsDashboard() {
  const [demandes, setDemandes] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<ApprovalFilter>('pending');
  const [venteSuivie, setVenteSuivie] = useState<{ status: string } | null>(null);

  const charger = useCallback(async () => {
    setLoading(true);
    setErreur(null);
    try {
      // Les demandes sont chargées sans filtre d'état : les compteurs étaient calculés
      // sur la liste déjà filtrée, donc « approuvées » et « rejetées » affichaient
      // toujours zéro tant que le filtre « en attente » était actif.
      const { data, error } = await supabase
        .from('approval_requests')
        .select('*')
        .order('requested_at', { ascending: false });
      if (error) throw error;

      const lignes = (data || []) as ApprovalRequest[];
      setDemandes(lignes);

      const premiereVente = lignes.find(
        (demande) =>
          demande.status === 'pending' &&
          ['sale', 'sale_approval'].includes(demande.request_type) &&
          demande.entity_id
      );
      if (premiereVente?.entity_id) {
        const { data: vente } = await supabase
          .from('sales')
          .select('status')
          .eq('id', premiereVente.entity_id)
          .maybeSingle();
        setVenteSuivie(vente || null);
      } else {
        setVenteSuivie(null);
      }
    } catch (reason) {
      setErreur(errorMessage(reason, 'Impossible de charger les demandes d’approbation.'));
      setDemandes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  const compteurs = useMemo(() => compterParStatut(demandes), [demandes]);
  const visibles = useMemo(() => filtrerDemandes(demandes, filtre), [demandes, filtre]);

  return (
    <NationalDashboardLayout>
      <div className="sn-page admin-page approvals">
        <PageHeader
          icon={ClipboardCheck}
          title="Demandes d’approbation"
          subtitle="Validations en attente sur les ventes et les autres opérations soumises à contrôle."
          breadcrumb={[{ label: 'Administration' }, { label: 'Approbations' }]}
        />

        {erreur && (
          <Note tone="danger" icon={AlertTriangle}>
            {erreur}
          </Note>
        )}

        <StatGrid
          ariaLabel="État des demandes"
          items={[
            { label: 'En attente', value: compteurs.pending, icon: Clock, tone: 'gold' },
            { label: 'Approuvées', value: compteurs.approved, icon: CheckCircle2, tone: 'green' },
            { label: 'Rejetées', value: compteurs.rejected, icon: XCircle, tone: 'red' },
          ]}
        />

        {compteurs.pending > 0 && (
          <Note tone="warning" icon={Clock}>
            {compteurs.pending} demande(s) attendent une décision.
          </Note>
        )}

        <Section
          id="demandes"
          icon={ClipboardCheck}
          tone="emerald"
          title={`Demandes (${visibles.length})`}
          description="Chaque décision est tracée et notifiée au demandeur."
        >
          <div className="approvals__filtres">
            <Segmented
              name="filtre-approbations"
              value={filtre}
              options={FILTRES}
              onChange={setFiltre}
              ariaLabel="Filtrer les demandes"
            />
          </div>

          {loading ? (
            <div className="admin-page__loading">
              <Loader2 className="sn-spin" aria-hidden="true" /> Chargement des demandes…
            </div>
          ) : visibles.length === 0 ? (
            <EmptyState
              title={`Aucune demande ${LIBELLES_FILTRE[filtre]}`.trim()}
              description={
                demandes.length === 0
                  ? 'Aucune demande d’approbation n’a été enregistrée.'
                  : 'Changez de filtre pour consulter les autres demandes.'
              }
            />
          ) : (
            <div className="approvals__layout">
              <div className="approvals__liste">
                {visibles.map((demande) =>
                  ['sale', 'sale_approval'].includes(demande.request_type) ? (
                    <SalesApprovalCard
                      key={demande.id}
                      approval={demande}
                      onApproved={charger}
                      onRejected={charger}
                    />
                  ) : (
                    <ApprovalRequestCard
                      key={demande.id}
                      approval={demande}
                      onApproved={charger}
                      onRejected={charger}
                    />
                  )
                )}
              </div>

              {venteSuivie && filtre === 'pending' && (
                <aside className="approvals__workflow" aria-label="Circuit de validation de la vente">
                  <SalesApprovalWorkflowPanel currentStatus={venteSuivie.status} />
                </aside>
              )}
            </div>
          )}
        </Section>
      </div>
    </NationalDashboardLayout>
  );
}
