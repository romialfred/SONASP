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
import { useAuth } from '@/contexts/AuthContext';
import { FREIGHT_CAPABILITIES, hasFreightCapability } from '@/lib/freightCustomsAccess';
import { supabase } from '@/lib/supabase';

interface Signatory { position: string; full_name: string; display_order: number }
export default function FreightShipmentCreate() {
  const navigate = useNavigate();
  const { showSuccess, showWarning } = useNotification();
  const { user } = useAuth();
  // Meme garde de capacite que l'ecran douane : sans la preparation du fret, le
  // formulaire etait pleinement utilisable puis rejete par la RPC (UX trompeuse).
  const canPrepare = hasFreightCapability(user, FREIGHT_CAPABILITIES.PREPARE);
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
  const [boxType, setBoxType] = useState('Caisse en plastique');
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
    if (!canPrepare || lock.current || loading || loadFailed || signatoriesLoading || signatoriesFailed) return;
    const validNumber = (value: string) => Number.isFinite(Number(value)) && Number(value) > 0;
    if (!selected.length || selected.length !== selectedIds.length || !refineries.some(row => row.id === refineryId)
      || !validNumber(price) || !validNumber(rate) || !validNumber(boxes) || !Number.isInteger(Number(boxes))
      || !Number.isFinite(fine) || fine <= 0 || !Number.isFinite(gross) || gross < fine || !date || !signatories.length) {
      setError({ category: 'validation', code: undefined, title: 'Vérifiez l’expédition',
        message: 'Sélectionnez des préparations admissibles, une raffinerie, une date valide, un nombre de colis et des valeurs tarifaires positives. Chaque préparation doit comporter des poids et des signataires valides.',
        recovery: 'Corrigez les informations avant l’enregistrement. Les signataires sont gérés dans chaque préparation d’expédition.' });
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
      showSuccess('Expédition de fret créée', `L’expédition ${shipment.reference_number} est en attente d’approbation.`);
      navigate(`/freight/shipments/${shipment.id}`);
    } catch (reason) {
      if (reason instanceof FreightShipmentPartialSaveError) {
        showWarning('Expédition à vérifier', `${reason.reference} existe, mais certains enregistrements associés n’ont pas été confirmés. Vérifiez l’expédition existante ; n’en créez pas une autre.`);
        navigate(`/freight/shipments/${reason.shipmentId}`);
      } else setError(presentError(reason));
    }
    finally { lock.current = false; setSubmitting(false); }
  };
  return <NationalDashboardLayout><div className="sn-page logistics-workspace">
    <PageHeader title="Nouvelle expédition de fret" subtitle="Regroupez les préparations dédouanées destinées à la raffinerie." icon={Package}
      breadcrumb={[{ label: 'Expéditions', to: '/shipping/preparation' }, { label: 'Expéditions de fret', to: '/freight' }, { label: 'Nouvelle expédition' }]}
      actions={<Button type="button" variant="outline" disabled={submitting} onClick={() => navigate('/freight')}><ArrowLeft size={16} />Retour aux expéditions de fret</Button>} />
    {!canPrepare && <Note tone="danger">Une session vérifiée disposant de l’accès à la préparation du fret est obligatoire pour créer une expédition.</Note>}
    {canPrepare && loadFailed && <Note tone="danger">Impossible de charger les données des préparations. <Button type="button" variant="outline" onClick={() => void load()}>Recharger les données</Button></Note>}
    {canPrepare && !loading && !loadFailed && !shipments.length && <Note tone="info">Aucune préparation admissible n’est disponible. Les préparations doivent être prêtes pour l’expédition et leurs lots ne doivent pas être déjà affectés à un fret.</Note>}
    <form onSubmit={submit}><div className="logistics-form-grid"><fieldset className="logistics-form-main" disabled={!canPrepare || loading || loadFailed || submitting}>
      <Section id="freight-selection" title="Sélectionner les préparations d’expédition" description="Recherchez et sélectionnez les préparations autorisées. Chaque lot de production est inclus une seule fois." icon={Package}>
        <Field label="Rechercher une préparation"><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Référence ou société minière…" /></Field>
        <div className="my-4 flex gap-3"><Button type="button" variant="outline" onClick={() => selectIds(shipments.filter(row => `${row.expedition_lot_number} ${companyName(row)}`.toLowerCase().includes(search.toLowerCase())).map(row => row.id))}>Sélectionner les résultats</Button><Button type="button" variant="outline" onClick={() => selectIds([])}>Effacer la sélection</Button></div>
        <div className="overflow-x-auto"><table className="sn-table"><caption className="sr-only">Préparations disponibles</caption><thead><tr><th>Sélection</th><th>Préparation</th><th>Société</th><th>Poids brut (g)</th><th>Or fin (g)</th><th>Lots</th></tr></thead><tbody>
          {shipments.filter(row => `${row.expedition_lot_number} ${companyName(row)}`.toLowerCase().includes(search.toLowerCase())).map(row => <tr key={row.id}>
            <td><input type="checkbox" aria-label={`Sélectionner ${row.expedition_lot_number}`} checked={selectedIds.includes(row.id)} onChange={e => selectIds(e.target.checked ? [...selectedIds, row.id] : selectedIds.filter(id => id !== row.id))} /></td>
            <td>{row.expedition_lot_number}</td><td>{companyName(row)}</td><td>{logisticsNumber(row.total_gross_weight_grams)}</td><td>{logisticsNumber(row.total_net_weight_grams)}</td><td>{row.items.length}</td></tr>)}
          {loading && <tr><td colSpan={6}>Chargement des préparations…</td></tr>}
        </tbody></table></div>
      </Section>
      <Section id="freight-destination" title="Destination et conditionnement" icon={Building2}><div className="logistics-fields">
        <Field label="Date d’expédition" required><input type="date" value={date} onChange={e => setDate(e.target.value)} required /></Field>
        <Field label="Raffinerie de destination" required><select value={refineryId} onChange={e => setRefineryId(e.target.value)} required><option value="">Sélectionnez une raffinerie</option>{refineries.map(row => <option key={row.id} value={row.id}>{row.name} · {row.country}</option>)}</select></Field>
        <Field label="Nombre de colis" required><input type="number" min="1" step="1" value={boxes} onChange={e => setBoxes(e.target.value)} required /></Field>
        <Field label="Type de conditionnement" required><input value={boxType} onChange={e => setBoxType(e.target.value)} maxLength={100} required /></Field>
      </div><div className="mt-4"><Note tone="info">Les transporteurs sont consignés dans chaque préparation. Les lettres de transport aérien, le dédouanement et les preuves de départ sont enregistrés dans le dossier douanier.</Note></div></Section>
      <Section id="freight-valuation" title="Valeur déclarée" description="Le prix est exprimé par once troy. Le taux de change correspond aux XOF pour 1 USD." icon={Scale}><div className="logistics-fields">
        <Field label="Cours de l’or (USD / oz)" required><input type="number" min="0.000001" step="any" value={price} onChange={e => setPrice(e.target.value)} required /></Field>
        <Field label="Taux de change (USD → XOF)" required><input type="number" min="0.000001" step="any" value={rate} onChange={e => setRate(e.target.value)} required /></Field>
      </div></Section>
      <Section id="freight-signatories" title="Signataires autorisés" description="Chargés depuis les préparations sélectionnées ; les noms ne sont ni déduits ni générés." icon={ShieldCheck}>
        {signatoriesLoading ? <p>Chargement des signataires…</p> : signatoriesFailed ? <Note tone="danger">Impossible de charger les signataires. Sélectionnez de nouveau les préparations pour réessayer.</Note> :
          signatories.length ? <ul className="logistics-checklist">{signatories.map((row, index) => <li key={index}>{row.full_name} · {row.position}</li>)}</ul> :
            <p>Aucun signataire sélectionné. Ajoutez les signataires à la préparation source avant de poursuivre.</p>}
      </Section>
      <Section id="freight-notes" title="Instructions et observations" icon={FileText}><Field label="Notes"><textarea rows={4} maxLength={5000} value={notes} onChange={e => setNotes(e.target.value)} /></Field></Section>
    </fieldset><Card title="Synthèse de l’expédition" className="logistics-summary"><dl>
      <dt>Préparations</dt><dd>{selected.length}</dd><dt>Lots de production</dt><dd>{selected.reduce((sum, row) => sum + row.items.length, 0)}</dd>
      <dt>Poids brut</dt><dd>{logisticsNumber(gross)} g</dd><dt>Poids d’or fin</dt><dd>{logisticsNumber(fine)} g</dd><dt>Onces troy</dt><dd>{logisticsNumber(ounces, 6)} oz</dd>
      <dt>Valeur déclarée</dt><dd>{logisticsNumber(price ? ounces * Number(price) : null)} USD</dd><dt>Valeur locale</dt><dd>{logisticsNumber(price && rate ? ounces * Number(price) * Number(rate) : null)} XOF</dd>
    </dl><p className="mt-5 text-sm text-slate-500">La référence est attribuée par le serveur. Le statut initial est « En attente » ; le départ nécessite une autorisation distincte.</p></Card></div>
    <FormActions><Button type="button" variant="outline" disabled={submitting} onClick={() => navigate('/freight')}>Annuler</Button><Button type="submit" disabled={submitting || loading || loadFailed || !selected.length || signatoriesLoading || signatoriesFailed}><Save size={16} />{submitting ? 'Création de l’expédition…' : 'Créer l’expédition de fret'}</Button></FormActions></form>
    <ActionErrorDialog isOpen={Boolean(error)} onClose={() => setError(null)} title={error?.title} message={error?.message || ''} recovery={error?.recovery} diagnosticCode={error?.code}
      onAction={loadFailed ? () => { setError(null); void load(); } : undefined} actionLabel="Recharger les données" />
  </div></NationalDashboardLayout>;
}
