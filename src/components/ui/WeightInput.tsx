import { useState, useEffect, useRef } from 'react';
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
  defaultUnit = 'oz',
  onFocus,
  onBlur,
  className = '',
  showConversion = true,
}: WeightInputProps) {
  const [unit, setUnit] = useState<'g' | 'oz'>(defaultUnit);
  const [displayValue, setDisplayValue] = useState('');
  const isUserTyping = useRef(false);
  const lastExternalValue = useRef(value);

  // Only update display when value changes externally (not from user typing)
  useEffect(() => {
    // Skip if user is actively typing
    if (isUserTyping.current) {
      return;
    }

    // Skip if value hasn't actually changed
    if (lastExternalValue.current === value) {
      return;
    }

    lastExternalValue.current = value;

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
    isUserTyping.current = true;
    setDisplayValue(inputValue);

    if (inputValue === '' || inputValue === '0' || inputValue === '0.') {
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

  const handleInputBlur = () => {
    isUserTyping.current = false;

    // Format the display value on blur
    if (displayValue && displayValue !== '') {
      const numValue = parseFloat(displayValue);
      if (!isNaN(numValue)) {
        if (unit === 'oz') {
          setDisplayValue(numValue.toFixed(3));
        } else {
          setDisplayValue(numValue.toFixed(2));
        }
      }
    }

    if (onBlur) {
      onBlur();
    }
  };

  const handleInputFocus = () => {
    isUserTyping.current = true;
    if (onFocus) {
      onFocus();
    }
  };

  const handleUnitChange = (newUnit: 'g' | 'oz') => {
    const oldUnit = unit;
    setUnit(newUnit);

    // Convert the current display value to the new unit
    if (displayValue && displayValue !== '') {
      const numValue = parseFloat(displayValue);
      if (!isNaN(numValue)) {
        let newDisplayValue: string;

        if (oldUnit === 'g' && newUnit === 'oz') {
          // Converting from grams to oz
          newDisplayValue = (numValue / GRAMS_PER_OZ).toFixed(3);
        } else if (oldUnit === 'oz' && newUnit === 'g') {
          // Converting from oz to grams
          newDisplayValue = (numValue * GRAMS_PER_OZ).toFixed(2);
        } else {
          newDisplayValue = displayValue;
        }

        setDisplayValue(newDisplayValue);
      }
    }
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
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
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

      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200">
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <span className="font-medium">Reference:</span>
          <span>1 oz = 31.10 g</span>
        </div>
      </div>
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
