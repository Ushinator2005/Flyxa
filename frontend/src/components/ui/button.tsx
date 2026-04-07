import * as React from 'react';
import { cn } from '../../lib/utils.js';

type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

const variantClasses: Record<ButtonVariant, string> = {
  default:
    'bg-slate-100 text-slate-950 hover:bg-white shadow-[0_14px_32px_rgba(148,163,184,0.18)]',
  secondary:
    'bg-slate-800/80 text-slate-100 hover:bg-slate-800',
  outline:
    'border border-slate-700 bg-slate-950/30 text-slate-300 hover:bg-slate-900/70 hover:text-white',
  ghost: 'text-slate-400 hover:bg-slate-900/60 hover:text-white',
};

const sizeClasses: Record<ButtonSize, string> = {
  default: 'h-11 px-4 py-2',
  sm: 'h-9 rounded-md px-3',
  lg: 'h-12 rounded-xl px-6 text-base',
  icon: 'h-10 w-10',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:pointer-events-none disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  ),
);

Button.displayName = 'Button';

export { Button };
