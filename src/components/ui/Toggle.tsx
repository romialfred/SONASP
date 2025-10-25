interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function Toggle({ checked, onChange, label, disabled = false, size = 'md' }: ToggleProps) {
  const sizeClasses = {
    sm: 'w-8 h-4',
    md: 'w-11 h-6',
    lg: 'w-14 h-7',
  };

  const dotSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const translateClasses = {
    sm: 'translate-x-4',
    md: 'translate-x-5',
    lg: 'translate-x-7',
  };

  return (
    <label className="flex items-center cursor-pointer">
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        <div
          className={`block ${sizeClasses[size]} rounded-full transition-colors ${
            checked ? 'bg-green-500' : 'bg-gray-300'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        ></div>
        <div
          className={`absolute left-0.5 top-0.5 ${dotSizeClasses[size]} bg-white rounded-full transition-transform ${
            checked ? translateClasses[size] : 'translate-x-0'
          }`}
        ></div>
      </div>
      {label && <span className="ml-3 text-sm text-gray-700">{label}</span>}
    </label>
  );
}
