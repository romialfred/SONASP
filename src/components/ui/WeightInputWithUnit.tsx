import { useState, useEffect } from 'react';
import { Input } from './Input';
import { Select } from './Select';
import { WeightUnit, WEIGHT_UNITS, getAllConversions, convertWeight } from '@/utils/weightConversion';

interface WeightInputWithUnitProps {
  value: string;
  onChange: (value: string, unit: WeightUnit) => void;
  label?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  defaultUnit?: WeightUnit;
}

export function WeightInputWithUnit({
  value,
  onChange,
  label = 'Planned Quantity',
  required = false,
  error,
  disabled = false,
  placeholder = 'Enter quantity',
  defaultUnit = 'ozt',
}: WeightInputWithUnitProps) {
  const [unit, setUnit] = useState<WeightUnit>(defaultUnit);
  const [displayValue, setDisplayValue] = useState(value);
  const [displayConversions, setDisplayConversions] = useState(false);

  // Calculate conversions whenever value or unit changes
  useEffect(() => {
    const numValue = parseFloat(displayValue);
    if (!isNaN(numValue) && numValue > 0) {
      setDisplayConversions(true);
    } else {
      setDisplayConversions(false);
    }
  }, [displayValue, unit]);

  const handleValueChange = (newValue: string) => {
    setDisplayValue(newValue);
    onChange(newValue, unit);
  };

  const handleUnitChange = (newUnit: string) => {
    const weightUnit = newUnit as WeightUnit;

    // Convert the current display value to the new unit
    const numValue = parseFloat(displayValue);
    if (!isNaN(numValue) && numValue > 0) {
      const converted = convertWeight(numValue, unit, weightUnit);
      const convertedStr = converted.toFixed(weightUnit === 'g' ? 2 : 3);
      setDisplayValue(convertedStr);
      setUnit(weightUnit);
      onChange(convertedStr, weightUnit);
    } else {
      setUnit(weightUnit);
      onChange(displayValue, weightUnit);
    }
  };

  // Get conversions for display
  const getConversionDisplay = () => {
    const numValue = parseFloat(displayValue);
    if (isNaN(numValue) || numValue <= 0) return null;

    const conversions = getAllConversions(numValue, unit);

    const displays = [];
    if (unit !== 'g') {
      displays.push(`${conversions.grams.toFixed(2)} g`);
    }
    if (unit !== 'oz') {
      displays.push(`${conversions.ounces.toFixed(2)} oz`);
    }
    if (unit !== 'ozt') {
      displays.push(`${conversions.troyOunces.toFixed(3)} oz t`);
    }

    return displays.join(' = ');
  };

  const conversionText = getConversionDisplay();

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-slate-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            type="number"
            value={displayValue}
            onChange={(e) => handleValueChange(e.target.value)}
            placeholder={placeholder}
            error={error}
            disabled={disabled}
            min="0"
            step="0.001"
          />
        </div>

        <div className="w-32">
          <Select
            value={unit}
            onChange={(e) => handleUnitChange(e.target.value)}
            disabled={disabled}
          >
            {WEIGHT_UNITS.map(u => (
              <option key={u.value} value={u.value}>
                {u.abbreviation}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {displayConversions && conversionText && (
        <p className="text-xs text-slate-500 mt-1">
          <span className="font-medium">Reference:</span> {conversionText}
        </p>
      )}

      {error && !displayConversions && (
        <p className="text-sm text-red-600 mt-1">{error}</p>
      )}
    </div>
  );
}
