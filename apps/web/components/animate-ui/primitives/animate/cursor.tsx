'use client';

import * as React from 'react';
import { Slot } from '@/components/animate-ui/primitives/animate/slot';

export type CursorProviderProps = {
  children: React.ReactNode;
  global?: boolean;
};

export function CursorProvider({ children, global = false }: CursorProviderProps) {
  return <>{children}</>;
}

export type CursorContainerProps = React.ComponentProps<'div'>;

export function CursorContainer({ children, ...props }: CursorContainerProps) {
  return <div {...props}>{children}</div>;
}

export type CursorProps = {
  children?: React.ReactNode;
  asChild?: boolean;
  className?: string;
};

export const Cursor = React.forwardRef<HTMLDivElement, CursorProps>(
  ({ children, asChild = false, className, ...props }, ref) => {
    const Component = asChild ? Slot : 'div';
    return (
      <Component ref={ref} className={className} {...props}>
        {children}
      </Component>
    );
  }
);

Cursor.displayName = 'Cursor';

export type CursorFollowProps = {
  children?: React.ReactNode;
  asChild?: boolean;
  sideOffset?: number;
  alignOffset?: number;
  className?: string;
};

export const CursorFollow = React.forwardRef<HTMLDivElement, CursorFollowProps>(
  ({ children, asChild = false, sideOffset, alignOffset, className, ...props }, ref) => {
    const Component = asChild ? Slot : 'div';
    return (
      <Component ref={ref} className={className} {...props}>
        {children}
      </Component>
    );
  }
);

CursorFollow.displayName = 'CursorFollow';

