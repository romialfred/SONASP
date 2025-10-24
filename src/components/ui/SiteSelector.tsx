import { useState } from 'react';
import { MapPin, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface Site {
  id: string;
  name: string;
  country: string;
}

export interface SiteSelectorProps {
  sites: Site[];
  selectedSite: string;
  onSiteChange: (siteId: string) => void;
}

export function SiteSelector({ sites, selectedSite, onSiteChange }: SiteSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = sites.find(site => site.id === selectedSite);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <MapPin className="h-4 w-4 text-primary-600" />
        <span className="text-sm font-medium text-gray-700">
          {selected?.name || 'Select Site'}
        </span>
        <ChevronDown className={cn(
          "h-4 w-4 text-gray-400 transition-transform",
          isOpen && "rotate-180"
        )} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20">
            {sites.map((site) => (
              <button
                key={site.id}
                onClick={() => {
                  onSiteChange(site.id);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-gray-50 transition-colors",
                  site.id === selectedSite && "bg-primary-50"
                )}
              >
                <div className="flex flex-col items-start">
                  <span className="font-medium text-gray-900">{site.name}</span>
                  <span className="text-xs text-gray-500">{site.country}</span>
                </div>
                {site.id === selectedSite && (
                  <Check className="h-4 w-4 text-primary-600" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
