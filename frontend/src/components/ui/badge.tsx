import * as React from 'react';
import { cn } from '../../lib/utils.js';

type BadgeVariant = 'default' | 'secondary' | 'outline';

const variantClasses: Record<BadgeVariant, string> = {
  default: 'border-transparent bg-cyan-400/15 text-cyan-100',
  secondary: 'border-transparent bg-slate-900/70 text-slate-300',
  outline: 'border-slate-700/70 bg-slate-950/30 text-slate-300',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-wide',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
