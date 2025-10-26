import { Loader2 } from 'lucide-react';

export function RouteFallback() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-gray-600">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
        <span className="text-sm font-medium">Loading view…</span>
      </div>
    </div>
  );
}
