import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-blue-600 text-white shadow-md shadow-blue-600/25 hover:bg-blue-500 border border-blue-500/30 font-semibold',
        primary:
          'bg-blue-600 text-white shadow-md shadow-blue-600/25 hover:bg-blue-500 font-semibold',
        secondary:
          'bg-zinc-800/90 text-zinc-100 border border-zinc-700/60 hover:bg-zinc-700 hover:text-white',
        outline:
          'border border-zinc-700/80 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 hover:border-zinc-600',
        ghost:
          'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60',
        destructive:
          'bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25 hover:text-rose-300',
        glow:
          'bg-sky-500 text-zinc-950 font-semibold shadow-md shadow-sky-500/30 hover:bg-sky-400',
        icon:
          'h-9 w-9 rounded-xl bg-zinc-900/80 text-zinc-400 border border-zinc-800 hover:text-zinc-100 hover:bg-zinc-800 hover:border-zinc-700',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-10 px-5 text-sm font-semibold',
        icon: 'h-9 w-9 p-0',
        'icon-sm': 'h-8 w-8 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  );
});
Button.displayName = 'Button';

export { Button, buttonVariants };
