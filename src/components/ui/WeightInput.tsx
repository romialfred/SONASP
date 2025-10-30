import { useState, useEffect } from 'react';
import Input from './Input';
import Select from './Select';

interface WeightInputProps {
  value: number; // Always in grams internally
  onChange: (grams: number) => void;
  label?: string;
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
  required?: boolean;
  defaultUnit?: 'g' | 'oz';
  onFocus?: () => void;
  onBlur?: () => void;
  className?: string;
  showConversion?: boolean;
}

const GRAMS_PER_OZ = 31.1034768;

export function WeightInput({
  value,
  onChange,
  label,
  placeholder,
  error,
  disabled,
  required,
  defaultUnit = 'g',
  onFocus,
  onBlur,
  className = '',
  showConversion = true,
}: WeightInputProps) {
  const [unit, setUnit] = useState<'g' | 'oz'>(defaultUnit);
  const [displayValue, setDisplayValue] = useState('');

  // Convert internal grams to display unit
  useEffect(() => {
    if (value === 0 || value === null || value === undefined) {
      setDisplayValue('');
      return;
    }

    if (unit === 'oz') {
      const ozValue = value / GRAMS_PER_OZ;
      setDisplayValue(ozValue.toFixed(3));
    } else {
      setDisplayValue(value.toFixed(2));
    }
  }, [value, unit]);

  const handleValueChange = (inputValue: string) => {
    setDisplayValue(inputValue);

    if (inputValue === '' || inputValue === '0') {
      onChange(0);
      return;
    }

    const numValue = parseFloat(inputValue);
    if (isNaN(numValue)) {
      return;
    }

    // Convert to grams for internal storage
    const grams = unit === 'oz' ? numValue * GRAMS_PER_OZ : numValue;
    onChange(grams);
  };

  const handleUnitChange = (newUnit: 'g' | 'oz') => {
    setUnit(newUnit);
    // Value will be recalculated in useEffect
  };

  const getConversionText = () => {
    if (!showConversion || !displayValue || displayValue === '0') {
      return null;
    }

    const numValue = parseFloat(displayValue);
    if (isNaN(numValue)) return null;

    if (unit === 'oz') {
      const grams = numValue * GRAMS_PER_OZ;
      return `= ${grams.toFixed(2)} g`;
    } else {
      const oz = numValue / GRAMS_PER_OZ;
      return `= ${oz.toFixed(3)} oz`;
    }
  };

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            type="number"
            step={unit === 'oz' ? '0.001' : '0.01'}
            placeholder={placeholder || `Enter quantity in ${unit}`}
            value={displayValue}
            onChange={(e) => handleValueChange(e.target.value)}
            onFocus={onFocus}
            onBlur={onBlur}
            error={error}
            disabled={disabled}
            className="w-full"
          />
        </div>

        <Select
          value={unit}
          onChange={(e) => handleUnitChange(e.target.value as 'g' | 'oz')}
          disabled={disabled}
          className="w-20"
        >
          <option value="oz">oz</option>
          <option value="g">g</option>
        </Select>
      </div>

      {showConversion && getConversionText() && (
        <p className="text-xs text-gray-500 mt-1">
          {getConversionText()}
        </p>
      )}
    </div>
  );
}

// Helper functions for manual conversion if needed
export const gramsToOunces = (grams: number): number => {
  return grams / GRAMS_PER_OZ;
};

export const ouncesToGrams = (ounces: number): number => {
  return ounces * GRAMS_PER_OZ;
};

export const formatWeight = (grams: number, unit: 'g' | 'oz' = 'g'): string => {
  if (unit === 'oz') {
    return `${gramsToOunces(grams).toFixed(3)} oz`;
  }
  return `${grams.toFixed(2)} g`;
};
