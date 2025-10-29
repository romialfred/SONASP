import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useNotification } from '@/contexts/NotificationContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { FormField } from '@/components/ui/FormField';
import { FieldGuidePanel, FieldGuideItem } from '@/components/ui/FieldGuidePanel';
import { Factory, ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const COUNTRIES = ['Guinea', 'Mali', 'Côte d\'Ivoire', 'Liberia', 'Senegal', 'Ghana', 'France', 'UAE', 'South Africa', 'Burkina Faso'];
const CURRENCIES = ['USD', 'EUR', 'GNF', 'XOF', 'AED', 'ZAR', 'GHS'];

const fieldGuides: FieldGuideItem[] = [
  {
    field: 'name',
    label: 'Company Name / Nom de la Société',
    description: 'Nom officiel complet de la société minière tel qu\'enregistré légalement',
    example: 'Essakane Mine Site SA',
    required: true,
    section: 'Company Information'
  },
  {
    field: 'code',
    label: 'Company Code / Code Société',
    description: 'Code d\'identification unique pour la société (utilisé dans les rapports et transactions)',
    example: 'ESSAKANE_BF',
    required: true,
    rules: ['Doit être unique', 'Pas d\'espaces', 'Utiliser majuscules'],
    section: 'Company Information'
  },
  {
    field: 'country',
    label: 'Country / Pays',
    description: 'Pays où la société est enregistrée et opère',
    example: 'Guinea, Mali, Burkina Faso',
    required: true,
    section: 'Company Information'
  },
  {
    field: 'address',
    label: 'Address / Adresse',
    description: 'Adresse physique complète du siège social ou du site minier',
    example: 'Zone industrielle de Kaloum, Rue KA-028',
    section: 'Company Information'
  },
  {
    field: 'city',
    label: 'City / Ville',
    description: 'Ville où se trouve le siège social ou le site principal',
    example: 'Conakry, Bamako, Ouagadougou',
    section: 'Company Information'
  },
  {
    field: 'postal_code',
    label: 'Postal Code / Code Postal',
    description: 'Code postal ou boîte postale de la société',
    example: 'BP 1234',
    section: 'Company Information'
  },
  {
    field: 'contact_person_name',
    label: 'Contact Person / Personne de Contact',
    description: 'Nom complet de la personne responsable principale (directeur, responsable des opérations)',
    example: 'Mamadou Diallo',
    required: true,
    section: 'Contact Information'
  },
  {
    field: 'contact_person_email',
    label: 'Contact Email / Email de Contact',
    description: 'Adresse email professionnelle de la personne de contact',
    example: 'm.diallo@essakane.com',
    required: true,
    section: 'Contact Information'
  },
  {
    field: 'contact_person_phone',
    label: 'Contact Phone / Téléphone',
    description: 'Numéro de téléphone direct de la personne de contact (avec indicatif pays)',
    example: '+224 622 123 456',
    section: 'Contact Information'
  },
  {
    field: 'website',
    label: 'Website / Site Web',
    description: 'Site web officiel de la société (optionnel)',
    example: 'https://www.miningcompany.com',
    section: 'Contact Information'
  },
  {
    field: 'default_currency',
    label: 'Default Currency / Devise par Défaut',
    description: 'Devise préférée pour les transactions commerciales avec cette société',
    example: 'USD (Dollar américain), EUR (Euro), GNF (Franc guinéen)',
    section: 'Additional Information'
  },
  {
    field: 'tax_id',
    label: 'Tax ID / Numéro Fiscal',
    description: 'Numéro d\'identification fiscale attribué par les autorités locales',
    example: 'NIF-123456789',
    section: 'Additional Information'
  },
  {
    field: 'registration_number',
    label: 'Registration Number / Numéro d\'Enregistrement',
    description: 'Numéro d\'enregistrement commercial de la société',
    example: 'RCCM-GN-2023-A-12345',
    section: 'Additional Information'
  },
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

export function MiningCompanyForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const { showError, showSuccess } = useNotification();

  // Removed currentField state - Field Guide now shows all fields
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    country: 'Guinea',
    address: '',
    city: '',
    postal_code: '',
    contact_person_name: '',
    contact_person_email: '',
    contact_person_phone: '',
    website: '',
    default_currency: 'USD',
    tax_id: '',
    registration_number: '',
    notes: '',
  });

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  useEffect(() => {
    if (isEdit) {
      loadCompany();
    }
  }, [id]);

  const loadCompany = async () => {
    try {
      const { data, error } = await supabase
        .from('mining_companies')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (data) {
        setFormData(data);
        loadBankAccounts();
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

  const addBankAccount = () => {
    setBankAccounts([...bankAccounts, {
      account_name: '',
      bank_name: '',
      bank_country: 'Guinea',
      account_number: '',
      account_currency: 'USD',
      swift_code: '',
      is_primary: bankAccounts.length === 0,
    }]);
  };

  const removeBankAccount = (index: number) => {
    setBankAccounts(bankAccounts.filter((_, i) => i !== index));
  };

  const updateBankAccount = (index: number, field: string, value: any) => {
    const updated = [...bankAccounts];
    updated[index] = { ...updated[index], [field]: value };
    setBankAccounts(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();

      if (isEdit) {
        const { error } = await supabase
          .from('mining_companies')
          .update(formData)
          .eq('id', id);

        if (error) throw error;

        // Update bank accounts
        await supabase
          .from('stakeholder_bank_accounts')
          .delete()
          .eq('stakeholder_type', 'mining_company')
          .eq('stakeholder_id', id);

        for (const account of bankAccounts) {
          if (account.bank_name && account.account_number) {
            await supabase.from('stakeholder_bank_accounts').insert({
              stakeholder_type: 'mining_company',
              stakeholder_id: id,
              ...account,
              created_by: userData.user?.id,
            });
          }
        }
      } else {
        const { data: newCompany, error } = await supabase
          .from('mining_companies')
          .insert({ ...formData, created_by: userData.user?.id })
          .select()
          .single();

        if (error) throw error;

        // Insert bank accounts
        for (const account of bankAccounts) {
          if (account.bank_name && account.account_number) {
            await supabase.from('stakeholder_bank_accounts').insert({
              stakeholder_type: 'mining_company',
              stakeholder_id: newCompany.id,
              ...account,
              created_by: userData.user?.id,
            });
          }
        }
      }

      navigate('/stakeholders/mining-companies');
    } catch (error: any) {
      console.error('Error saving company:', error);
      showError('Error Saving Company', error.message || 'An unexpected error occurred while saving the mining company.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate('/stakeholders/mining-companies')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Factory className="h-8 w-8 text-amber-700" />
            {isEdit ? 'Edit Mining Company' : 'Add Mining Company'}
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Company Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Company Name" required>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </FormField>

                    <FormField label="Company Code" required>
                      <Input
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                        required
                      />
                    </FormField>
                  </div>

                  <FormField label="Country" required>
                    <Select
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    >
                      {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </Select>
                  </FormField>

                  <FormField label="Address">
                    <Input
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </FormField>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="City">
                      <Input
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      />
                    </FormField>

                    <FormField label="Postal Code">
                      <Input
                        value={formData.postal_code}
                        onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                      />
                    </FormField>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField label="Contact Person Name" required>
                    <Input
                      value={formData.contact_person_name}
                      onChange={(e) => setFormData({ ...formData, contact_person_name: e.target.value })}
                      required
                    />
                  </FormField>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Contact Email" required>
                      <Input
                        type="email"
                        value={formData.contact_person_email}
                        onChange={(e) => setFormData({ ...formData, contact_person_email: e.target.value })}
                        required
                      />
                    </FormField>

                    <FormField label="Contact Phone">
                      <Input
                        value={formData.contact_person_phone}
                        onChange={(e) => setFormData({ ...formData, contact_person_phone: e.target.value })}
                      />
                    </FormField>
                  </div>

                  <FormField label="Website">
                    <Input
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      placeholder="https://"
                    />
                  </FormField>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Bank Accounts</CardTitle>
                    <Button type="button" variant="outline" size="sm" onClick={addBankAccount}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Account
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {bankAccounts.map((account, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Account {index + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeBankAccount(index)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <FormField label="Account Name">
                          <Input
                            value={account.account_name}
                            onChange={(e) => updateBankAccount(index, 'account_name', e.target.value)}
                            placeholder="Account holder name"
                          />
                        </FormField>

                        <FormField label="Bank Name">
                          <Input
                            value={account.bank_name}
                            onChange={(e) => updateBankAccount(index, 'bank_name', e.target.value)}
                            placeholder="Bank name"
                          />
                        </FormField>

                        <FormField label="Bank Country">
                          <Select
                            value={account.bank_country}
                            onChange={(e) => updateBankAccount(index, 'bank_country', e.target.value)}
                          >
                            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </Select>
                        </FormField>

                        <FormField label="Account Number">
                          <Input
                            value={account.account_number}
                            onChange={(e) => updateBankAccount(index, 'account_number', e.target.value)}
                            placeholder="Account number"
                          />
                        </FormField>

                        <FormField label="Currency">
                          <Select
                            value={account.account_currency}
                            onChange={(e) => updateBankAccount(index, 'account_currency', e.target.value)}
                          >
                            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </Select>
                        </FormField>

                        <FormField label="SWIFT Code">
                          <Input
                            value={account.swift_code}
                            onChange={(e) => updateBankAccount(index, 'swift_code', e.target.value)}
                            placeholder="SWIFT/BIC code"
                          />
                        </FormField>
                      </div>

                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={account.is_primary}
                          onChange={(e) => updateBankAccount(index, 'is_primary', e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">Primary Account</span>
                      </label>
                    </div>
                  ))}

                  {bankAccounts.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <p>No bank accounts added yet</p>
                      <Button type="button" variant="outline" onClick={addBankAccount} className="mt-2">
                        <Plus className="w-4 h-4 mr-2" />
                        Add First Account
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Additional Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <FormField label="Default Currency">
                      <Select
                        value={formData.default_currency}
                        onChange={(e) => setFormData({ ...formData, default_currency: e.target.value })}
                      >
                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </Select>
                    </FormField>

                    <FormField label="Tax ID">
                      <Input
                        value={formData.tax_id}
                        onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                      />
                    </FormField>

                    <FormField label="Registration Number">
                      <Input
                        value={formData.registration_number}
                        onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                      />
                    </FormField>
                  </div>

                  <FormField label="Notes">
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      rows={4}
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Additional notes..."
                    />
                  </FormField>
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button type="submit" disabled={loading}>
                  <Save className="w-4 h-4 mr-2" />
                  {loading ? 'Saving...' : isEdit ? 'Update Company' : 'Create Company'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/stakeholders/mining-companies')}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-1">
            <FieldGuidePanel
              title="Field Guide"
              guides={fieldGuides}
              currentField={undefined}
            />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
