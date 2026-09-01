import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Package, Building2, FileText, Scale, ShieldCheck } from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { PageHeader, Section, Field, Card, FormActions, Note } from '@/components/ui/sn';
import { Button } from '@/components/ui/Button';
import { ActionErrorDialog } from '@/components/ui/ActionErrorDialog';
import { logisticsNumber } from '@/components/shipping/LogisticsRegister';
import { presentError } from '@/lib/presentError';
import { FreightShipmentPartialSaveError, freightShipmentService, type AvailableShippingPreparation } from '@/services/freightShipmentService';
import { useNotification } from '@/contexts/NotificationContext';
import { supabase } from '@/lib/supabase';

interface Signatory { position: string; full_name: string; display_order: number }
export default function FreightShipmentCreate() {
  const navigate = useNavigate();
  const { showSuccess, showWarning } = useNotification();
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signatoriesLoading, setSignatoriesLoading] = useState(false);
  const [signatoriesFailed, setSignatoriesFailed] = useState(false);
  const [error, setError] = useState<ReturnType<typeof presentError> | null>(null);
  const [shipments, setShipments] = useState<AvailableShippingPreparation[]>([]);
  const [refineries, setRefineries] = useState<Array<{ id: string; name: string; country: string }>>([]);
  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [refineryId, setRefineryId] = useState('');
  const [boxes, setBoxes] = useState('1');
  const [boxType, setBoxType] = useState('Plastic Box');
  const [price, setPrice] = useState('');
  const [rate, setRate] = useState('');
  const [notes, setNotes] = useState('');
  const [signatories, setSignatories] = useState<Signatory[]>([]);
  const lock = useRef(false);
  const submissionRequest = useRef<{ fingerprint: string; key: string } | null>(null);
  const selected = shipments.filter(row => selectedIds.includes(row.id));
  const gross = selected.reduce((sum, row) => sum + row.total_gross_weight_grams, 0);
  const fine = selected.reduce((sum, row) => sum + row.total_net_weight_grams, 0);
  const ounces = fine / 31.1034768;
  const companyName = (row: AvailableShippingPreparation) => [...new Set(row.items.map(item => companies.find(company => company.id === item.daily_production?.mining_company_id)?.name).filter(Boolean))].join(', ') || '—';
  const load = async () => {
    setLoading(true);
    try {
      const [preparations, refineryResult, companyResult] = await Promise.all([
        freightShipmentService.getAvailableShippingPreparations(),
        supabase.from('refineries').select('id, name, country').eq('is_active', true).order('name'),
        supabase.from('mining_companies').select('id, name').order('name'),
      ]);
      if (refineryResult.error) throw refineryResult.error;
      if (companyResult.error) throw companyResult.error;
      setShipments(preparations); setRefineries(refineryResult.data || []); setCompanies(companyResult.data || []);
      setLoadFailed(false);
    } catch (reason) { setLoadFailed(true); setError(presentError(reason)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    let current = true;
    setSignatories([]); setSignatoriesFailed(false);
    if (!selectedIds.length) { setSignatoriesLoading(false); return; }
    setSignatoriesLoading(true);
    void Promise.all(selectedIds.map(id => supabase.from('shipping_signatories').select('name, position').eq('shipping_preparation_id', id).order('order_index')))
      .then(results => {
        if (!current) return;
        const failure = results.find(result => result.error);
        if (failure) throw failure.error;
        const unique = new Map<string, Signatory>();
        results.flatMap(result => result.data || []).forEach(row => {
          if (row.name && row.position) unique.set(`${row.name}\u0000${row.position}`, { full_name: row.name, position: row.position, display_order: unique.size });
        });
        setSignatories([...unique.values()]);
      }).catch(reason => { if (current) { setSignatoriesFailed(true); setError(presentError(reason)); } })
      .finally(() => { if (current) setSignatoriesLoading(false); });
    return () => { current = false; };
  }, [selectedIds]);
  const selectIds = (ids: string[]) => {
    setSelectedIds(ids);
    const selectedRows = shipments.filter(row => ids.includes(row.id));
    setBoxes(String(Math.max(1, selectedRows.reduce((sum, row) => sum + (row.total_boxes || row.items.length), 0))));
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (lock.current || loading || loadFailed || signatoriesLoading || signatoriesFailed) return;
    const validNumber = (value: string) => Number.isFinite(Number(value)) && Number(value) > 0;
    if (!selected.length || selected.length !== selectedIds.length || !refineries.some(row => row.id === refineryId)
      || !validNumber(price) || !validNumber(rate) || !validNumber(boxes) || !Number.isInteger(Number(boxes))
      || !Number.isFinite(fine) || fine <= 0 || !Number.isFinite(gross) || gross < fine || !date || !signatories.length) {
      setError({ category: 'validation', code: undefined, title: 'Review the shipment',
        message: 'Select eligible preparations, a refinery, a valid date, a package count and positive pricing values. Each preparation needs valid weights and signatories.',
        recovery: 'Correct the information before saving. Signatories are managed in each shipment preparation.' });
      return;
    }
    lock.current = true; setSubmitting(true);
    try {
      const request = {
        shipping_preparation_ids: selectedIds, shipment_date: date, destination_refinery_id: refineryId,
        number_of_boxes: Number(boxes), box_type: boxType, gold_price_usd_per_oz: Number(price), exchange_rate: Number(rate),
        local_currency: 'XOF', notes: notes.trim(), signatories,
      };
      const fingerprint = JSON.stringify({
        ...request,
        signatories: undefined,
        shipping_preparation_ids: [...selectedIds].sort(),
      });
      if (!submissionRequest.current || submissionRequest.current.fingerprint !== fingerprint) {
        submissionRequest.current = { fingerprint, key: crypto.randomUUID() };
      }
      const shipment = await freightShipmentService.createShipment({
        ...request,
        idempotency_key: submissionRequest.current.key,
      });
      submissionRequest.current = null;
      showSuccess('Freight shipment created', `Shipment ${shipment.reference_number} is awaiting approval.`);
      navigate(`/freight/shipments/${shipment.id}`);
    } catch (reason) {
      if (reason instanceof FreightShipmentPartialSaveError) {
        showWarning('Shipment requires review', `${reason.reference} exists, but some related records were not confirmed. Review the existing shipment; do not create another one.`);
        navigate(`/freight/shipments/${reason.shipmentId}`);
      } else setError(presentError(reason));
    }
    finally { lock.current = false; setSubmitting(false); }
  };
  return <NationalDashboardLayout><div className="sn-page logistics-workspace">
    <PageHeader title="New freight shipment" subtitle="Consolidate cleared preparations for delivery to the refinery." icon={Package}
      breadcrumb={[{ label: 'Shipments', to: '/shipping/preparation' }, { label: 'Freight shipments', to: '/freight' }, { label: 'New shipment' }]}
      actions={<Button type="button" variant="outline" disabled={submitting} onClick={() => navigate('/freight')}><ArrowLeft size={16} />Back to freight shipments</Button>} />
    {loadFailed && <Note tone="danger">Preparation data could not be loaded. <Button type="button" variant="outline" onClick={() => void load()}>Reload data</Button></Note>}
    {!loading && !loadFailed && !shipments.length && <Note tone="info">No eligible preparations are available. Preparations must be ready for shipment and their lots must not already be assigned to freight.</Note>}
    <form onSubmit={submit}><div className="logistics-form-grid"><fieldset className="logistics-form-main" disabled={loading || loadFailed || submitting}>
      <Section id="freight-selection" title="Select shipment preparations" description="Search and select authorised preparations. Every production lot is included once." icon={Package}>
        <Field label="Find a preparation"><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Reference or mining company…" /></Field>
        <div className="my-4 flex gap-3"><Button type="button" variant="outline" onClick={() => selectIds(shipments.filter(row => `${row.expedition_lot_number} ${companyName(row)}`.toLowerCase().includes(search.toLowerCase())).map(row => row.id))}>Select matching</Button><Button type="button" variant="outline" onClick={() => selectIds([])}>Clear selection</Button></div>
        <div className="overflow-x-auto"><table className="sn-table"><caption className="sr-only">Available preparations</caption><thead><tr><th>Select</th><th>Preparation</th><th>Company</th><th>Gross (g)</th><th>Fine gold (g)</th><th>Lots</th></tr></thead><tbody>
          {shipments.filter(row => `${row.expedition_lot_number} ${companyName(row)}`.toLowerCase().includes(search.toLowerCase())).map(row => <tr key={row.id}>
            <td><input type="checkbox" aria-label={`Select ${row.expedition_lot_number}`} checked={selectedIds.includes(row.id)} onChange={e => selectIds(e.target.checked ? [...selectedIds, row.id] : selectedIds.filter(id => id !== row.id))} /></td>
            <td>{row.expedition_lot_number}</td><td>{companyName(row)}</td><td>{logisticsNumber(row.total_gross_weight_grams)}</td><td>{logisticsNumber(row.total_net_weight_grams)}</td><td>{row.items.length}</td></tr>)}
          {loading && <tr><td colSpan={6}>Loading preparations…</td></tr>}
        </tbody></table></div>
      </Section>
      <Section id="freight-destination" title="Destination & packaging" icon={Building2}><div className="logistics-fields">
        <Field label="Shipment date" required><input type="date" value={date} onChange={e => setDate(e.target.value)} required /></Field>
        <Field label="Destination refinery" required><select value={refineryId} onChange={e => setRefineryId(e.target.value)} required><option value="">Select a refinery</option>{refineries.map(row => <option key={row.id} value={row.id}>{row.name} · {row.country}</option>)}</select></Field>
        <Field label="Number of packages" required><input type="number" min="1" step="1" value={boxes} onChange={e => setBoxes(e.target.value)} required /></Field>
        <Field label="Packaging type" required><input value={boxType} onChange={e => setBoxType(e.target.value)} maxLength={100} required /></Field>
      </div><div className="mt-4"><Note tone="info">Carriers are recorded in each preparation. Air waybills, customs clearance and dispatch evidence are recorded in the customs file.</Note></div></Section>
      <Section id="freight-valuation" title="Declared value" description="Pricing is expressed per troy ounce. The exchange rate is XOF per 1 USD." icon={Scale}><div className="logistics-fields">
        <Field label="Gold price (USD / oz)" required><input type="number" min="0.000001" step="any" value={price} onChange={e => setPrice(e.target.value)} required /></Field>
        <Field label="Exchange rate (USD → XOF)" required><input type="number" min="0.000001" step="any" value={rate} onChange={e => setRate(e.target.value)} required /></Field>
      </div></Section>
      <Section id="freight-signatories" title="Authorised signatories" description="Loaded from the selected preparations; the names are not inferred or generated." icon={ShieldCheck}>
        {signatoriesLoading ? <p>Loading signatories…</p> : signatoriesFailed ? <Note tone="danger">Signatories could not be loaded. Reselect the preparations to retry.</Note> :
          signatories.length ? <ul className="logistics-checklist">{signatories.map((row, index) => <li key={index}>{row.full_name} · {row.position}</li>)}</ul> :
            <p>No signatories selected. Add the signatories to the source preparation before continuing.</p>}
      </Section>
      <Section id="freight-notes" title="Instructions & observations" icon={FileText}><Field label="Notes"><textarea rows={4} maxLength={5000} value={notes} onChange={e => setNotes(e.target.value)} /></Field></Section>
    </fieldset><Card title="Shipment summary" className="logistics-summary"><dl>
      <dt>Preparations</dt><dd>{selected.length}</dd><dt>Production lots</dt><dd>{selected.reduce((sum, row) => sum + row.items.length, 0)}</dd>
      <dt>Gross weight</dt><dd>{logisticsNumber(gross)} g</dd><dt>Fine gold weight</dt><dd>{logisticsNumber(fine)} g</dd><dt>Troy ounces</dt><dd>{logisticsNumber(ounces, 6)} oz</dd>
      <dt>Declared value</dt><dd>{logisticsNumber(price ? ounces * Number(price) : null)} USD</dd><dt>Local value</dt><dd>{logisticsNumber(price && rate ? ounces * Number(price) * Number(rate) : null)} XOF</dd>
    </dl><p className="mt-5 text-sm text-slate-500">The reference is assigned by the server. The initial status is Pending; dispatch requires a separate authorisation.</p></Card></div>
    <FormActions><Button type="button" variant="outline" disabled={submitting} onClick={() => navigate('/freight')}>Cancel</Button><Button type="submit" disabled={submitting || loading || loadFailed || !selected.length || signatoriesLoading || signatoriesFailed}><Save size={16} />{submitting ? 'Creating shipment…' : 'Create freight shipment'}</Button></FormActions></form>
    <ActionErrorDialog isOpen={Boolean(error)} onClose={() => setError(null)} title={error?.title} message={error?.message || ''} recovery={error?.recovery} diagnosticCode={error?.code}
      onAction={loadFailed ? () => { setError(null); void load(); } : undefined} actionLabel="Reload data" />
  </div></NationalDashboardLayout>;
}
