import { LucideIcon, HelpCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/utils/cn';

export interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: LucideIcon;
  iconColor?: string;
}

export function MetricCard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon: Icon = HelpCircle,
  iconColor = 'text-primary-500'
}: MetricCardProps) {
  const changeColors = {
    positive: 'text-accent-600',
    negative: 'text-red-600',
    neutral: 'text-gray-600'
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-xs font-medium text-gray-600">
          {title}
        </CardTitle>
        <Icon className={cn('h-4 w-4', iconColor)} />
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-xl font-bold text-gray-900">{value}</div>
        {change && (
          <p className={cn('text-xs mt-0.5 font-medium', changeColors[changeType])}>
            {change}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
