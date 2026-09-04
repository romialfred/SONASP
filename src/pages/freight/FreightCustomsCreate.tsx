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
        ? `Opération douanière ${operation.reference_number} créée.`
        : `L’opération ${operation.reference_number} existe, mais sa note n’a pas pu être enregistrée. Vérifiez le dossier avant de réessayer.`);
      navigate(`/freight-customs/${operation.id}`);
    } catch (reason) { setError(presentError(reason)); }
    finally { lock.current = false; setSubmitting(false); }
  };
  return <NationalDashboardLayout><div className="sn-page logistics-workspace">
    <PageHeader title="Nouvelle opération douanière" subtitle="Ouvrez un dossier douanier pour une préparation d’expédition admissible." icon={ShieldCheck}
      breadcrumb={[{ label: 'Expéditions', to: '/shipping/preparation' }, { label: 'Douane et consignation', to: '/freight-customs' }, { label: 'Nouvelle opération' }]}
      actions={<Button type="button" variant="outline" disabled={submitting} onClick={() => navigate('/freight-customs')}><ArrowLeft size={16} />Retour aux opérations</Button>} />
    {!canPrepare ? <Section id="customs-denied" title="Création non autorisée" icon={ShieldCheck}><Note tone="danger">Une session vérifiée disposant de l’accès à la préparation du fret est obligatoire.</Note></Section> :
      <form onSubmit={submit} className="logistics-form-main">
        {loadFailed ? <Note tone="danger">Impossible de charger les expéditions admissibles. Réessayez avant de créer une opération.</Note> :
          !loading && !shipments.length && <Note tone="info">Aucune expédition admissible n’est disponible. Une préparation doit être prête pour l’expédition et ne pas déjà posséder d’opération douanière.</Note>}
        <div className="logistics-form-grid"><div className="logistics-form-main">
          <Section id="customs-shipment" title="Sélectionner l’expédition" description="Seules les expéditions prêtes relevant de votre périmètre autorisé sont proposées." icon={Package}>
            <Field label="Préparation d’expédition" required><select required value={selectedId} onChange={e => setSelectedId(e.target.value)} disabled={loading || submitting || loadFailed || !shipments.length}>
              <option value="">{loading ? 'Chargement des expéditions admissibles…' : 'Sélectionnez une expédition'}</option>
              {shipments.map(row => <option key={row.id} value={row.id}>{row.reference_number} · {row.mining_companies?.name} · {logisticsNumber(row.total_weight_grams)} g</option>)}
            </select></Field>
            {loadFailed && <Button type="button" className="mt-4" variant="outline" onClick={() => void load()}>Recharger les expéditions</Button>}
          </Section>
          <Section id="customs-notes" title="Instructions et observations" description="Ajoutez les informations nécessaires à la préparation de ce dossier douanier." icon={FileText}>
            <Field label="Notes" hint="Facultatif. Les pièces justificatives pourront être ajoutées après la création."><textarea rows={5} maxLength={5000} value={notes} disabled={submitting} onChange={e => setNotes(e.target.value)} placeholder="Instructions ou observations relatives à cette opération douanière…" /></Field>
          </Section>
          <Section id="customs-process" title="Étapes suivantes" icon={ShieldCheck}>
            <ol className="logistics-checklist"><li><CheckCircle />Préparation sélectionnée</li><li><Circle />Documents et approbation douanière</li><li><Circle />Organisation du transport et lettre de transport aérien</li><li><Circle />Expédition autorisée vers la raffinerie</li></ol>
          </Section>
        </div><Card title="Synthèse de l’expédition" className="logistics-summary"><dl>
          <dt>Référence</dt><dd>{selected?.reference_number || '—'}</dd><dt>Société</dt><dd>{selected?.mining_companies?.name || '—'}</dd>
          <dt>Préparée le</dt><dd>{logisticsDate(selected?.shipment_date)}</dd><dt>Poids d’or fin</dt><dd>{logisticsNumber(selected?.total_weight_grams)} g</dd>
          <dt>Onces troy</dt><dd>{logisticsNumber(selected?.total_weight_oz)} oz</dd><dt>Statut initial</dt><dd>En attente d’approbation douanière</dd>
        </dl><p className="mt-6 text-xs text-slate-500">La référence de l’opération est générée par le serveur. La création du dossier n’approuve ni ne déclenche l’expédition.</p></Card></div>
        <FormActions><Button type="button" variant="outline" disabled={submitting} onClick={() => navigate('/freight-customs')}>Annuler</Button><Button type="submit" disabled={submitting || loading || loadFailed || !selected}><Save size={16} />{submitting ? 'Création de l’opération…' : 'Créer l’opération'}</Button></FormActions>
      </form>}
    <ActionErrorDialog isOpen={Boolean(error)} onClose={() => setError(null)} title={error?.title} message={error?.message || ''} recovery={error?.recovery} diagnosticCode={error?.code}
      onAction={loadFailed ? () => { setError(null); void load(); } : undefined} actionLabel="Recharger les expéditions" />
  </div></NationalDashboardLayout>;
}
