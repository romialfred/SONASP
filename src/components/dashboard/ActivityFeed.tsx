import { LucideIcon, HelpCircle } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface ActivityItem {
  id: string;
  icon: LucideIcon;
  iconColor: string;
  title: string;
  description: string;
  time: string;
}

export interface ActivityFeedProps {
  items: ActivityItem[];
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        if (!item) {
          return null;
        }
        const Icon = item.icon ?? HelpCircle;
        return (
          <div key={item.id} className="flex items-start gap-3">
            <div className={cn(
              'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
              item.iconColor || 'bg-primary-500'
            )}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{item.title}</p>
              <p className="text-xs text-gray-600 mt-0.5">{item.description}</p>
              <p className="text-xs text-gray-400 mt-1">{item.time}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
