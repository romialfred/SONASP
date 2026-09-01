import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { Check, ChevronDown } from 'lucide-react';

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

function getInitialActiveIndex(availableOptions: Option[], value: string, preferLast = false) {
  if (availableOptions.length === 0) return -1;
  const selectedIndex = availableOptions.findIndex((option) => option.value === value);
  if (selectedIndex >= 0) return selectedIndex;
  return preferLast ? availableOptions.length - 1 : 0;
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
  customPlaceholder = 'Saisir manuellement...',
}: ComboBoxProps) {
  const generatedId = useId();
  const triggerId = `combobox-trigger-${generatedId}`;
  const searchId = `combobox-search-${generatedId}`;
  const customInputId = `combobox-custom-${generatedId}`;
  const listboxId = `combobox-listbox-${generatedId}`;

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const filteredOptions = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase('fr');
    if (!normalizedSearch) return options;

    return options.filter(
      (option) =>
        option.label.toLocaleLowerCase('fr').includes(normalizedSearch) ||
        option.value.toLocaleLowerCase('fr').includes(normalizedSearch),
    );
  }, [options, searchTerm]);

  const currentOption = options.find((option) => option.value === value);
  const displayValue = currentOption ? currentOption.label : value;
  const activeOptionId =
    isOpen && activeIndex >= 0 && activeIndex < filteredOptions.length
      ? `${listboxId}-option-${activeIndex}`
      : undefined;

  const focusTrigger = () => {
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  };

  const closeDropdown = (restoreFocus = false) => {
    setIsOpen(false);
    setSearchTerm('');
    setActiveIndex(-1);
    if (restoreFocus) focusTrigger();
  };

  const openDropdown = (preferLast = false) => {
    if (disabled) return;
    setSearchTerm('');
    setActiveIndex(getInitialActiveIndex(options, value, preferLast));
    setIsOpen(true);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
        setActiveIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) searchRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (isCustomMode) inputRef.current?.focus();
  }, [isCustomMode]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveIndex((previousIndex) => {
      if (filteredOptions.length === 0) return -1;
      if (previousIndex >= 0 && previousIndex < filteredOptions.length) return previousIndex;
      return getInitialActiveIndex(filteredOptions, value);
    });
  }, [filteredOptions, isOpen, value]);

  useEffect(() => {
    optionRefs.current[activeIndex]?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex]);

  useEffect(() => {
    if (!disabled) return;
    setIsOpen(false);
    setIsCustomMode(false);
    setSearchTerm('');
    setActiveIndex(-1);
  }, [disabled]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsCustomMode(false);
    closeDropdown(true);
  };

  const handleCustomInput = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openDropdown(event.key === 'ArrowUp');
      return;
    }

    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      closeDropdown(true);
    }
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDropdown(true);
      return;
    }

    if (event.key === 'Tab') {
      closeDropdown();
      return;
    }

    if (filteredOptions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((previousIndex) =>
        previousIndex < 0 || previousIndex === filteredOptions.length - 1 ? 0 : previousIndex + 1,
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((previousIndex) =>
        previousIndex <= 0 ? filteredOptions.length - 1 : previousIndex - 1,
      );
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(filteredOptions.length - 1);
      return;
    }

    if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      handleSelect(filteredOptions[activeIndex].value);
    }
  };

  const handleCustomKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    setIsCustomMode(false);
    closeDropdown(true);
  };

  return (
    <div className="relative" ref={containerRef}>
      {label && (
        <label
          className="block text-sm font-medium text-gray-700 mb-1"
          htmlFor={isCustomMode ? customInputId : triggerId}
        >
          {label}{' '}
          {required && (
            <span className="text-red-500" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      {isCustomMode ? (
        <div className="relative">
          <input
            ref={inputRef}
            id={customInputId}
            type="text"
            value={value}
            onChange={handleCustomInput}
            onKeyDown={handleCustomKeyDown}
            placeholder={customPlaceholder}
            disabled={disabled}
            required={required}
            aria-required={required || undefined}
            className="w-full px-3 py-2 border border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => {
              setIsCustomMode(false);
              openDropdown();
            }}
            disabled={disabled}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-sm text-blue-600 hover:text-blue-800"
          >
            Choisir dans la liste
          </button>
        </div>
      ) : (
        <>
          <button
            ref={triggerRef}
            id={triggerId}
            type="button"
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-activedescendant={activeOptionId}
            aria-required={required || undefined}
            onClick={() => (isOpen ? closeDropdown() : openDropdown())}
            onKeyDown={handleTriggerKeyDown}
            disabled={disabled}
            className={`w-full px-3 py-2 text-left bg-white border rounded-lg flex items-center justify-between ${
              disabled
                ? 'bg-gray-100 cursor-not-allowed'
                : 'hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500'
            } ${isOpen ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-300'}`}
          >
            <span className={`flex items-center gap-2 ${value ? 'text-gray-900' : 'text-gray-400'}`}>
              {currentOption?.icon && (
                <span className="text-xl" aria-hidden="true">
                  {currentOption.icon}
                </span>
              )}
              {displayValue || placeholder}
            </span>
            <ChevronDown
              aria-hidden="true"
              className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
            />
          </button>

          {isOpen && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-hidden">
              <div className="p-2 border-b border-gray-200">
                <input
                  ref={searchRef}
                  id={searchId}
                  type="search"
                  role="searchbox"
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value);
                    setActiveIndex(0);
                  }}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Rechercher..."
                  aria-label={label ? `Rechercher dans ${label}` : 'Rechercher une option'}
                  aria-controls={listboxId}
                  aria-activedescendant={activeOptionId}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div
                id={listboxId}
                role="listbox"
                aria-label={label ? `Options pour ${label}` : 'Options disponibles'}
                className="overflow-y-auto max-h-60"
              >
                {filteredOptions.map((option, index) => (
                  <button
                    ref={(element) => {
                      optionRefs.current[index] = element;
                    }}
                    id={`${listboxId}-option-${index}`}
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={value === option.value}
                    tabIndex={-1}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => handleSelect(option.value)}
                    className={`w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center justify-between ${
                      activeIndex === index ? 'bg-blue-50' : ''
                    } ${value === option.value ? 'bg-blue-100' : ''}`}
                  >
                    <span className="flex-1 flex items-start gap-2">
                      {option.icon && (
                        <span className="text-xl mt-0.5" aria-hidden="true">
                          {option.icon}
                        </span>
                      )}
                      <span className="flex-1">
                        <span className="block text-sm font-medium text-gray-900">{option.label}</span>
                        {option.subtitle && (
                          <span className="block text-xs text-gray-500">{option.subtitle}</span>
                        )}
                      </span>
                    </span>
                    {value === option.value && (
                      <Check className="w-4 h-4 text-blue-600" aria-hidden="true" />
                    )}
                  </button>
                ))}
              </div>

              {filteredOptions.length === 0 && (
                <div className="px-3 py-4 text-sm text-gray-500 text-center" role="status">
                  Aucun résultat trouvé
                </div>
              )}

              {allowCustom && (
                <div className="p-2 border-t border-gray-200 bg-gray-50">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomMode(true);
                      closeDropdown();
                    }}
                    className="w-full px-3 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded text-left"
                  >
                    <span aria-hidden="true">✏️</span> Saisir manuellement si non trouvé
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
