import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Package, ArrowLeft, Save, Building2, Truck, FileText
} from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { PageHeader, Section, Field, FormActions, Note } from '@/components/ui/sn';
import '@/components/shipping/logistics-workspace.css';
import { Button } from '@/components/ui/Button';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { ShippingStatusBadge } from '@/components/shipping/ShippingStatusBadge';
import { shippingPreparationService, type ShippingPreparation } from '@/services/shippingPreparationService';
import { supabase } from '@/lib/supabase';
import { shippingPreparationDetailsPath } from '@/lib/shippingRoutes';

interface Refinery {
  id: string;
  name: string;
}

interface FreightCompany {
  id: string;
  name: string;
}

export default function ShippingPreparationEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preparation, setPreparation] = useState<ShippingPreparation | null>(null);
  const [refineries, setRefineries] = useState<Refinery[]>([]);
  const [freightCompanies, setFreightCompanies] = useState<FreightCompany[]>([]);

  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const saveLock = useRef(false);

  // Form fields
  const [expeditionLotNumber, setExpeditionLotNumber] = useState('');
  const [sealNumber, setSealNumber] = useState('');
  const [selectedRefineryId, setSelectedRefineryId] = useState('');
  const [selectedFreightCompanyId, setSelectedFreightCompanyId] = useState('');
  const [shippedToCountry, setShippedToCountry] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setLoadFailed(false);

      // Load preparation
      const prep = await shippingPreparationService.getPreparationById(id!);
      if (!prep) {
        setErrorMessage('Preparation not found.');
        setShowError(true);
        return;
      }

      setPreparation(prep);
      setExpeditionLotNumber(prep.expedition_lot_number || '');
      setSealNumber(prep.seal_number || '');
      setSelectedRefineryId(prep.refinery_id || '');
      setSelectedFreightCompanyId(prep.freight_company_id || '');
      setShippedToCountry(prep.shipped_to_country || '');
      setNotes(prep.notes || '');

      // Load refineries
      const { data: refineriesData, error: refineryError } = await supabase
        .from('refineries')
        .select('id, name')
        .order('name');
      if (refineryError) throw refineryError;
      if (refineriesData) setRefineries(refineriesData);

      // Load freight companies
      const { data: freightData, error: freightError } = await supabase
        .from('transport_companies')
        .select('id, name')
        .order('name');
      if (freightError) throw freightError;
      if (freightData) setFreightCompanies(freightData);

    } catch (error) {
      setLoadFailed(true);
      console.error('Error loading data:', error);
      setErrorMessage('Reference data could not be loaded. Reload before saving.');
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saveLock.current || loading || loadFailed || !preparation) return;

    // Validation
    if (!expeditionLotNumber.trim()) {
      setErrorMessage('A valid shipment reference is required.');
      setShowError(true);
      return;
    }

    try {
      saveLock.current = true;
      setSaving(true);

      const updates = {
        seal_number: sealNumber.trim() || null,
        refinery_id: selectedRefineryId || null,
        freight_company_id: selectedFreightCompanyId || null,
        shipped_to_country: shippedToCountry.trim() || null,
        notes: notes.trim() || null,
      };

      await shippingPreparationService.updatePreparation(id!, updates);

      setShowSuccess(true);


    } catch (error: any) {
      console.error('Error updating preparation:', error);
      setErrorMessage('Unable to save the changes: ' + (error.message || 'No confirmation received'));
      setShowError(true);
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  return <NationalDashboardLayout><div className="sn-page logistics-workspace">
    <PageHeader title="Edit shipment preparation" subtitle="Update the destination, carrier and general information. The original reference is preserved." icon={Package}
      breadcrumb={[{ label: 'Mine industrielle' }, { label: 'Gestion des expéditions', to: '/shipping/preparation' }, { label: expeditionLotNumber || 'Preparation', to: id ? shippingPreparationDetailsPath(id) : '/shipping/preparation' }, { label: 'Edit' }]}
      actions={<Button type="button" variant="outline" disabled={saving} onClick={() => navigate(id ? shippingPreparationDetailsPath(id) : '/shipping/preparation')}><ArrowLeft size={16} />Back</Button>} />
    {loading ? <Note tone="info">Loading preparation…</Note> : !preparation ? <Note tone="danger">This preparation could not be opened.</Note> :
      <form onSubmit={handleSubmit} className="logistics-form-main">
        {loadFailed && <Note tone="danger">Reference data is unavailable. <Button type="button" variant="outline" onClick={() => void loadData()}>Reload</Button></Note>}
        <fieldset disabled={saving || loadFailed || showSuccess} className="logistics-form-main">
          <Section id="edit-shipment-identity" title="Preparation identity" icon={Package}><div className="logistics-field-grid">
            <Field label="Shipment reference" hint="Assigned by the numbering service; cannot be edited here."><input value={expeditionLotNumber} readOnly /></Field>
            <Field label="Seal number"><input value={sealNumber} onChange={e => setSealNumber(e.target.value)} /></Field>
          </div><div className="mt-4 flex flex-wrap items-center gap-3"><ShippingStatusBadge status={preparation.status || 'waiting_for_customs_approval'} /><span className="text-sm text-slate-500">Status changes are only available through the shipment workflow.</span></div></Section>
          <Section id="edit-shipment-destination" title="Destination" icon={Building2}><div className="logistics-field-grid">
            <Field label="Destination refinery"><select value={selectedRefineryId} onChange={e => setSelectedRefineryId(e.target.value)}><option value="">Select a refinery</option>{refineries.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
            <Field label="Destination country"><input value={shippedToCountry} onChange={e => setShippedToCountry(e.target.value)} placeholder="e.g. South Africa" /></Field>
          </div></Section>
          <Section id="edit-shipment-carrier" title="Carrier" icon={Truck}><Field label="Freight company"><select value={selectedFreightCompanyId} onChange={e => setSelectedFreightCompanyId(e.target.value)}><option value="">Select a carrier</option>{freightCompanies.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field></Section>
          <Section id="edit-shipment-notes" title="Notes" icon={FileText}><Field label="Instructions & observations"><textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)} maxLength={5000} /></Field></Section>
        </fieldset>
        <Note tone="info">Production lots, signatories and supporting documents are managed from the preparation detail page.</Note>
        {showSuccess ? <Note tone="success">Changes saved. <Button type="button" variant="outline" onClick={() => navigate(shippingPreparationDetailsPath(id!))}>Open preparation</Button></Note> :
          <FormActions><Button type="button" variant="outline" disabled={saving} onClick={() => navigate(shippingPreparationDetailsPath(id!))}>Cancel</Button><Button type="submit" disabled={saving || loadFailed}><Save size={16} />{saving ? 'Saving…' : 'Save changes'}</Button></FormActions>}
      </form>}
    <ErrorDialog isOpen={showError} onClose={() => setShowError(false)} title="Preparation unavailable" message={errorMessage} />
  </div></NationalDashboardLayout>;
}
