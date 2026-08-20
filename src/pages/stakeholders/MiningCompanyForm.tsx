import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useNotification } from '@/contexts/NotificationContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { FormField } from '@/components/ui/FormField';
import { Factory, ArrowLeft, Save, Plus, Trash2, FileText, Download, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { navigateWithAutoRefresh } from '@/hooks/useAutoRefresh';
import { BURKINA_REGIONS } from '@/data/burkinaRegions';
import { BURKINA_PROVINCES } from '@/data/burkinaProvinces';
import {
  miningCompanyDocumentService,
  MINING_COMPANY_DOC_TYPES,
  type MiningCompanyDocument,
} from '@/services/miningCompanyDocumentService';
import { MiningCompanyFormGuide } from '@/components/stakeholders/MiningCompanyFormGuide';

// Les sociétés minières inscrites exploitent au Burkina Faso ; les pays
// voisins ne servent qu'aux sociétés mères et aux partenaires.
const COUNTRIES = ['Burkina Faso', 'Mali', 'Niger', "Côte d'Ivoire", 'Ghana', 'Sénégal', 'France', 'Canada', 'Australie'];
const CURRENCIES = ['XOF', 'USD', 'EUR', 'GHS', 'AED', 'ZAR'];

const COMPANY_TYPES = [
  { value: 'production_mine', label: 'Mine de production' },
  { value: 'parent_company', label: 'Société mère / Groupe' },
  { value: 'institution', label: 'Institution' },
];


interface BankAccount {
  id?: string;
  account_name: string;
  bank_name: string;
  bank_country: string;
  account_number: string;
  account_currency: string;
  swift_code: string;
  is_primary: boolean;
}

interface CompanyForm {
  name: string;
  abbreviation: string;
  code: string;
  company_type: string;
  registration_number: string;
  tax_id: string;
  country: string;
  region: string;
  province: string;
  localite: string;
  address: string;
  city: string;
  postal_code: string;
  contact_person_name: string;
  contact_person_email: string;
  contact_person_phone: string;
  website: string;
  default_currency: string;
  notes: string;
}

const EMPTY_FORM: CompanyForm = {
  name: '', abbreviation: '', code: '', company_type: 'production_mine',
  registration_number: '', tax_id: '',
  country: 'Burkina Faso', region: '', province: '', localite: '', address: '', city: '', postal_code: '',
  contact_person_name: '', contact_person_email: '', contact_person_phone: '', website: '',
  default_currency: 'XOF', notes: '',
};

export function MiningCompanyForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const { showError } = useNotification();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CompanyForm>(EMPTY_FORM);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [documents, setDocuments] = useState<MiningCompanyDocument[]>([]);
  const [pendingDocs, setPendingDocs] = useState<{ file: File; docType: string }[]>([]);
  const [docType, setDocType] = useState<string>('rccm');

  const isBurkina = formData.country === 'Burkina Faso';
  const provincesForRegion = BURKINA_PROVINCES.filter((p) => p.region === formData.region);

  useEffect(() => {
    if (isEdit) {
      loadCompany();
      loadBankAccounts();
      loadDocuments();
    }
  }, [id]);

  const loadCompany = async () => {
    try {
      const { data, error } = await supabase.from('mining_companies').select('*').eq('id', id).single();
      if (error) throw error;
      if (data) {
        setFormData({
          name: data.name ?? '',
          abbreviation: data.abbreviation ?? '',
          code: data.code ?? '',
          company_type: data.company_type ?? 'production_mine',
          registration_number: data.registration_number ?? '',
          tax_id: data.tax_id ?? '',
          country: data.country ?? 'Burkina Faso',
          region: data.region ?? '',
          province: data.province ?? '',
          localite: data.localite ?? '',
          address: data.address ?? '',
          city: data.city ?? '',
          postal_code: data.postal_code ?? '',
          contact_person_name: data.contact_person_name ?? '',
          contact_person_email: data.contact_person_email ?? '',
          contact_person_phone: data.contact_person_phone ?? '',
          website: data.website ?? '',
          default_currency: data.default_currency ?? 'XOF',
          notes: data.notes ?? '',
        });
      }
    } catch (error) {
      console.error('Error loading company:', error);
    }
  };

  const loadBankAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('stakeholder_bank_accounts')
        .select('*')
        .eq('stakeholder_type', 'mining_company')
        .eq('stakeholder_id', id);
      if (error) throw error;
      setBankAccounts(data || []);
    } catch (error) {
      console.error('Error loading bank accounts:', error);
    }
  };

  const loadDocuments = async () => {
    try {
      setDocuments(await miningCompanyDocumentService.list(id as string));
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  const set = <K extends keyof CompanyForm>(key: K, value: CompanyForm[K]) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const addBankAccount = () =>
    setBankAccounts([...bankAccounts, {
      account_name: '', bank_name: '', bank_country: formData.country, account_number: '',
      account_currency: formData.default_currency, swift_code: '', is_primary: bankAccounts.length === 0,
    }]);
  const removeBankAccount = (index: number) => setBankAccounts(bankAccounts.filter((_, i) => i !== index));
  const updateBankAccount = (index: number, field: string, value: any) => {
    const updated = [...bankAccounts];
    updated[index] = { ...updated[index], [field]: value };
    setBankAccounts(updated);
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (isEdit) {
      miningCompanyDocumentService
        .upload(id as string, file, docType)
        .then(loadDocuments)
        .catch((err) => showError('Document', err.message || 'Échec du téléversement du document.'));
    } else {
      setPendingDocs((prev) => [...prev, { file, docType }]);
    }
    e.target.value = '';
  };

  const openDocument = async (doc: MiningCompanyDocument) => {
    const url = await miningCompanyDocumentService.getSignedUrl(doc.file_path);
    if (url) window.open(url, '_blank');
  };

  const deleteDocument = async (doc: MiningCompanyDocument) => {
    try {
      await miningCompanyDocumentService.remove(doc);
      loadDocuments();
    } catch (err: any) {
      showError('Document', err.message || 'Échec de la suppression.');
    }
  };

  const docTypeLabel = (value: string | null) =>
    MINING_COMPANY_DOC_TYPES.find((t) => t.value === value)?.label ?? 'Document';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const payload = {
        ...formData,
        // La localisation détaillée n'a de sens que pour le Burkina Faso.
        region: isBurkina ? formData.region || null : formData.region || null,
        province: isBurkina ? formData.province || null : formData.province || null,
      };

      let companyId = id as string | undefined;

      if (isEdit) {
        const { error } = await supabase.from('mining_companies').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { data: newCompany, error } = await supabase
          .from('mining_companies')
          .insert({ ...payload, created_by: userData.user?.id })
          .select()
          .single();
        if (error) throw error;
        companyId = newCompany.id;
      }

      // Comptes bancaires (remplacement complet)
      if (isEdit) {
        await supabase.from('stakeholder_bank_accounts').delete()
          .eq('stakeholder_type', 'mining_company').eq('stakeholder_id', id);
      }
      for (const account of bankAccounts) {
        if (account.bank_name && account.account_number) {
          await supabase.from('stakeholder_bank_accounts').insert({
            stakeholder_type: 'mining_company', stakeholder_id: companyId, ...account,
            created_by: userData.user?.id,
          });
        }
      }

      // Documents en attente (mode création)
      if (companyId && pendingDocs.length > 0) {
        for (const pending of pendingDocs) {
          try {
            await miningCompanyDocumentService.upload(companyId, pending.file, pending.docType);
          } catch (err) {
            console.error('Document upload failed:', err);
          }
        }
      }

      navigateWithAutoRefresh(navigate, '/stakeholders/mining-companies');
    } catch (error: any) {
      console.error('Error saving company:', error);
      showError('Enregistrement', error.message || 'Une erreur est survenue lors de l\'enregistrement.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate('/stakeholders/mining-companies')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Retour
          </Button>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2.5">
            <Factory className="h-5 w-5 text-emerald-700" />
            {isEdit ? 'Modifier la société minière' : 'Nouvelle société minière'}
          </h1>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* 1. Informations générales */}
              <Card>
                <CardHeader><CardTitle>Informations générales</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Nom officiel" required hint="Raison sociale enregistrée">
                      <Input value={formData.name} onChange={(e) => set('name', e.target.value)} required
                        placeholder="Ex. Société des Mines de Poura SA" />
                    </FormField>
                    <FormField label="Nom usuel" hint="Nom court, affiché dans les listes">
                      <Input value={formData.abbreviation} onChange={(e) => set('abbreviation', e.target.value)}
                        placeholder="Ex. Poura" />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Code société" required hint="Majuscules, sans espaces">
                      <Input value={formData.code} onChange={(e) => set('code', e.target.value.toUpperCase())} required
                        placeholder="POURA_BF" />
                    </FormField>
                    <FormField label="Type" required hint="Nature de l’entité">
                      <Select value={formData.company_type} onChange={(e) => set('company_type', e.target.value)}>
                        {COMPANY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </Select>
                    </FormField>
                  </div>
                </CardContent>
              </Card>

              {/* 2. Identification légale */}
              <Card>
                <CardHeader><CardTitle>Identification légale</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="RCCM" hint="Registre du Commerce et du Crédit Mobilier">
                      <Input value={formData.registration_number}
                        onChange={(e) => set('registration_number', e.target.value)} placeholder="BF-OUA-2023-B-1234" />
                    </FormField>
                    <FormField label="IFU" hint="Identifiant Financier Unique (DGI)">
                      <Input value={formData.tax_id} onChange={(e) => set('tax_id', e.target.value)}
                        placeholder="00012345A" />
                    </FormField>
                  </div>
                </CardContent>
              </Card>

              {/* 3. Localisation */}
              <Card>
                <CardHeader><CardTitle>Localisation</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Pays" required>
                      <Select value={formData.country}
                        onChange={(e) => setFormData((p) => ({ ...p, country: e.target.value, region: '', province: '' }))}>
                        {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </Select>
                    </FormField>
                    <FormField label="Région">
                      {isBurkina ? (
                        <Select value={formData.region}
                          onChange={(e) => setFormData((p) => ({ ...p, region: e.target.value, province: '' }))}>
                          <option value="">— Sélectionner —</option>
                          {BURKINA_REGIONS.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
                        </Select>
                      ) : (
                        <Input value={formData.region} onChange={(e) => set('region', e.target.value)} />
                      )}
                    </FormField>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Province">
                      {isBurkina ? (
                        <Select value={formData.province} onChange={(e) => set('province', e.target.value)}
                          disabled={!formData.region}>
                          <option value="">{formData.region ? '— Sélectionner —' : "Choisir d'abord une région"}</option>
                          {provincesForRegion.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                        </Select>
                      ) : (
                        <Input value={formData.province} onChange={(e) => set('province', e.target.value)} />
                      )}
                    </FormField>
                    <FormField label="Localité / Commune">
                      <Input value={formData.localite} onChange={(e) => set('localite', e.target.value)}
                        placeholder="Village, commune ou site" />
                    </FormField>
                  </div>
                  <FormField label="Adresse">
                    <Input value={formData.address} onChange={(e) => set('address', e.target.value)} />
                  </FormField>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Ville">
                      <Input value={formData.city} onChange={(e) => set('city', e.target.value)} />
                    </FormField>
                    <FormField label="Boîte postale / Code postal">
                      <Input value={formData.postal_code} onChange={(e) => set('postal_code', e.target.value)}
                        placeholder="01 BP 1234" />
                    </FormField>
                  </div>
                </CardContent>
              </Card>

              {/* 4. Contact */}
              <Card>
                <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <FormField label="Personne de contact" required>
                    <Input value={formData.contact_person_name}
                      onChange={(e) => set('contact_person_name', e.target.value)} required />
                  </FormField>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Email" required>
                      <Input type="email" value={formData.contact_person_email}
                        onChange={(e) => set('contact_person_email', e.target.value)} required />
                    </FormField>
                    <FormField label="Téléphone">
                      <Input value={formData.contact_person_phone}
                        onChange={(e) => set('contact_person_phone', e.target.value)} placeholder="+226 70 00 00 00" />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Site web">
                      <Input type="url" value={formData.website} onChange={(e) => set('website', e.target.value)}
                        placeholder="https://" />
                    </FormField>
                    <FormField label="Devise par défaut">
                      <Select value={formData.default_currency} onChange={(e) => set('default_currency', e.target.value)}>
                        {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </Select>
                    </FormField>
                  </div>
                </CardContent>
              </Card>

              {/* 5. Documents */}
              <Card>
                <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <FormField label="Type de document">
                      <Select value={docType} onChange={(e) => setDocType(e.target.value)}>
                        {MINING_COMPANY_DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </Select>
                    </FormField>
                    <label className="inline-flex h-[42px] cursor-pointer items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 text-sm font-medium text-emerald-700 hover:bg-emerald-100">
                      <Upload className="h-4 w-4" /> Joindre un fichier
                      <input type="file" className="hidden" onChange={onPickFile}
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
                    </label>
                  </div>

                  {/* Documents déjà enregistrés (édition) */}
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4 text-emerald-600" />
                        <span className="font-medium text-slate-700">{docTypeLabel(doc.doc_type)}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500">{doc.file_name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="ghost" size="sm" onClick={() => openDocument(doc)}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => deleteDocument(doc)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {/* Documents en attente (création) */}
                  {pendingDocs.map((pending, index) => (
                    <div key={index} className="flex items-center justify-between rounded-lg border border-dashed border-emerald-300 bg-emerald-50/40 px-3 py-2">
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4 text-emerald-600" />
                        <span className="font-medium text-slate-700">{docTypeLabel(pending.docType)}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500">{pending.file.name}</span>
                        <span className="text-xs text-emerald-600">(à téléverser)</span>
                      </div>
                      <Button type="button" variant="ghost" size="sm"
                        onClick={() => setPendingDocs((p) => p.filter((_, i) => i !== index))}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  ))}

                  {documents.length === 0 && pendingDocs.length === 0 && (
                    <p className="py-3 text-center text-sm text-slate-400">Aucun document joint pour le moment</p>
                  )}
                </CardContent>
              </Card>

              {/* 6. Comptes bancaires */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Comptes bancaires</CardTitle>
                    <Button type="button" variant="outline" size="sm" onClick={addBankAccount}>
                      <Plus className="w-4 h-4 mr-2" /> Ajouter un compte
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {bankAccounts.map((account, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Compte {index + 1}</span>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeBankAccount(index)}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField label="Intitulé du compte">
                          <Input value={account.account_name} onChange={(e) => updateBankAccount(index, 'account_name', e.target.value)} />
                        </FormField>
                        <FormField label="Banque">
                          <Input value={account.bank_name} onChange={(e) => updateBankAccount(index, 'bank_name', e.target.value)} />
                        </FormField>
                        <FormField label="Pays de la banque">
                          <Select value={account.bank_country} onChange={(e) => updateBankAccount(index, 'bank_country', e.target.value)}>
                            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </Select>
                        </FormField>
                        <FormField label="Numéro de compte / IBAN">
                          <Input value={account.account_number} onChange={(e) => updateBankAccount(index, 'account_number', e.target.value)} />
                        </FormField>
                        <FormField label="Devise">
                          <Select value={account.account_currency} onChange={(e) => updateBankAccount(index, 'account_currency', e.target.value)}>
                            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </Select>
                        </FormField>
                        <FormField label="Code SWIFT/BIC">
                          <Input value={account.swift_code} onChange={(e) => updateBankAccount(index, 'swift_code', e.target.value)} />
                        </FormField>
                      </div>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={account.is_primary}
                          onChange={(e) => updateBankAccount(index, 'is_primary', e.target.checked)}
                          className="rounded border-gray-300 accent-emerald-600" />
                        <span className="text-sm text-gray-700">Compte principal</span>
                      </label>
                    </div>
                  ))}
                  {bankAccounts.length === 0 && (
                    <div className="text-center py-6 text-gray-500">
                      <p>Aucun compte bancaire ajouté</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 7. Notes */}
              <Card>
                <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
                <CardContent>
                  <FormField label="Notes internes">
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      rows={4} value={formData.notes} onChange={(e) => set('notes', e.target.value)}
                      placeholder="Observations, remarques…" />
                  </FormField>
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button type="submit" disabled={loading}>
                  <Save className="w-4 h-4 mr-2" />
                  {loading ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Créer la société'}
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate('/stakeholders/mining-companies')}>
                  Annuler
                </Button>
              </div>
            </form>
          </div>
          <div className="lg:col-span-1">
            <MiningCompanyFormGuide />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
