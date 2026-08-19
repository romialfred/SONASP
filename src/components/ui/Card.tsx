import { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn('sn-card', className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: CardProps) {
  return (
    <div
      className={cn('flex flex-col space-y-1.5 p-6', className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: CardProps) {
  return (
    <h3
      // 24 px pour un titre de section a l'interieur d'une carte ecrasait le
      // contenu : le titre pesait plus lourd que les champs qu'il annonce.
      className={cn('font-heading text-base font-semibold leading-tight tracking-tight', className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: CardProps) {
  return (
    <p
      className={cn('text-sm text-gray-600', className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: CardProps) {
  return (
    <div className={cn('p-6 pt-0', className)} {...props} />
  );
}

export function CardFooter({ className, ...props }: CardProps) {
  return (
    <div
      className={cn('flex items-center p-6 pt-0', className)}
      {...props}
    />
  );
}
