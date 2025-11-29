'use client';

import * as React from 'react';
import { cn } from '@/shared/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const toggleVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground',
  {
    variants: {
      size: {
        default: 'h-9 px-3',
        sm: 'h-8 px-2',
        lg: 'h-10 px-3',
      },
      variant: {
        default: 'bg-transparent',
        outline: 'border border-input bg-transparent hover:bg-accent hover:text-accent-foreground',
      },
    },
    defaultVariants: {
      size: 'default',
      variant: 'default',
    },
  }
);

export type ToggleProps = React.ComponentProps<'button'> & 
  VariantProps<typeof toggleVariants> & {
    pressed?: boolean;
    defaultPressed?: boolean;
    onPressedChange?: (pressed: boolean) => void;
  };

export const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  ({ className, size, variant, pressed, defaultPressed, onPressedChange, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(toggleVariants({ size, variant }), className)}
        data-state={pressed ? 'on' : 'off'}
        {...props}
      />
    );
  }
);

Toggle.displayName = 'Toggle';

export type ToggleItemProps = React.ComponentProps<'button'>;

export const ToggleItem = React.forwardRef<HTMLButtonElement, ToggleItemProps>(
  ({ className, ...props }, ref) => {
    return <button ref={ref} className={className} {...props} />;
  }
);

ToggleItem.displayName = 'ToggleItem';

export type ToggleHighlightProps = React.ComponentProps<'div'>;

export const ToggleHighlight = React.forwardRef<HTMLDivElement, ToggleHighlightProps>(
  ({ className, ...props }, ref) => {
    return <div ref={ref} className={className} {...props} />;
  }
);

ToggleHighlight.displayName = 'ToggleHighlight';

