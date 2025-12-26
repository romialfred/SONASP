import { useState, useEffect } from 'react';
import { Phone } from 'lucide-react';
import { SAHEL_COUNTRIES } from '@/data/burkinaFasoData';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  defaultCountry?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

export function PhoneInput({
  value,
  onChange,
  defaultCountry = 'Burkina Faso',
  required = false,
  placeholder = 'XX XX XX XX',
  className = ''
}: PhoneInputProps) {
  const [selectedPrefix, setSelectedPrefix] = useState('+226');
  const [phoneNumber, setPhoneNumber] = useState('');

  useEffect(() => {
    const country = SAHEL_COUNTRIES.find(c => c.name === defaultCountry);
    if (country) {
      setSelectedPrefix(country.phonePrefix);
    }
  }, [defaultCountry]);

  useEffect(() => {
    if (value) {
      const prefix = SAHEL_COUNTRIES.find(c => value.startsWith(c.phonePrefix));
      if (prefix) {
        setSelectedPrefix(prefix.phonePrefix);
        setPhoneNumber(value.substring(prefix.phonePrefix.length).trim());
      } else {
        setPhoneNumber(value);
      }
    }
  }, [value]);

  const handlePrefixChange = (newPrefix: string) => {
    setSelectedPrefix(newPrefix);
    onChange(`${newPrefix} ${phoneNumber}`);
  };

  const handlePhoneChange = (newPhone: string) => {
    const cleaned = newPhone.replace(/[^\d\s]/g, '');
    setPhoneNumber(cleaned);
    onChange(`${selectedPrefix} ${cleaned}`);
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      <div className="w-36">
        <select
          value={selectedPrefix}
          onChange={(e) => handlePrefixChange(e.target.value)}
          className="w-full h-10 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white text-sm"
          required={required}
        >
          {SAHEL_COUNTRIES.sort((a, b) => a.priority - b.priority).map(country => (
            <option key={country.code} value={country.phonePrefix}>
              {country.flag} {country.phonePrefix}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1 relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Phone className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="tel"
          value={phoneNumber}
          onChange={(e) => handlePhoneChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="w-full h-10 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
        />
      </div>
    </div>
  );
}
