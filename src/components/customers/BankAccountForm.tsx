import { useEffect, useId, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Building2, Plus, Trash2, Star } from 'lucide-react';
import { Field } from '@/components/ui/sn';
import { COUNTRIES } from '@/constants/countries';
import { CUSTOMER_COUNTRY_OPTIONS, customerCountryLabel } from '@/lib/customerCountryLabels';

export interface BankAccount {
  id?: string;
  bankName: string;
  country: string;
  city: string;
  accountNumber: string;
  iban: string;
  swiftCode: string;
  currency: string;
  isPrimary: boolean;
  isActive: boolean;
}

interface BankAccountFormProps {
  banks: BankAccount[];
  onChange: (banks: BankAccount[]) => void;
  readOnly?: boolean;
  validate?: boolean;
  validationAttempt?: number;
}

const CURRENCIES = [
  { value: 'USD', label: 'USD — dollar américain' },
  { value: 'EUR', label: 'EUR — euro' },
  { value: 'GBP', label: 'GBP — livre sterling' },
  { value: 'CHF', label: 'CHF — franc suisse' },
  { value: 'GNF', label: 'GNF — franc guinéen' },
  { value: 'XOF', label: 'XOF — franc CFA d’Afrique de l’Ouest' },
  { value: 'XAF', label: 'XAF — franc CFA d’Afrique centrale' },
];

// Banks in Côte d'Ivoire
const BANKS_COTE_IVOIRE = [
  'Banque Atlantique Côte d\'Ivoire',
  'NSIA Banque Côte d\'Ivoire',
  'Société Générale Côte d\'Ivoire',
  'Banque Internationale pour le Commerce et l\'Industrie de la Côte d\'Ivoire (BICICI)',
  'Ecobank Côte d\'Ivoire',
  'Standard Chartered Bank Côte d\'Ivoire',
  'Citibank Côte d\'Ivoire',
  'Banque Nationale d\'Investissement (BNI)',
  'Bridge Bank Group',
  'Coris Bank International Côte d\'Ivoire',
  'Versus Bank',
  'UBA Côte d\'Ivoire',
  'Banque Sahélo-Saharienne pour l\'Investissement et le Commerce (BSIC)',
  'Bank of Africa Côte d\'Ivoire',
  'Orabank Côte d\'Ivoire',
];

// Banks in Burkina Faso
const BANKS_BURKINA_FASO = [
  'Banque Atlantique Burkina Faso',
  'Ecobank Burkina Faso',
  'Coris Bank International',
  'Banque Commerciale du Burkina (BCB)',
  'Banque Internationale du Burkina (BIB)',
  'Société Générale Burkina Faso',
  'Bank of Africa Burkina Faso',
  'UBA Burkina Faso',
  'Banque Agricole et Commerciale du Burkina (BACB)',
  'Banque Sahélo-Saharienne pour l\'Investissement et le Commerce (BSIC)',
  'Orabank Burkina Faso',
  'NSIA Banque Burkina Faso',
];

// Banks in Guinea
const BANKS_GUINEA = [
  'Société Générale de Banques en Guinée (SGBG)',
  'Ecobank Guinée',
  'Banque Internationale pour le Commerce et l\'Industrie de la Guinée (BICIGUI)',
  'Orabank Guinée',
  'United Bank for Africa (UBA) Guinée',
  'Vista Bank Guinée',
  'Banque pour le Commerce et l\'Industrie (BCI)',
  'Banque Islamique de Guinée (BIG)',
  'Banque Populaire Maroco-Guinéenne (BPMG)',
  'Coris Bank International Guinée',
  'NSIA Banque Guinée',
];

// Function to get banks by country
const getBanksByCountry = (country: string): string[] => {
  const countryLower = country.toLowerCase();

  if (['ivory coast', "côte d'ivoire", 'côte d’ivoire'].includes(countryLower)) {
    return BANKS_COTE_IVOIRE;
  } else if (countryLower === 'burkina faso') {
    return BANKS_BURKINA_FASO;
  } else if (['guinea', 'guinée'].includes(countryLower)) {
    return BANKS_GUINEA;
  }

  return [];
};

export function BankAccountForm({ banks, onChange, readOnly = false, validate = false, validationAttempt = 0 }: BankAccountFormProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(banks.length ? 0 : null);
  const formId = useId();
  const [customChoices, setCustomChoices] = useState<Set<number>>(new Set());
  const invalidIndex = validate ? banks.findIndex(bank => !bank.bankName.trim() || bank.bankName === '__other__' || !bank.country.trim() || !bank.city.trim() || !bank.currency.trim()) : -1;
  useEffect(() => { if (invalidIndex >= 0) setExpandedIndex(invalidIndex); }, [invalidIndex, validationAttempt]);
  useEffect(() => { if (invalidIndex >= 0 && expandedIndex === invalidIndex) document.getElementById(`${formId}-bank-${invalidIndex}`)?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(); }, [expandedIndex, invalidIndex, validationAttempt, formId]);
  const update = (index: number, field: keyof BankAccount, value: string | boolean) => {
    onChange(banks.map((bank, i) => i === index ? { ...bank, [field]: value } :
      field === 'isPrimary' && value === true ? { ...bank, isPrimary: false } : bank));
  };
  const add = () => {
    onChange([...banks, { bankName: '', country: 'Burkina Faso', city: '', accountNumber: '',
      iban: '', swiftCode: '', currency: 'XOF', isPrimary: banks.length === 0, isActive: true }]);
    setExpandedIndex(banks.length);
  };
  const remove = (index: number) => {
    const remaining = banks.filter((_, i) => i !== index).map((bank, i) =>
      banks[index].isPrimary && i === 0 ? { ...bank, isPrimary: true } : bank);
    setCustomChoices(previous => new Set([...previous].filter(i => i !== index).map(i => i > index ? i - 1 : i)));
    onChange(remaining);
    setExpandedIndex(remaining.length ? 0 : null);
  };
  return <div className="space-y-4">
    <div className="flex items-center justify-between flex-wrap gap-3">
      <h3 className="font-semibold">Comptes bancaires <span className="text-gray-500">({banks.length})</span></h3>
      {!readOnly && <Button type="button" size="sm" variant="outline" onClick={add}><Plus className="w-4 h-4" />Ajouter un compte</Button>}
    </div>
    {!banks.length && <div className="rounded-lg border border-dashed p-6 text-center">
      <Building2 className="mx-auto mb-2 h-8 w-8 text-gray-400" />
      <p>Aucun compte bancaire ajouté</p>
      {!readOnly && <Button type="button" variant="outline" size="sm" className="mt-3" onClick={add}>Ajouter le premier compte bancaire</Button>}
    </div>}
    {banks.map((bank, index) => {
      const available = getBanksByCountry(bank.country);
      const custom = customChoices.has(index) || bank.bankName === '__other__' || (!!bank.bankName && !available.includes(bank.bankName));
      const open = expandedIndex === index;
      const panelId = `${formId}-bank-${index}`;
      return <Card key={bank.id ?? index} className={bank.isPrimary ? 'border-amber-300' : ''}>
        <div className="p-4">
          <div className="flex items-center gap-3">
            <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"
              aria-label={`${open ? 'Fermer' : 'Ouvrir'} le compte bancaire ${index + 1}`} aria-expanded={open} aria-controls={panelId}
              onClick={() => setExpandedIndex(open ? null : index)}>
              <Building2 className="h-5 w-5 shrink-0 text-emerald-700" />
              <span className="min-w-0"><strong className="block break-words">{bank.bankName && bank.bankName !== '__other__' ? bank.bankName : `Compte bancaire ${index + 1}`}</strong>
                <small className="text-gray-500">{[bank.city, customerCountryLabel(bank.country), bank.currency].filter(Boolean).join(' · ')}</small></span>
              {bank.isPrimary && <span className="inline-flex items-center gap-1 text-xs text-amber-800"><Star className="h-3 w-3" />Principal</span>}
            </button>
            {!readOnly && <Button type="button" variant="outline" size="sm" aria-label={`Retirer le compte bancaire ${index + 1}`} onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-red-700" /></Button>}
          </div>
          {open && <div id={panelId} className="mt-4 space-y-4 border-t pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Pays" required error={validate && (!bank.country.trim()) ? "Champ obligatoire." : undefined}><Select aria-invalid={validate && (!bank.country.trim())} value={bank.country} disabled={readOnly} onChange={e => update(index, 'country', e.target.value)}>
                <option value="">Sélectionnez un pays</option>{bank.country && !COUNTRIES.includes(bank.country) && <option value={bank.country}>{bank.country} (valeur enregistrée)</option>}{CUSTOMER_COUNTRY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select></Field>
              <Field label="Ville" required error={validate && (!bank.city.trim()) ? "Champ obligatoire." : undefined}><Input aria-invalid={validate && (!bank.city.trim())} value={bank.city} disabled={readOnly} onChange={e => update(index, 'city', e.target.value)} placeholder="Ville de l’agence" /></Field>
              <div><Field label="Nom de la banque" required error={validate && (!bank.bankName.trim() || bank.bankName === '__other__') ? "Champ obligatoire." : undefined}>
                {available.length ? <Select aria-invalid={validate && (!bank.bankName.trim() || bank.bankName === '__other__')} value={custom ? '__other__' : bank.bankName} disabled={readOnly} onChange={e => { setCustomChoices(previous => { const next = new Set(previous); if (e.target.value === '__other__') next.add(index); else next.delete(index); return next; }); update(index, 'bankName', e.target.value); }}>
                  <option value="">Sélectionnez une banque</option>{available.map(name => <option key={name}>{name}</option>)}<option value="__other__">Autre (à préciser ci-dessous)</option>
                </Select> : <Input aria-invalid={validate && (!bank.bankName.trim() || bank.bankName === '__other__')} value={bank.bankName === '__other__' ? '' : bank.bankName} disabled={readOnly} onChange={e => update(index, 'bankName', e.target.value)} />}
              </Field>
              {available.length > 0 && custom && <div className="mt-2"><Field label="Nom de la banque hors catalogue" required error={validate && bank.bankName === '__other__' ? "Précisez le nom de la banque." : undefined}><Input aria-invalid={validate && (!bank.bankName.trim() || bank.bankName === '__other__')} value={bank.bankName === '__other__' ? '' : bank.bankName} disabled={readOnly}
                onChange={e => update(index, 'bankName', e.target.value || '__other__')} placeholder="Saisissez le nom de la banque" /></Field></div>}
              </div>
              <Field label="Devise" required error={validate && (!bank.currency.trim()) ? "Champ obligatoire." : undefined}><Select aria-invalid={validate && (!bank.currency.trim())} value={bank.currency} disabled={readOnly} onChange={e => update(index, 'currency', e.target.value)}>
                <option value="">Sélectionnez une devise</option>{bank.currency && !CURRENCIES.some(currency => currency.value === bank.currency) && <option value={bank.currency}>{bank.currency} (valeur enregistrée)</option>}{CURRENCIES.map(currency => <option key={currency.value} value={currency.value}>{currency.label}</option>)}
              </Select></Field>
              <Field label="Numéro de compte"><Input value={bank.accountNumber} disabled={readOnly} onChange={e => update(index, 'accountNumber', e.target.value)} /></Field>
              <Field label="IBAN"><Input value={bank.iban} disabled={readOnly} onChange={e => update(index, 'iban', e.target.value.toUpperCase())} /></Field>
              <Field label="Code SWIFT/BIC"><Input value={bank.swiftCode} disabled={readOnly} onChange={e => update(index, 'swiftCode', e.target.value.toUpperCase())} /></Field>
            </div>
            {!readOnly && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={bank.isPrimary} onChange={e => update(index, 'isPrimary', e.target.checked)} />Définir comme compte bancaire principal</label>}
          </div>}
        </div>
      </Card>;
    })}
  </div>;
}
