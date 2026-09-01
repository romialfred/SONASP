import { Clock, User, MapPin, FileText, Circle, Timer } from 'lucide-react';
import { ShippingStatus, getShippingStatusConfig } from '@/constants/shippingStatuses';

export interface ShippingStatusHistoryEntry {
  id: string;
  shipping_preparation_id?: string;
  old_status: ShippingStatus | null;
  new_status: ShippingStatus;
  changed_by: string;
  changed_at: string;
  notes: string | null;
  user_email?: string;
}

interface ShippingStatusHistoryProps {
  history: ShippingStatusHistoryEntry[];
  siteCountry?: string;
}

function ShippingStatusBadge({ status }: { status: ShippingStatus }) {
  const config = getShippingStatusConfig(status);
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor} border ${config.borderColor}`}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

export function ShippingStatusHistory({ history, siteCountry }: ShippingStatusHistoryProps) {
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }),
      time: date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      full: date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  };

  const calculateDuration = (date1: string, date2: string) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffMs = Math.abs(d1.getTime() - d2.getTime());

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || parts.length === 0) parts.push(`${minutes}min`);

    return parts.join(' ');
  };

  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()
  );

  if (history.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
          <Clock className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-sm text-gray-600 font-medium">No status change recorded</p>
        <p className="text-xs text-gray-500 mt-1">
          Status changes will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-[15px] top-8 bottom-8 w-0.5 bg-gradient-to-b from-blue-200 via-blue-300 to-blue-200" />

      <div className="space-y-4">
        {sortedHistory.map((entry, index) => {
          const { full } = formatDateTime(entry.changed_at);
          const isFirst = index === 0;
          const isLast = index === sortedHistory.length - 1;

          const duration = !isLast ? calculateDuration(
            entry.changed_at,
            sortedHistory[index + 1].changed_at
          ) : null;

          return (
            <div key={entry.id} className="relative pl-12">
              <div
                className={`absolute left-0 top-0 w-8 h-8 rounded-full border-4 border-white shadow-lg flex items-center justify-center ${
                  isFirst
                    ? 'bg-gradient-to-br from-emerald-400 to-emerald-600'
                    : isLast
                    ? 'bg-gradient-to-br from-gray-300 to-gray-400'
                    : 'bg-gradient-to-br from-blue-400 to-blue-600'
                }`}
              >
                <Circle className="w-3 h-3 text-white fill-current" />
              </div>

              <div
                className={`bg-white rounded-lg border shadow-sm hover:shadow-md transition-all ${
                  isFirst
                    ? 'border-emerald-200 bg-gradient-to-br from-emerald-50/30 to-white'
                    : 'border-gray-200 hover:border-blue-200'
                }`}
              >
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    {entry.old_status ? (
                      <>
                        <ShippingStatusBadge status={entry.old_status as ShippingStatus} />
                        <span className="text-gray-400 font-bold text-xs">→</span>
                        <ShippingStatusBadge status={entry.new_status as ShippingStatus} />
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <ShippingStatusBadge status={entry.new_status as ShippingStatus} />
                        <span className="text-xs text-emerald-600 font-medium">
                          (Created)
                        </span>
                      </div>
                    )}
                    {isFirst && (
                      <span className="ml-auto text-[9px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                        LATEST
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-gray-600 mb-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <span className="font-medium">{full}</span>
                    </div>
                    <span className="text-gray-300">|</span>
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3 text-gray-400" />
                      <span>{entry.user_email || 'System'}</span>
                    </div>
                    {siteCountry && (
                      <>
                        <span className="text-gray-300">|</span>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-gray-400" />
                          <span>{siteCountry}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {duration && (
                    <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 rounded px-2 py-1 mb-2">
                      <Timer className="w-3 h-3" />
                      <span className="font-medium">Duration: {duration}</span>
                    </div>
                  )}

                  {entry.notes && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="flex items-start gap-2">
                        <FileText className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-700 mb-1">Notes:</p>
                          <p className="text-xs text-gray-600 bg-blue-50 rounded-lg p-2 border border-blue-100">
                            {entry.notes}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{history.length} recorded change{history.length === 1 ? '' : 's'}</span>
          {history.length > 0 && (
            <span>
              First: {formatDateTime(sortedHistory[sortedHistory.length - 1].changed_at).date}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
