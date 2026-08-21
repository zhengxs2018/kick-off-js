import React from 'react';
import { cn } from '@/lib/utils';

export type MloBadgeProps = {
  children: React.ReactNode;
  variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'success';
  className?: string;
};

const MloBadgeVariants: Record<string, string> = {
  default: 'bg-zinc-100 text-zinc-700 border-transparent',
  secondary: 'bg-blue-50 text-blue-700 border-transparent',
  outline: 'border border-zinc-200 text-zinc-500 bg-white',
  destructive: 'bg-red-50 text-red-700 border-transparent font-medium',
  neutral: 'bg-zinc-50 text-zinc-500 border-zinc-100',
};

export const MloBadge: React.FC<MloBadgeProps> = ({ children, variant = 'default', className }) => {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[4px] px-1.5 py-0.5 text-[11px] leading-tight font-medium tracking-wide transition-colors',
        MloBadgeVariants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
};
