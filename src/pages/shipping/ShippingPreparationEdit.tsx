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
import { messageErreurUtilisateur } from '@/lib/presentError';
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
        setErrorMessage('Préparation introuvable.');
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
      console.error('Erreur lors du chargement des données :', error);
      setErrorMessage('Les données de référence n’ont pas pu être chargées. Rechargez-les avant d’enregistrer.');
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
      setErrorMessage('Une référence d’expédition valide est obligatoire.');
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


    } catch (error) {
      console.error('Erreur lors de la mise à jour de la préparation :', error);
      setErrorMessage(messageErreurUtilisateur(error, 'Impossible d’enregistrer les modifications.'));
      setShowError(true);
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  return <NationalDashboardLayout><div className="sn-page logistics-workspace">
    <PageHeader title="Modifier la préparation d’expédition" subtitle="Mettez à jour la destination, le transporteur et les informations générales. La référence d’origine est conservée." icon={Package}
      breadcrumb={[{ label: 'Mine industrielle' }, { label: 'Gestion des expéditions', to: '/shipping/preparation' }, { label: expeditionLotNumber || 'Préparation', to: id ? shippingPreparationDetailsPath(id) : '/shipping/preparation' }, { label: 'Modifier' }]}
      actions={<Button type="button" variant="outline" disabled={saving} onClick={() => navigate(id ? shippingPreparationDetailsPath(id) : '/shipping/preparation')}><ArrowLeft size={16} />Retour</Button>} />
    {loading ? <Note tone="info">Chargement de la préparation…</Note> : !preparation ? <Note tone="danger">Impossible d’ouvrir cette préparation.</Note> :
      <form onSubmit={handleSubmit} className="logistics-form-main">
        {loadFailed && <Note tone="danger">Les données de référence sont indisponibles. <Button type="button" variant="outline" onClick={() => void loadData()}>Recharger</Button></Note>}
        <fieldset disabled={saving || loadFailed || showSuccess} className="logistics-form-main">
          <Section id="edit-shipment-identity" title="Identification de la préparation" icon={Package}><div className="logistics-field-grid">
            <Field label="Référence d’expédition" hint="Attribuée par le service de numérotation ; elle ne peut pas être modifiée ici."><input value={expeditionLotNumber} readOnly /></Field>
            <Field label="Numéro de scellé"><input value={sealNumber} onChange={e => setSealNumber(e.target.value)} /></Field>
          </div><div className="mt-4 flex flex-wrap items-center gap-3"><ShippingStatusBadge status={preparation.status || 'waiting_for_customs_approval'} /><span className="text-sm text-slate-500">Les changements de statut s’effectuent uniquement depuis le circuit de l’expédition.</span></div></Section>
          <Section id="edit-shipment-destination" title="Destination" icon={Building2}><div className="logistics-field-grid">
            <Field label="Raffinerie de destination"><select value={selectedRefineryId} onChange={e => setSelectedRefineryId(e.target.value)}><option value="">Sélectionnez une raffinerie</option>{refineries.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
            <Field label="Pays de destination"><input value={shippedToCountry} onChange={e => setShippedToCountry(e.target.value)} placeholder="Ex. : Afrique du Sud" /></Field>
          </div></Section>
          <Section id="edit-shipment-carrier" title="Transporteur" icon={Truck}><Field label="Société de transport"><select value={selectedFreightCompanyId} onChange={e => setSelectedFreightCompanyId(e.target.value)}><option value="">Sélectionnez un transporteur</option>{freightCompanies.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field></Section>
          <Section id="edit-shipment-notes" title="Notes" icon={FileText}><Field label="Instructions et observations"><textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)} maxLength={5000} /></Field></Section>
        </fieldset>
        <Note tone="info">Les lots de production, les signataires et les pièces justificatives sont gérés depuis le détail de la préparation.</Note>
        {showSuccess ? <Note tone="success">Modifications enregistrées. <Button type="button" variant="outline" onClick={() => navigate(shippingPreparationDetailsPath(id!))}>Ouvrir la préparation</Button></Note> :
          <FormActions><Button type="button" variant="outline" disabled={saving} onClick={() => navigate(shippingPreparationDetailsPath(id!))}>Annuler</Button><Button type="submit" disabled={saving || loadFailed}><Save size={16} />{saving ? 'Enregistrement…' : 'Enregistrer les modifications'}</Button></FormActions>}
      </form>}
    <ErrorDialog isOpen={showError} onClose={() => setShowError(false)} title="Préparation indisponible" message={errorMessage} />
  </div></NationalDashboardLayout>;
}
