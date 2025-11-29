'use client';

import * as React from 'react';
import { Copy, Check } from 'lucide-react';
import { useCopyToClipboard } from '@/shared/hooks/use-copy';
import { Button } from '@/components/ui/button';
import { cn } from '@/shared/utils';

export type CopyButtonProps = React.ComponentProps<typeof Button> & {
  content: string;
};

export function CopyButton({ content, className, size, variant, ...props }: CopyButtonProps) {
  const { isCopied, copyToClipboard } = useCopyToClipboard();

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={() => copyToClipboard(content)}
      className={cn('relative', className)}
      {...props}
    >
      {isCopied ? (
        <Check className="h-4 w-4" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );
}

