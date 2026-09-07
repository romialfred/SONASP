import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Building2 } from 'lucide-react';
import { NationalDashboardLayout as MainLayout } from '@/components/layout/NationalDashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { FormField } from '@/components/ui/FormField';
import { Alert } from '@/components/ui/Alert';
import { Loading } from '@/components/ui/Loading';
import { loadCustomerDossier, saveCustomerDossier } from '@/services/customerDossierService';
import { messageErreurUtilisateur } from '@/lib/presentError';
import { useAlert } from '@/hooks/useAlert';
import { navigateWithAutoRefresh } from '@/hooks/useAutoRefresh';
import { BankAccountForm, type BankAccount } from '@/components/customers/BankAccountForm';
import { COUNTRIES } from '@/constants/countries';
import { CUSTOMER_COUNTRY_OPTIONS, customerCountryLabel } from '@/lib/customerCountryLabels';
import { PageHeader } from '@/components/ui/sn';
import { useArtisanUnsavedChanges, confirmArtisanLeave } from '@/hooks/useArtisanUnsavedChanges';
import { useAuth } from '@/contexts/AuthContext';
import './customers.css';

interface CustomerFormData {
  name: string;
  email: string;
  phone: string;
  country: string;
  address: string;
  contactPerson: string;
  taxId: string;
  paymentTerms: string;
  creditLimit: string;
  status: 'active' | 'inactive' | 'pending' | '';
  banks: BankAccount[];
}
const paymentTermsOptions = [
  { value: 'Net 15 days', label: 'Paiement à 15 jours' },
  { value: 'Net 30 days', label: 'Paiement à 30 jours' },
  { value: 'Net 45 days', label: 'Paiement à 45 jours' },
  { value: 'Net 60 days', label: 'Paiement à 60 jours' },
  { value: 'Immediate', label: 'Paiement immédiat' },
];
const statusOptions = [
  { value: 'active', label: 'Actif' },
  { value: 'inactive', label: 'Inactif' },
  { value: 'pending', label: 'En attente' },
];

const initialFormData: CustomerFormData = { name: '', email: '', phone: '', country: '', address: '', contactPerson: '', taxId: '', paymentTerms: 'Net 30 days', creditLimit: '500000', status: 'pending', banks: [] };

export function CustomerForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;
  const { user } = useAuth();
  const scope = JSON.stringify([user?.id, user?.organization_id, user?.mining_company_id, user?.access_role_id, user?.role, user?.organization_type, user?.is_active, user?.capabilities, user?.module_codes]);
  const [loadedKey, setLoadedKey] = useState('');
  const requestKey = `${scope}:${id ?? 'new'}`;

  const [formData, setFormData] = useState<CustomerFormData>(initialFormData);

  const [errors, setErrors] = useState<Partial<Record<keyof CustomerFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(isEditMode);
  const alert = useAlert();

  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [validationAttempt, setValidationAttempt] = useState(0);
  const [dirty, setDirty] = useState(false);
  const saving = useRef(false);
  const generation = useRef(0);
  useArtisanUnsavedChanges(dirty && !submitSuccess);
  const leave = () => { if (!dirty || confirmArtisanLeave()) navigate('/customers'); };

  useEffect(() => {
    generation.current += 1;
    let current = true;
    setSubmitSuccess(false); setErrors({}); setDirty(false); saving.current = false; setIsSubmitting(false);
    if (!id) { setFormData(initialFormData); setLoadError(''); setIsLoading(false); setLoadedKey(requestKey); return () => { generation.current += 1; }; }
    setIsLoading(true);
    setLoadError('');
    loadCustomerDossier(id).then(({ customer: data, banks }) => {
      if (!current) return;
      setFormData({ name: data.name ?? '', email: data.email ?? '', phone: data.phone ?? '', country: data.country ?? '',
        address: data.address ?? '', contactPerson: data.contact_person ?? '', taxId: data.tax_id ?? '',
        paymentTerms: data.payment_terms ?? '', creditLimit: String(data.credit_limit ?? ''),
        status: data.status ?? '', banks });
      setDirty(false);
      setLoadedKey(requestKey);
    }).catch(error => { if (current) { setLoadError(messageErreurUtilisateur(error, 'Impossible de charger le dossier et ses banques.')); setLoadedKey(requestKey); } })
      .finally(() => { if (current) setIsLoading(false); });
    return () => { current = false; generation.current += 1; };
  }, [id, requestKey, reload]);

  useEffect(() => { if (Object.keys(errors).length) document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(); }, [errors]);

  const handleChange = (field: keyof CustomerFormData, value: string) => {
    setDirty(true);
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleBanksChange = (banks: BankAccount[]) => {
    setDirty(true);
    setFormData((prev) => ({ ...prev, banks }));
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof CustomerFormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'La raison sociale est obligatoire.';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'L’adresse électronique est obligatoire.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Le format de l’adresse électronique est invalide.';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Le numéro de téléphone est obligatoire.';
    }

    if (!formData.contactPerson.trim()) {
      newErrors.contactPerson = 'La personne à contacter est obligatoire.';
    }

    if (!formData.address.trim()) {
      newErrors.address = 'L’adresse est obligatoire.';
    }

    if (!formData.country.trim()) {
      newErrors.country = 'Le pays est obligatoire.';
    }

    const creditLimit = Number(formData.creditLimit);
    if (!formData.creditLimit.trim() || !Number.isFinite(creditLimit) || creditLimit < 0) {
      newErrors.creditLimit = 'Une limite de crédit valide est obligatoire.';
    }

    if (formData.banks.some(bank => !bank.bankName.trim() || bank.bankName === '__other__' || !bank.country.trim() || !bank.city.trim() || !bank.currency.trim())) newErrors.banks = 'Complétez les champs obligatoires des comptes bancaires.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving.current || submitSuccess || loadError || isLoading || loadedKey !== requestKey) return;

    setValidationAttempt(attempt => attempt + 1);
    if (!validateForm()) {
      return;
    }

    saving.current = true;
    setIsSubmitting(true);
    const submittedGeneration = generation.current;

    try {
      const baseCustomerData = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        country: formData.country,
        address: formData.address.trim(),
        contact_person: formData.contactPerson.trim(),
        tax_id: formData.taxId.trim(),
        payment_terms: formData.paymentTerms || null,
        credit_limit: Number(formData.creditLimit),
        status: formData.status || null,
      };

      const savedId = await saveCustomerDossier(id ?? null, baseCustomerData, formData.banks);
      if (submittedGeneration !== generation.current) return;
      setDirty(false);
      // Show success message after everything is saved
      alert.success(`Client ${isEditMode ? 'mis à jour' : 'créé'} avec succès.`);

      setSubmitSuccess(true);
      navigateWithAutoRefresh(navigate, `/customers/${savedId}`);
    } catch (error) {
      if (submittedGeneration !== generation.current) return;
      saving.current = false;
      alert.error(messageErreurUtilisateur(error, 'Impossible d’enregistrer le client.'));
    } finally {
      if (submittedGeneration === generation.current) setIsSubmitting(false);
    }
  };

  if (isLoading || loadedKey !== requestKey) {
    return (
      <MainLayout>
        <Loading />
      </MainLayout>
    );
  }

  if (loadError) return <MainLayout><div className="sn-page customer-page"><PageHeader title="Dossier client indisponible" icon={Building2} />
    <Alert type="error" title="Chargement interrompu">{loadError}</Alert><div className="customer-actions"><Button onClick={() => setReload(value => value + 1)}>Réessayer</Button><Button variant="outline" onClick={leave}>Retour aux clients</Button></div>
  </div></MainLayout>;

  return (
    <MainLayout>
      <div className="sn-page customer-page">
        <PageHeader title={isEditMode ? 'Modifier le client' : 'Nouveau client'} subtitle="Identité, conditions commerciales et coordonnées bancaires." icon={Building2}
          breadcrumb={[{ label: 'Clients internationaux', to: '/customers' }, { label: isEditMode ? 'Modification du dossier' : 'Nouveau client' }]}
          actions={<Button variant="outline" onClick={leave}><ArrowLeft className="h-4 w-4" />Retour aux clients</Button>} />

        {submitSuccess && (
          <Alert type="success" title="Opération réussie">
            Client {isEditMode ? 'mis à jour' : 'créé'} avec succès. Redirection en cours…
          </Alert>
        )}

        <div className="customer-form-grid">
          <div className="min-w-0">
            <form onSubmit={handleSubmit} noValidate aria-label="Dossier client">
              <fieldset disabled={isSubmitting || submitSuccess} className="min-w-0">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Informations sur le client</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField htmlFor="customer-name" label="Raison sociale" required error={errors.name}>
                  <Input id="customer-name" aria-invalid={!!errors.name} aria-describedby={errors.name ? "customer-name-error" : undefined}                     value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    error={!!errors.name}
                    placeholder="Saisissez la raison sociale"
                  />

                  {errors.name && <span id="customer-name-error" className="sr-only">{errors.name}</span>}
                </FormField>

                <FormField htmlFor="customer-email" label="Adresse électronique" required error={errors.email}>
                  <Input id="customer-email" aria-invalid={!!errors.email} aria-describedby={errors.email ? "customer-email-error" : undefined}                     type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    error={!!errors.email}
                    placeholder="company@example.com"
                  />

                  {errors.email && <span id="customer-email-error" className="sr-only">{errors.email}</span>}
                </FormField>

                <FormField htmlFor="customer-phone" label="Numéro de téléphone" required error={errors.phone}>
                  <Input id="customer-phone" aria-invalid={!!errors.phone} aria-describedby={errors.phone ? "customer-phone-error" : undefined}                     value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    error={!!errors.phone}
                    placeholder="+XX XXX XXX XXXX"
                  />

                  {errors.phone && <span id="customer-phone-error" className="sr-only">{errors.phone}</span>}
                </FormField>

                <FormField htmlFor="customer-contactPerson" label="Personne à contacter" required error={errors.contactPerson}>
                  <Input id="customer-contactPerson" aria-invalid={!!errors.contactPerson} aria-describedby={errors.contactPerson ? "customer-contactPerson-error" : undefined}                     value={formData.contactPerson}
                    onChange={(e) => handleChange('contactPerson', e.target.value)}
                    error={!!errors.contactPerson}
                    placeholder="Nom de la personne à contacter"
                  />

                  {errors.contactPerson && <span id="customer-contactPerson-error" className="sr-only">{errors.contactPerson}</span>}
                </FormField>

                <FormField htmlFor="customer-country" label="Pays" required error={errors.country}>
                  <Select id="customer-country" aria-invalid={!!errors.country} aria-describedby={errors.country ? "customer-country-error" : undefined}                     value={formData.country}
                    onChange={(e) => handleChange('country', e.target.value)}
                  >
                    <option value="">Sélectionnez un pays</option>
                    {formData.country && !COUNTRIES.includes(formData.country) && <option value={formData.country}>{formData.country} (valeur enregistrée)</option>}
                    {CUSTOMER_COUNTRY_OPTIONS.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>

                  {errors.country && <span id="customer-country-error" className="sr-only">{errors.country}</span>}
                </FormField>

                <FormField htmlFor="customer-taxId" label="Identifiant fiscal / numéro d’immatriculation">
                  <Input id="customer-taxId" aria-invalid={!!errors.taxId} aria-describedby={errors.taxId ? "customer-taxId-error" : undefined}                     value={formData.taxId}
                    onChange={(e) => handleChange('taxId', e.target.value)}
                    placeholder="Identifiant fiscal"
                  />

                  {errors.taxId && <span id="customer-taxId-error" className="sr-only">{errors.taxId}</span>}
                </FormField>

                <FormField htmlFor="customer-address" label="Adresse" required error={errors.address} className="md:col-span-2">
                  <Input id="customer-address" aria-invalid={!!errors.address} aria-describedby={errors.address ? "customer-address-error" : undefined}                     value={formData.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    error={!!errors.address}
                    placeholder="Adresse complète"
                  />

                  {errors.address && <span id="customer-address-error" className="sr-only">{errors.address}</span>}
                </FormField>

                <FormField htmlFor="customer-paymentTerms" label="Conditions de paiement">
                  <Select id="customer-paymentTerms" aria-invalid={!!errors.paymentTerms} aria-describedby={errors.paymentTerms ? "customer-paymentTerms-error" : undefined}                     value={formData.paymentTerms}
                    onChange={(e) => handleChange('paymentTerms', e.target.value)}
                  >
                    {!paymentTermsOptions.some(term => term.value === formData.paymentTerms) && <option value={formData.paymentTerms}>{formData.paymentTerms || 'Non renseignées'}{formData.paymentTerms ? ' (valeur enregistrée)' : ''}</option>}
                    {paymentTermsOptions.map((term) => (
                      <option key={term.value} value={term.value}>
                        {term.label}
                      </option>
                    ))}
                  </Select>

                  {errors.paymentTerms && <span id="customer-paymentTerms-error" className="sr-only">{errors.paymentTerms}</span>}
                </FormField>

                <FormField htmlFor="customer-creditLimit" label="Limite de crédit (USD)" required error={errors.creditLimit}>
                  <Input id="customer-creditLimit" aria-invalid={!!errors.creditLimit} aria-describedby={errors.creditLimit ? "customer-creditLimit-error" : undefined}                     type="number" step="any"
                    value={formData.creditLimit}
                    onChange={(e) => handleChange('creditLimit', e.target.value)}
                    error={!!errors.creditLimit}
                    placeholder="0"
                    min="0"
                  />

                  {errors.creditLimit && <span id="customer-creditLimit-error" className="sr-only">{errors.creditLimit}</span>}
                </FormField>

                <FormField htmlFor="customer-status" label="Statut">
                  <Select id="customer-status" aria-invalid={!!errors.status} aria-describedby={errors.status ? "customer-status-error" : undefined}                     value={formData.status}
                    onChange={(e) => handleChange('status', e.target.value as typeof formData.status)}
                  >
                    {formData.status === '' && <option value="">Non renseigné</option>}
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>

                  {errors.status && <span id="customer-status-error" className="sr-only">{errors.status}</span>}
                </FormField>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Coordonnées bancaires</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <BankAccountForm
                      banks={formData.banks}
                      onChange={handleBanksChange}
                      validate={!!errors.banks}
                      validationAttempt={validationAttempt}
                    />
                  </CardContent>
                </Card>

                <div className="flex justify-end gap-4">
                  <Button type="button" variant="outline" onClick={leave}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={isSubmitting || submitSuccess}>
                    {isSubmitting ? (
                      'Enregistrement…'
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        {isEditMode ? 'Mettre à jour le client' : 'Créer le client'}
                      </>
                    )}
                  </Button>
                </div>
              </div>
              </fieldset>
            </form>
          </div>

          <aside className="customer-form-aside">
            <Card><CardHeader><CardTitle>Le dossier en bref</CardTitle></CardHeader><CardContent>
              <p className="font-semibold break-words">{formData.name.trim() || 'Nouveau client'}</p>
              <dl className="customer-facts"><div><dt>Pays</dt><dd>{customerCountryLabel(formData.country) || 'À renseigner'}</dd></div>
              <div><dt>Comptes bancaires</dt><dd>{formData.banks.length}</dd></div>
              <div><dt>Enregistrement</dt><dd>{dirty ? 'Modifications en cours' : 'Aucune modification en cours'}</dd></div></dl>
            </CardContent></Card>
            <Card><CardHeader><CardTitle>Informations utiles</CardTitle></CardHeader><CardContent>
              <p className="text-sm text-gray-600">Les champs marqués d’un astérisque sont obligatoires. Le statut « En attente » est proposé à la création et reste modifiable.</p>
              <p className="text-sm text-gray-600 mt-3">Vous pouvez associer plusieurs banques et définir un compte principal. Une banque retirée du dossier reste conservée dans l’historique des paiements.</p>
            </CardContent></Card>
          </aside>
        </div>
      </div>
    </MainLayout>
  );
}
