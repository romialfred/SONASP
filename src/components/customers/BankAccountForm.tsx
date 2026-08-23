import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Building2, Plus, Trash2, Star } from 'lucide-react';
import { COUNTRIES } from '@/constants/countries';

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
}

const CURRENCIES = [
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'CHF', label: 'CHF - Swiss Franc' },
  { value: 'GNF', label: 'GNF - Guinean Franc' },
  { value: 'XOF', label: 'XOF - West African CFA Franc' },
  { value: 'XAF', label: 'XAF - Central African CFA Franc' },
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

  if (countryLower.includes('ivoire') || countryLower.includes('côte')) {
    return BANKS_COTE_IVOIRE;
  } else if (countryLower.includes('burkina')) {
    return BANKS_BURKINA_FASO;
  } else if (countryLower.includes('guinea') || countryLower.includes('guinée')) {
    return BANKS_GUINEA;
  }

  return [];
};

export function BankAccountForm({ banks, onChange, readOnly = false }: BankAccountFormProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(banks.length > 0 ? 0 : null);

  const handleAddBank = () => {
    const newBank: BankAccount = {
      bankName: '',
      country: 'Burkina Faso',
      city: '',
      accountNumber: '',
      iban: '',
      swiftCode: '',
      currency: 'XOF',
      isPrimary: banks.length === 0,
      isActive: true,
    };
    onChange([...banks, newBank]);
    setExpandedIndex(banks.length);
  };

  const handleUpdateBank = (index: number, field: keyof BankAccount, value: any) => {
    const updatedBanks = [...banks];
    updatedBanks[index] = { ...updatedBanks[index], [field]: value };

    if (field === 'isPrimary' && value === true) {
      updatedBanks.forEach((bank, i) => {
        if (i !== index) {
          bank.isPrimary = false;
        }
      });
    }

    onChange(updatedBanks);
  };

  const handleDeleteBank = (index: number) => {
    const updatedBanks = banks.filter((_, i) => i !== index);

    if (banks[index].isPrimary && updatedBanks.length > 0) {
      updatedBanks[0].isPrimary = true;
    }

    onChange(updatedBanks);
    setExpandedIndex(updatedBanks.length > 0 ? 0 : null);
  };

  const toggleExpanded = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Bank Accounts</h3>
          <span className="text-sm text-gray-500">({banks.length})</span>
        </div>
        {!readOnly && (
          <Button
            type="button"
            onClick={handleAddBank}
            variant="secondary"
            size="sm"
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Bank
          </Button>
        )}
      </div>

      {banks.length === 0 && (
        <Card className="bg-gray-50 border-dashed">
          <div className="p-8 text-center">
            <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-2">No bank accounts added yet</p>
            <p className="text-sm text-gray-500 mb-4">
              Add at least one bank account for payment processing
            </p>
            {!readOnly && (
              <Button type="button" onClick={handleAddBank} variant="primary" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add First Bank Account
              </Button>
            )}
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {banks.map((bank, index) => {
          const availableBanks = getBanksByCountry(bank.country);

          return (
            <Card
              key={index}
              className={`transition-all ${
                bank.isPrimary
                  ? 'border-amber-500 bg-amber-50/30'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="p-4">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleExpanded(index)}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        bank.isPrimary ? 'bg-amber-100' : 'bg-blue-100'
                      }`}
                    >
                      <Building2
                        className={`w-5 h-5 ${
                          bank.isPrimary ? 'text-amber-600' : 'text-blue-600'
                        }`}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900">
                          {bank.bankName || `Bank Account ${index + 1}`}
                        </h4>
                        {bank.isPrimary && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                            <Star className="w-3 h-3 fill-current" />
                            Primary
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {bank.country && bank.city
                          ? `${bank.city}, ${bank.country}`
                          : bank.country || 'Location not set'}
                        {bank.currency && ` • ${bank.currency}`}
                      </p>
                    </div>
                  </div>
                  {!readOnly && (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBank(index);
                        }}
                        variant="secondary"
                        size="sm"
                        className="text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {expandedIndex === index && (
                  <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Country <span className="text-red-500">*</span>
                        </label>
                        <Select
                          value={bank.country}
                          onChange={(e) =>
                            handleUpdateBank(index, 'country', e.target.value)
                          }
                          disabled={readOnly}
                        >
                          <option value="">Select country</option>
                          {COUNTRIES.map((country) => (
                            <option key={country} value={country}>
                              {country}
                            </option>
                          ))}
                        </Select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          City <span className="text-red-500">*</span>
                        </label>
                        <Input
                          value={bank.city}
                          onChange={(e) =>
                            handleUpdateBank(index, 'city', e.target.value)
                          }
                          placeholder="e.g., Abidjan, Ouagadougou"
                          disabled={readOnly}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Bank Name <span className="text-red-500">*</span>
                        </label>
                        {availableBanks.length > 0 ? (
                          <Select
                            value={bank.bankName}
                            onChange={(e) =>
                              handleUpdateBank(index, 'bankName', e.target.value)
                            }
                            disabled={readOnly}
                          >
                            <option value="">Select a bank</option>
                            {availableBanks.map((bankName) => (
                              <option key={bankName} value={bankName}>
                                {bankName}
                              </option>
                            ))}
                            <option value="__other__">Other (specify below)</option>
                          </Select>
                        ) : (
                          <Input
                            value={bank.bankName}
                            onChange={(e) =>
                              handleUpdateBank(index, 'bankName', e.target.value)
                            }
                            placeholder="e.g., UBS, Credit Suisse"
                            disabled={readOnly}
                          />
                        )}
                        {bank.bankName === '__other__' && (
                          <Input
                            className="mt-2"
                            value=""
                            onChange={(e) =>
                              handleUpdateBank(index, 'bankName', e.target.value)
                            }
                            placeholder="Enter bank name"
                            disabled={readOnly}
                          />
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Currency <span className="text-red-500">*</span>
                        </label>
                        <Select
                          value={bank.currency}
                          onChange={(e) =>
                            handleUpdateBank(index, 'currency', e.target.value)
                          }
                          disabled={readOnly}
                        >
                          <option value="">Select currency</option>
                          {CURRENCIES.map((curr) => (
                            <option key={curr.value} value={curr.value}>
                              {curr.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Account Number
                        </label>
                        <Input
                          value={bank.accountNumber}
                          onChange={(e) =>
                            handleUpdateBank(index, 'accountNumber', e.target.value)
                          }
                          placeholder="Account number"
                          disabled={readOnly}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          IBAN
                        </label>
                        <Input
                          value={bank.iban}
                          onChange={(e) =>
                            handleUpdateBank(index, 'iban', e.target.value.toUpperCase())
                          }
                          placeholder="CI93 0076 2011 6238 5295 7"
                          disabled={readOnly}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        SWIFT/BIC Code
                      </label>
                      <Input
                        value={bank.swiftCode}
                        onChange={(e) =>
                          handleUpdateBank(index, 'swiftCode', e.target.value.toUpperCase())
                        }
                        placeholder="e.g., SGBFCIAB"
                        disabled={readOnly}
                      />
                    </div>

                    {!readOnly && (
                      <div className="flex items-center gap-2 pt-2">
                        <input
                          type="checkbox"
                          id={`primary-${index}`}
                          checked={bank.isPrimary}
                          onChange={(e) =>
                            handleUpdateBank(index, 'isPrimary', e.target.checked)
                          }
                          className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                        />
                        <label
                          htmlFor={`primary-${index}`}
                          className="text-sm font-medium text-gray-700 cursor-pointer"
                        >
                          Set as primary bank account
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {banks.length > 0 && !readOnly && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> The primary bank account will be used as the default for payment processing.
            You can add multiple bank accounts in different currencies.
          </p>
        </div>
      )}
    </div>
  );
}
