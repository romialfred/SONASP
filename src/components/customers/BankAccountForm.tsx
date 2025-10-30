import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Building2, Plus, Trash2, Star } from 'lucide-react';

export interface BankAccount {
  id?: string;
  bank_name: string;
  country: string;
  city: string;
  account_number: string;
  iban: string;
  swift_code: string;
  currency: string;
  is_primary: boolean;
  is_active: boolean;
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

const COUNTRIES = [
  'Switzerland', 'United States', 'United Kingdom', 'France', 'Germany',
  'Guinea', 'Ivory Coast', 'Mali', 'Senegal', 'Belgium', 'Luxembourg',
  'United Arab Emirates', 'Singapore', 'Hong Kong'
];

export function BankAccountForm({ banks, onChange, readOnly = false }: BankAccountFormProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(banks.length > 0 ? 0 : null);

  const handleAddBank = () => {
    const newBank: BankAccount = {
      bank_name: '',
      country: '',
      city: '',
      account_number: '',
      iban: '',
      swift_code: '',
      currency: 'USD',
      is_primary: banks.length === 0,
      is_active: true,
    };
    onChange([...banks, newBank]);
    setExpandedIndex(banks.length);
  };

  const handleUpdateBank = (index: number, field: keyof BankAccount, value: any) => {
    const updatedBanks = [...banks];
    updatedBanks[index] = { ...updatedBanks[index], [field]: value };

    if (field === 'is_primary' && value === true) {
      updatedBanks.forEach((bank, i) => {
        if (i !== index) {
          bank.is_primary = false;
        }
      });
    }

    onChange(updatedBanks);
  };

  const handleDeleteBank = (index: number) => {
    const updatedBanks = banks.filter((_, i) => i !== index);

    if (banks[index].is_primary && updatedBanks.length > 0) {
      updatedBanks[0].is_primary = true;
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
              <Button onClick={handleAddBank} variant="primary" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add First Bank Account
              </Button>
            )}
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {banks.map((bank, index) => (
          <Card
            key={index}
            className={`transition-all ${
              bank.is_primary
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
                      bank.is_primary ? 'bg-amber-100' : 'bg-blue-100'
                    }`}
                  >
                    <Building2
                      className={`w-5 h-5 ${
                        bank.is_primary ? 'text-amber-600' : 'text-blue-600'
                      }`}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900">
                        {bank.bank_name || `Bank Account ${index + 1}`}
                      </h4>
                      {bank.is_primary && (
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
                        Bank Name <span className="text-red-500">*</span>
                      </label>
                      <Input
                        value={bank.bank_name}
                        onChange={(e) =>
                          handleUpdateBank(index, 'bank_name', e.target.value)
                        }
                        placeholder="e.g., UBS, Credit Suisse"
                        disabled={readOnly}
                      />
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
                        placeholder="e.g., Geneva, Zurich"
                        disabled={readOnly}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Account Number
                      </label>
                      <Input
                        value={bank.account_number}
                        onChange={(e) =>
                          handleUpdateBank(index, 'account_number', e.target.value)
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
                        placeholder="CH93 0076 2011 6238 5295 7"
                        disabled={readOnly}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SWIFT/BIC Code
                    </label>
                    <Input
                      value={bank.swift_code}
                      onChange={(e) =>
                        handleUpdateBank(index, 'swift_code', e.target.value.toUpperCase())
                      }
                      placeholder="e.g., UBSWCHZH80A"
                      disabled={readOnly}
                    />
                  </div>

                  {!readOnly && (
                    <div className="flex items-center gap-2 pt-2">
                      <input
                        type="checkbox"
                        id={`primary-${index}`}
                        checked={bank.is_primary}
                        onChange={(e) =>
                          handleUpdateBank(index, 'is_primary', e.target.checked)
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
        ))}
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
