import { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface TimelineEvent {
  id: string;
  title: string;
  description?: string;
  timestamp: string;
  user?: string;
  icon?: LucideIcon;
  iconColor?: string;
  isLast?: boolean;
}

export interface TimelineProps {
  events: TimelineEvent[];
  className?: string;
}

export function Timeline({ events, className }: TimelineProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {events.map((event, index) => {
        const Icon = event.icon;
        const isLast = index === events.length - 1;

        return (
          <div key={event.id} className="relative flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10',
                  event.iconColor || 'bg-primary-500'
                )}
              >
                {Icon && <Icon className="h-5 w-5 text-white" />}
              </div>

              {!isLast && (
                <div className="w-0.5 h-full bg-gray-200 mt-2 flex-1 min-h-[40px]" />
              )}
            </div>

            <div className="flex-1 pb-8">
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-gray-900">{event.title}</h4>
                    {event.description && (
                      <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                    )}
                    {event.user && (
                      <p className="text-xs text-gray-500 mt-2">By {event.user}</p>
                    )}
                  </div>

                  <time className="text-xs text-gray-500 whitespace-nowrap">
                    {event.timestamp}
                  </time>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
