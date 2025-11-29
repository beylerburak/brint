'use client';

import * as React from 'react';
import { cn } from '@/shared/utils';

export type CodeBlockProps = React.ComponentProps<'div'> & {
  code: string;
  theme?: 'light' | 'dark';
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  'data-done'?: boolean | string;
};

export const CodeBlock = React.forwardRef<HTMLDivElement, CodeBlockProps>(
  ({ code, theme = 'light', scrollContainerRef, className, 'data-done': dataDone, ...props }, ref) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    React.useImperativeHandle(ref, () => containerRef.current as HTMLDivElement);
    if (scrollContainerRef) {
      React.useImperativeHandle(scrollContainerRef, () => containerRef.current as HTMLDivElement);
    }

    return (
      <div
        ref={containerRef}
        data-done={dataDone}
        data-theme={theme}
        className={cn('font-mono', className)}
        {...props}
      >
        <pre className="m-0">
          <code className="block whitespace-pre-wrap break-words">{code}</code>
        </pre>
      </div>
    );
  }
);

CodeBlock.displayName = 'CodeBlock';

