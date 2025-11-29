'use client';

import * as React from 'react';

export type ScrollingNumberContainerProps = {
  children: React.ReactNode;
  className?: string;
  direction?: 'btt' | 'ttb';
  number?: number;
  step?: number;
  itemsSize?: number;
  onNumberChange?: (value: number) => void;
};

export function ScrollingNumberContainer({ children, className, ...props }: ScrollingNumberContainerProps) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}

export type ScrollingNumberItemsProps = {
  children?: React.ReactNode;
  className?: string;
};

export function ScrollingNumberItems({ children, className, ...props }: ScrollingNumberItemsProps) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}

export type ScrollingNumberHighlightProps = {
  children: React.ReactNode;
  className?: string;
};

export function ScrollingNumberHighlight({ children, className, ...props }: ScrollingNumberHighlightProps) {
  return (
    <span className={className} {...props}>
      {children}
    </span>
  );
}

export type ScrollingNumberProps = {
  value?: number;
  children?: React.ReactNode;
  className?: string;
  delay?: number;
};

export function ScrollingNumber({ value, children, className, delay, ...props }: ScrollingNumberProps) {
  return (
    <span className={className} {...props}>
      {children ?? value}
    </span>
  );
}

