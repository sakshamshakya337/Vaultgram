import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-zinc-800 text-zinc-100 border border-zinc-700/60',
        secondary:
          'border-transparent bg-zinc-800/60 text-zinc-300',
        destructive:
          'border-transparent bg-rose-500/15 text-rose-400 border border-rose-500/30',
        outline: 'text-zinc-400 border border-zinc-800',
        blue: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
        cyan: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
        emerald: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
        amber: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
