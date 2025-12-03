import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
  value: string;
  label: string;
  subtitle?: string;
  icon?: string;
}

interface ComboBoxProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  allowCustom?: boolean;
  customPlaceholder?: string;
}

export function ComboBox({
  label,
  value,
  onChange,
  options,
  placeholder = 'Sélectionner ou saisir...',
  required = false,
  disabled = false,
  allowCustom = true,
  customPlaceholder = 'Saisir manuellement...'
}: ComboBoxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filtrer les options selon la recherche
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    option.value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Vérifier si la valeur actuelle est dans les options
  const currentOption = options.find(opt => opt.value === value);
  const displayValue = currentOption ? currentOption.label : value;

  // Fermer le dropdown quand on clique dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
        setIsCustomMode(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
    setIsCustomMode(false);
  };

  const handleCustomInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm('');
      setIsCustomMode(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {/* Mode saisie personnalisée */}
      {isCustomMode ? (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleCustomInput}
            onKeyDown={handleKeyDown}
            placeholder={customPlaceholder}
            disabled={disabled}
            className="w-full px-3 py-2 border border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <button
            type="button"
            onClick={() => {
              setIsCustomMode(false);
              setIsOpen(true);
            }}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-sm text-blue-600 hover:text-blue-800"
          >
            Choisir dans la liste
          </button>
        </div>
      ) : (
        <>
          {/* Bouton principal */}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            disabled={disabled}
            className={`w-full px-3 py-2 text-left bg-white border rounded-lg flex items-center justify-between ${
              disabled
                ? 'bg-gray-100 cursor-not-allowed'
                : 'hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500'
            } ${isOpen ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-300'}`}
          >
            <span className={`flex items-center gap-2 ${value ? 'text-gray-900' : 'text-gray-400'}`}>
              {currentOption?.icon && <span className="text-xl">{currentOption.icon}</span>}
              {displayValue || placeholder}
            </span>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
          </button>

          {/* Dropdown */}
          {isOpen && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-hidden">
              {/* Champ de recherche */}
              <div className="p-2 border-b border-gray-200">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Rechercher..."
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              {/* Liste des options */}
              <div className="overflow-y-auto max-h-60">
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSelect(option.value)}
                      className={`w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center justify-between ${
                        value === option.value ? 'bg-blue-100' : ''
                      }`}
                    >
                      <div className="flex-1 flex items-start gap-2">
                        {option.icon && (
                          <span className="text-xl mt-0.5">{option.icon}</span>
                        )}
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{option.label}</div>
                          {option.subtitle && (
                            <div className="text-xs text-gray-500">{option.subtitle}</div>
                          )}
                        </div>
                      </div>
                      {value === option.value && (
                        <Check className="w-4 h-4 text-blue-600" />
                      )}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-4 text-sm text-gray-500 text-center">
                    Aucun résultat trouvé
                  </div>
                )}
              </div>

              {/* Option de saisie manuelle */}
              {allowCustom && (
                <div className="p-2 border-t border-gray-200 bg-gray-50">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomMode(true);
                      setIsOpen(false);
                      setTimeout(() => inputRef.current?.focus(), 0);
                    }}
                    className="w-full px-3 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded text-left"
                  >
                    ✏️ Saisir manuellement si non trouvé
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
