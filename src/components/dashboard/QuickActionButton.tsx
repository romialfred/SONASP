import { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';

export interface QuickActionButtonProps {
  label: string;
  icon: LucideIcon;
  href: string;
  variant?: 'primary' | 'secondary' | 'accent';
}

export function QuickActionButton({
  label,
  icon: Icon,
  href,
  variant = 'primary'
}: QuickActionButtonProps) {
  const variants = {
    primary: 'bg-primary-500 hover:bg-primary-600 text-white',
    secondary: 'bg-secondary-500 hover:bg-secondary-600 text-white',
    accent: 'bg-accent-500 hover:bg-accent-600 text-white'
  };

  return (
    <Link
      to={href}
      className={cn(
        'flex items-center gap-3 px-6 py-4 rounded-lg transition-colors shadow-sm hover:shadow-md',
        variants[variant]
      )}
    >
      <Icon className="h-6 w-6" />
      <span className="font-semibold">{label}</span>
    </Link>
  );
}
