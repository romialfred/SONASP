import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Package, ShieldCheck, FileText, CheckCircle, Circle } from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { PageHeader, Section, Field, Card, FormActions, Note } from '@/components/ui/sn';
import { Button } from '@/components/ui/Button';
import { ActionErrorDialog } from '@/components/ui/ActionErrorDialog';
import { presentError } from '@/lib/presentError';
import { logisticsDate, logisticsNumber } from '@/components/shipping/LogisticsRegister';
import { freightCustomsService, type AvailableFreightShipment } from '@/services/freightCustomsService';
import { useNotification } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';
import { FREIGHT_CAPABILITIES, hasFreightCapability } from '@/lib/freightCustomsAccess';

export default function FreightCustomsCreate() {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const { user } = useAuth();
  const canPrepare = hasFreightCapability(user, FREIGHT_CAPABILITIES.PREPARE);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [shipments, setShipments] = useState<AvailableFreightShipment[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [notes, setNotes] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<ReturnType<typeof presentError> | null>(null);
  const lock = useRef(false);
  const selected = shipments.find(row => row.id === selectedId);
  const load = async () => {
    if (!canPrepare) { setLoading(false); return; }
    setLoading(true);
    try { setShipments(await freightCustomsService.getAvailableShipments()); setLoadFailed(false); }
    catch (reason) { setLoadFailed(true); setError(presentError(reason)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [canPrepare]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (lock.current || !canPrepare || !selected || loading || loadFailed) return;
    lock.current = true;
    setSubmitting(true);
    try {
      const operation = await freightCustomsService.createOperation(selected.id);
      let noteSaved = true;
      if (notes.trim()) {
        try { await freightCustomsService.updateOperation(operation.id, operation.updated_at, { notes: notes.trim() }); }
        catch { noteSaved = false; }
      }
      showNotification(noteSaved ? 'success' : 'warning', noteSaved
        ? `Customs operation ${operation.reference_number} created.`
        : `Operation ${operation.reference_number} exists, but its note could not be saved. Review the record before trying again.`);
      navigate(`/freight-customs/${operation.id}`);
    } catch (reason) { setError(presentError(reason)); }
    finally { lock.current = false; setSubmitting(false); }
  };
  return <NationalDashboardLayout><div className="sn-page logistics-workspace">
    <PageHeader title="New customs operation" subtitle="Open a customs file for an eligible shipment preparation." icon={ShieldCheck}
      breadcrumb={[{ label: 'Shipments', to: '/shipping/preparation' }, { label: 'Customs & consignment', to: '/freight-customs' }, { label: 'New operation' }]}
      actions={<Button type="button" variant="outline" disabled={submitting} onClick={() => navigate('/freight-customs')}><ArrowLeft size={16} />Back to operations</Button>} />
    {!canPrepare ? <Section id="customs-denied" title="Creation not authorised" icon={ShieldCheck}><Note tone="danger">A verified session with freight preparation access is required.</Note></Section> :
      <form onSubmit={submit} className="logistics-form-main">
        {loadFailed ? <Note tone="danger">Eligible shipments could not be loaded. Retry before creating an operation.</Note> :
          !loading && !shipments.length && <Note tone="info">No eligible shipment is available. A preparation must be ready for shipment and not already have a customs operation.</Note>}
        <div className="logistics-form-grid"><div className="logistics-form-main">
          <Section id="customs-shipment" title="Select the shipment" description="Only ready shipments within your authorised scope are offered." icon={Package}>
            <Field label="Shipment preparation" required><select required value={selectedId} onChange={e => setSelectedId(e.target.value)} disabled={loading || submitting || loadFailed || !shipments.length}>
              <option value="">{loading ? 'Loading eligible shipments…' : 'Select a shipment'}</option>
              {shipments.map(row => <option key={row.id} value={row.id}>{row.reference_number} · {row.mining_companies?.name} · {logisticsNumber(row.total_weight_grams)} g</option>)}
            </select></Field>
            {loadFailed && <Button type="button" className="mt-4" variant="outline" onClick={() => void load()}>Reload shipments</Button>}
          </Section>
          <Section id="customs-notes" title="Instructions & observations" description="Add any information needed to prepare this customs file." icon={FileText}>
            <Field label="Notes" hint="Optional. Supporting documents can be added after creation."><textarea rows={5} maxLength={5000} value={notes} disabled={submitting} onChange={e => setNotes(e.target.value)} placeholder="Instructions or observations for this customs operation…" /></Field>
          </Section>
          <Section id="customs-process" title="What happens next" icon={ShieldCheck}>
            <ol className="logistics-checklist"><li><CheckCircle />Preparation selected</li><li><Circle />Customs documents & approval</li><li><Circle />Transport arrangements & air waybill</li><li><Circle />Authorised dispatch to the refinery</li></ol>
          </Section>
        </div><Card title="Shipment summary" className="logistics-summary"><dl>
          <dt>Reference</dt><dd>{selected?.reference_number || '—'}</dd><dt>Company</dt><dd>{selected?.mining_companies?.name || '—'}</dd>
          <dt>Prepared on</dt><dd>{logisticsDate(selected?.shipment_date)}</dd><dt>Fine gold weight</dt><dd>{logisticsNumber(selected?.total_weight_grams)} g</dd>
          <dt>Troy ounces</dt><dd>{logisticsNumber(selected?.total_weight_oz)} oz</dd><dt>Initial status</dt><dd>Awaiting customs approval</dd>
        </dl><p className="mt-6 text-xs text-slate-500">The operation reference is generated by the server. Creating the file does not approve or dispatch the shipment.</p></Card></div>
        <FormActions><Button type="button" variant="outline" disabled={submitting} onClick={() => navigate('/freight-customs')}>Cancel</Button><Button type="submit" disabled={submitting || loading || loadFailed || !selected}><Save size={16} />{submitting ? 'Creating operation…' : 'Create operation'}</Button></FormActions>
      </form>}
    <ActionErrorDialog isOpen={Boolean(error)} onClose={() => setError(null)} title={error?.title} message={error?.message || ''} recovery={error?.recovery} diagnosticCode={error?.code}
      onAction={loadFailed ? () => { setError(null); void load(); } : undefined} actionLabel="Reload shipments" />
  </div></NationalDashboardLayout>;
}
