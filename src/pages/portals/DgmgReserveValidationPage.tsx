import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { Badge, DataTable, Note, PageHeader, Section, type Column } from '@/components/ui/sn';
import { errorMessage } from '@/lib/errorMessage';
import { supabase } from '@/lib/supabase';
import './institutional-work-queue.css';

type ValidationTarget = 'UNDER_REVIEW' | 'VALIDATED_LEVEL_1' | 'REJECTED';

interface ReserveValidationRow {
  id: string;
  reference: string;
  allocation_date: string;
  status: string;
  reason: string | null;
  decision_reference: string | null;
  decision_authority: string | null;
  depository_name: string | null;
  lot_count: number;
  ingot_count: number;
  gross_weight_grams: number;
  fine_weight_grams: number;
  submitted_at: string | null;
}

const weight = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

export function DgmgReserveValidationPage() {
  const [rows, setRows] = useState<ReserveValidationRow[]>([]);
  const [selected, setSelected] = useState<ReserveValidationRow | null>(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase.rpc('snp_dgmg_lister_validations_reserve_level_1', {
      p_limit: 100,
      p_offset: 0,
    });
    if (error) {
      setRows([]);
      setSelected(null);
      setLoadError(errorMessage(error, 'Impossible de charger la file de validation DGMG.'));
    } else {
      const nextRows = data ?? [];
      setRows(nextRows);
      setSelected((current) => nextRows.find((row) => row.id === current?.id) ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const transition = useCallback(async (target: ValidationTarget) => {
    if (!selected) return;
    setSubmitting(true);
    setMessage(null);
    setLoadError(null);
    const { error } = await supabase.rpc('snp_dgmg_transition_reserve_level_1', {
      p_allocation_id: selected.id,
      p_target_status: target,
      p_comment: comment.trim() || null,
    });
    if (error) {
      setLoadError(errorMessage(error, 'La décision n’a pas été enregistrée.'));
    } else {
      setMessage(target === 'REJECTED' ? 'Le dossier a été rejeté.' : 'La transition a été enregistrée.');
      setComment('');
      await load();
    }
    setSubmitting(false);
  }, [comment, load, selected]);

  const columns = useMemo<Column<ReserveValidationRow>[]>(() => [
    { key: 'reference', header: 'Référence' },
    {
      key: 'allocation_date', header: 'Date',
      render: (row) => new Date(row.allocation_date).toLocaleDateString('fr-FR'),
    },
    { key: 'reason', header: 'Motif' },
    { key: 'depository_name', header: 'Dépositaire' },
    { key: 'lot_count', header: 'Lots', numeric: true },
    {
      key: 'fine_weight_grams', header: 'Poids fin', numeric: true,
      render: (row) => `${weight.format(row.fine_weight_grams)} g`,
    },
    {
      key: 'status', header: 'Étape',
      render: (row) => <Badge tone={row.status === 'SUBMITTED' ? 'warning' : 'info'}>{row.status}</Badge>,
    },
  ], []);

  return (
    <div className="sn-page institutional-work-queue">
      <PageHeader
        icon={ShieldCheck}
        title="Validation Réserve — niveau 1"
        subtitle="File réglementaire DGMG limitée au contrôle initial des affectations soumises."
        breadcrumb={[{ label: 'Portail DGMG', to: '/portail-dgmg' }, { label: 'Validation niveau 1' }]}
        actions={(
          <button className="institutional-work-queue__button" type="button" onClick={() => void load()} disabled={loading || submitting}>
            <RefreshCw aria-hidden="true" /> Actualiser
          </button>
        )}
      />
      <Note tone="info">
        Cette file ne donne accès ni aux positions physiques, ni aux valorisations, ni aux documents et journaux de la Réserve nationale.
      </Note>
      {loadError && <Note tone="danger">{loadError}</Note>}
      {message && <Note tone="success">{message}</Note>}
      <Section
        id="dgmg-reserve-level-one"
        icon={ShieldCheck}
        title={`Dossiers à contrôler (${rows.length})`}
        description="Sélectionnez une ligne pour prendre le dossier en contrôle, le valider ou le rejeter."
      >
        <DataTable
          caption="Affectations soumises au contrôle DGMG de niveau 1"
          columns={columns}
          rows={rows}
          onRowClick={setSelected}
          loading={loading}
          empty="Aucune affectation n’attend une validation DGMG de niveau 1."
        />
      </Section>
      {selected && (
        <Section
          id="dgmg-reserve-decision"
          icon={ShieldCheck}
          title={`Décision — ${selected.reference}`}
          description={`${selected.decision_reference ?? 'Décision non référencée'} · ${selected.decision_authority ?? 'Autorité non renseignée'}`}
        >
          <label className="institutional-work-queue__comment" htmlFor="dgmg-validation-comment">
            Commentaire ou motif de rejet
            <textarea
              id="dgmg-validation-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={3}
              maxLength={1_000}
              placeholder="Précisez les contrôles réalisés ; 10 caractères minimum pour un rejet."
            />
          </label>
          <div className="institutional-work-queue__actions">
            {selected.status === 'SUBMITTED' && (
              <button type="button" onClick={() => void transition('UNDER_REVIEW')} disabled={submitting}>Prendre en contrôle</button>
            )}
            {selected.status === 'UNDER_REVIEW' && (
              <button type="button" onClick={() => void transition('VALIDATED_LEVEL_1')} disabled={submitting}>Valider le niveau 1</button>
            )}
            <button
              className="is-danger"
              type="button"
              onClick={() => void transition('REJECTED')}
              disabled={submitting || comment.trim().length < 10}
            >
              Rejeter le dossier
            </button>
          </div>
        </Section>
      )}
    </div>
  );
}

export default DgmgReserveValidationPage;
